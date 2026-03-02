import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createHmac, timingSafeEqual } from "crypto";
import { CloudTasksClient } from "@google-cloud/tasks";

const tasksClient = new CloudTasksClient();

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

  // Verify GitHub HMAC signature
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(body, trigger.webhookSecret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  // Apply branch filter
  if (trigger.branchFilter) {
    const branch = (payload.ref as string)?.replace("refs/heads/", "");
    if (!matchesFilter(branch, trigger.branchFilter)) {
      return NextResponse.json({ skipped: "Branch filter did not match" });
    }
  }

  await enqueueAgentJob({
    triggerId,
    productLineId: trigger.productLineId,
    orgId: trigger.productLine.orgId,
    payload,
  });

  return NextResponse.json({ queued: true });
}

function verifySignature(
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
