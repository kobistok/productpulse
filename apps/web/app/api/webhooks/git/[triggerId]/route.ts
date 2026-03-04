import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHmac, timingSafeEqual } from "crypto";
import { CloudTasksClient } from "@google-cloud/tasks";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ triggerId: string }> }
) {
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

  const payload = JSON.parse(body);

  // Normalize to a common shape understood by the worker
  const normalized =
    trigger.provider === "GITLAB"
      ? normalizeGitLabPayload(payload)
      : payload;

  // Apply branch filter
  if (trigger.branchFilter) {
    const branch = (normalized.ref as string)?.replace("refs/heads/", "");
    if (!matchesFilter(branch, trigger.branchFilter)) {
      return NextResponse.json({ skipped: "Branch filter did not match" });
    }
  }

  await enqueueAgentJob({
    triggerId,
    productLineId: trigger.productLineId,
    orgId: trigger.productLine.orgId,
    payload: normalized,
  });

  return NextResponse.json({ queued: true });
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
  // Constant-time comparison
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Normalize a GitLab push payload to the same shape as GitHub's
function normalizeGitLabPayload(payload: Record<string, unknown>) {
  type GitLabCommit = {
    id: string;
    message: string;
    author: { name: string };
    added: string[];
    modified: string[];
    removed: string[];
  };

  const commits = ((payload.commits as GitLabCommit[]) ?? []).map((c) => ({
    id: c.id,
    message: c.message,
    author: { name: c.author?.name ?? "unknown" },
    added: c.added ?? [],
    modified: c.modified ?? [],
    removed: c.removed ?? [],
  }));

  const project = payload.project as { web_url?: string; path_with_namespace?: string } | undefined;

  return {
    ref: payload.ref,
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

async function enqueueAgentJob(job: {
  triggerId: string;
  productLineId: string;
  orgId: string;
  payload: unknown;
}) {
  const project = process.env.GCP_PROJECT_ID!;
  const location = process.env.GCP_LOCATION ?? "us-central1";
  const queue = process.env.CLOUD_TASKS_QUEUE ?? "agent-jobs";
  const workerUrl = `${process.env.WORKER_URL}/api/worker/process`;
  const tasksClient = new CloudTasksClient();

  await tasksClient.createTask({
    parent: tasksClient.queuePath(project, location, queue),
    task: {
      httpRequest: {
        httpMethod: "POST" as const,
        url: workerUrl,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WORKER_AUTH_TOKEN}`,
        },
        body: Buffer.from(JSON.stringify(job)).toString("base64"),
      },
    },
  });
}
