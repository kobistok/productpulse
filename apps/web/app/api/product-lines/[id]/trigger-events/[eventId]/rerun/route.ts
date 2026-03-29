import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { enqueueAgentJob } from "@/lib/cloud-tasks";
import { getISOWeek, getISOWeekYear } from "date-fns";

const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const user = await requireSession();
  const { id: productLineId, eventId } = await params;
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const [productLine, originalEvent] = await Promise.all([
    prisma.productLine.findFirst({ where: { id: productLineId, orgId }, select: { id: true, orgId: true } }),
    prisma.triggerEvent.findUnique({
      where: { id: eventId },
      include: { trigger: { select: { id: true, repoUrl: true, branchFilter: true } } },
    }),
  ]);

  if (!productLine || !originalEvent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Derive target week from the original event's date
  const targetIsoWeek = getISOWeek(originalEvent.createdAt);
  const targetYear = getISOWeekYear(originalEvent.createdAt);

  // Preserve repo/branch context from original event
  const repo =
    originalEvent.repo ??
    originalEvent.trigger?.repoUrl?.replace(/^https?:\/\/(github|gitlab)\.com\//, "") ??
    "manual run";
  const branch =
    originalEvent.branch ??
    (originalEvent.trigger?.branchFilter?.includes("*")
      ? "main"
      : originalEvent.trigger?.branchFilter) ??
    "main";

  // Extract Jira keys from the original event's workerDetail so the re-run
  // agent has the same Jira context even though commits are empty.
  const jiraKeys: string[] = originalEvent.workerDetail
    ? [...originalEvent.workerDetail.matchAll(JIRA_KEY_RE)].map((m) => m[1])
    : [];

  const newEvent = await prisma.triggerEvent.create({
    data: {
      productLineId,
      triggerId: originalEvent.triggerId,
      source: "manual",
      status: "queued",
      detail: `Re-run · Week ${targetIsoWeek}/${targetYear}`,
      repo,
      branch,
    },
  });

  try {
    await enqueueAgentJob({
      triggerEventId: newEvent.id,
      triggerId: originalEvent.triggerId ?? undefined,
      productLineId,
      orgId,
      payload: {
        ref: `refs/heads/${branch}`,
        repository: { full_name: repo },
        commits: [],
        preloadedJiraKeys: jiraKeys,
      },
      targetIsoWeek,
      targetYear,
      forceRun: true,
    });
  } catch (err) {
    await prisma.triggerEvent.update({
      where: { id: newEvent.id },
      data: { status: "failed", detail: (err as Error).message },
    });
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }

  return NextResponse.json({
    newEventId: newEvent.id,
    targetIsoWeek,
    targetYear,
    agentInput: { repo, branch, jiraKeys },
  });
}
