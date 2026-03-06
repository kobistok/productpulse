import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { enqueueAgentJob } from "@/lib/cloud-tasks";
import { createHmac, timingSafeEqual } from "crypto";

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
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // GitLab: only handle merged MR events; ignore everything else
    if (trigger.provider === "GITLAB") {
      const kind = payload.object_kind as string | undefined;
      if (kind === "merge_request") {
        const attrs = payload.object_attributes as Record<string, unknown> | undefined;
        if (attrs?.state !== "merged") {
          return NextResponse.json({ skipped: "MR not merged" });
        }
      }
      if (kind !== "merge_request") {
        return NextResponse.json({ skipped: "Not a merge_request event" });
      }
    }

    // Normalize to a common shape understood by the worker
    const normalized =
      trigger.provider === "GITLAB"
        ? normalizeGitLabPayload(payload)
        : payload;

    // Apply branch filter (target branch for MRs, push branch for GitHub)
    if (trigger.branchFilter) {
      const branch = (normalized.ref as string)?.replace("refs/heads/", "");
      if (!matchesFilter(branch, trigger.branchFilter)) {
        return NextResponse.json({ skipped: "Branch filter did not match" });
      }
    }

    try {
      await enqueueAgentJob({
        triggerId,
        productLineId: trigger.productLineId,
        orgId: trigger.productLine.orgId,
        payload: normalized,
      });
    } catch (err) {
      console.error("[webhook] Failed to enqueue agent job:", err);
      return NextResponse.json(
        { error: "Failed to queue job", detail: (err as Error).message },
        { status: 500 }
      );
    }

    // Increment fire count (best-effort, don't fail the request if this errors)
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
