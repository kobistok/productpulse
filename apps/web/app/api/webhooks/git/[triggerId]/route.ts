import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueAgentJob } from "@/lib/cloud-tasks";
import { createHmac, timingSafeEqual } from "crypto";

function logEvent(
  productLineId: string,
  triggerId: string,
  status: "queued" | "skipped" | "failed",
  detail?: string,
  repo?: string,
  branch?: string
): Promise<string> {
  return prisma.triggerEvent
    .create({
      data: { productLineId, triggerId, source: "webhook", status, detail, repo, branch },
    })
    .then((ev) => ev.id)
    .catch((err) => {
      console.error("[webhook] Failed to write TriggerEvent:", err);
      return "";
    });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
  try {
    const { triggerId } = await params;
    const body = await request.text();

    const trigger = await prisma.gitTrigger.findUnique({
      where: { id: triggerId, active: true },
      include: { productLine: { select: { orgId: true } } },
    });

    if (!trigger) {
      return NextResponse.json({ error: "Trigger not found" }, { status: 404 });
    }

    // Verify signature — GitHub uses HMAC-SHA256, GitLab uses a plain token
    const verified =
      trigger.provider === "GITLAB"
        ? verifyGitLabToken(request, trigger.webhookSecret)
        : verifyGitHubSignature(body, trigger.webhookSecret, request.headers.get("x-hub-signature-256"));

    if (!verified) {
      logEvent(trigger.productLineId, triggerId, "failed", "Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      logEvent(trigger.productLineId, triggerId, "failed", "Invalid JSON body");
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // GitLab: only handle merged MR events; ignore everything else
    if (trigger.provider === "GITLAB") {
      const kind = payload.object_kind as string | undefined;
      const attrs = payload.object_attributes as Record<string, unknown> | undefined;

      if (kind !== "merge_request") {
        logEvent(trigger.productLineId, triggerId, "skipped", `Not a merge_request event (got: ${kind ?? "unknown"})`);
        return NextResponse.json({ skipped: "Not a merge_request event" });
      }

      if (attrs?.state !== "merged") {
        const mrTitle = attrs?.title as string | undefined;
        const mrState = attrs?.state as string | undefined;
        const mrSource = attrs?.source_branch as string | undefined;
        const mrTarget = attrs?.target_branch as string | undefined;
        const mrAuthor = (payload.user as Record<string, unknown> | undefined)?.name as string | undefined;
        const detail = [
          `MR "${mrTitle ?? "unknown"}"`,
          mrAuthor ? `by ${mrAuthor}` : null,
          `state: ${mrState ?? "unknown"}`,
          mrSource && mrTarget ? `(${mrSource} → ${mrTarget})` : null,
        ].filter(Boolean).join(" ");
        logEvent(trigger.productLineId, triggerId, "skipped", detail);
        return NextResponse.json({ skipped: "MR not merged" });
      }
    }

    // Normalize to a common shape understood by the worker
    const normalized =
      trigger.provider === "GITLAB"
        ? normalizeGitLabPayload(payload)
        : payload;

    const repo = (normalized.repository as { full_name?: string })?.full_name;
    const branch = (normalized.ref as string)?.replace("refs/heads/", "");

    // Apply branch filter (target branch for MRs, push branch for GitHub)
    if (trigger.branchFilter) {
      if (!matchesFilter(branch, trigger.branchFilter)) {
        logEvent(trigger.productLineId, triggerId, "skipped", `Branch "${branch}" did not match filter "${trigger.branchFilter}"`, repo, branch);
        return NextResponse.json({ skipped: "Branch filter did not match" });
      }
    }

    const triggerEventId = await logEvent(trigger.productLineId, triggerId, "queued", undefined, repo, branch);

    try {
      await enqueueAgentJob({
        triggerId,
        triggerEventId,
        productLineId: trigger.productLineId,
        orgId: trigger.productLine.orgId,
        payload: normalized,
      });
    } catch (err) {
      console.error("[webhook] Failed to enqueue agent job:", err);
      // Update the event we already created to failed
      prisma.triggerEvent.update({
        where: { id: triggerEventId },
        data: { status: "failed", detail: (err as Error).message },
      }).catch(() => null);
      return NextResponse.json(
        { error: "Failed to queue job", detail: (err as Error).message },
        { status: 500 }
      );
    }

    // Increment fire count (best-effort)
    prisma.gitTrigger.update({
      where: { id: triggerId },
      data: { fireCount: { increment: 1 } },
    }).catch((err) => console.error("[webhook] Failed to increment fireCount:", err));

    return NextResponse.json({ queued: true });
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error", detail: (err as Error).message },
      { status: 500 }
    );
  }
}

function verifyGitHubSignature(
  body: string,
  secret: string,
  signature: string | null
): boolean {
  if (!signature) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function verifyGitLabToken(request: NextRequest, secret: string): boolean {
  const token = request.headers.get("x-gitlab-token");
  if (!token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type GitLabCommit = {
  id: string;
  message: string;
  author: { name: string };
  added?: string[];
  modified?: string[];
  removed?: string[];
};

function normalizeGitLabPayload(payload: Record<string, unknown>) {
  const attrs = payload.object_attributes as Record<string, unknown> | undefined;
  const project = payload.project as { web_url?: string; path_with_namespace?: string } | undefined;
  const targetBranch = (attrs?.target_branch as string) ?? "main";

  const rawCommits = (payload.commits as GitLabCommit[] | undefined) ?? [];
  const lastCommit = attrs?.last_commit as GitLabCommit | undefined;
  const commits =
    rawCommits.length > 0
      ? rawCommits.map((c) => ({
          id: c.id,
          message: c.message,
          author: { name: c.author?.name ?? "unknown" },
          added: c.added ?? [],
          modified: c.modified ?? [],
          removed: c.removed ?? [],
        }))
      : lastCommit
      ? [
          {
            id: lastCommit.id,
            message: `${attrs?.title as string} (MR merged)`,
            author: { name: lastCommit.author?.name ?? "unknown" },
            added: [],
            modified: [],
            removed: [],
          },
        ]
      : [];

  return {
    ref: `refs/heads/${targetBranch}`,
    repository: {
      full_name: project?.path_with_namespace ?? "unknown",
      html_url: project?.web_url ?? "",
    },
    commits,
  };
}

function matchesFilter(value: string, filter: string): boolean {
  if (filter === value) return true;
  if (filter.endsWith("*")) return value.startsWith(filter.slice(0, -1));
  return false;
}
