import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { enqueueAgentJob, type StoredAgentInput } from "@/lib/cloud-tasks";
import { getISOWeek, getISOWeekYear } from "date-fns";

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

  const storedInput = originalEvent.agentInputData as StoredAgentInput | null;

  // Reset the original event in place — keeps same time, source, and row in the log
  await prisma.triggerEvent.update({
    where: { id: eventId },
    data: { status: "queued", agentDecision: null, workerDetail: null, updateContent: null },
  });

  try {
    await enqueueAgentJob({
      triggerEventId: eventId,
      triggerId: originalEvent.triggerId ?? undefined,
      productLineId,
      orgId,
      payload: {
        ref: `refs/heads/${branch}`,
        repository: { full_name: repo },
        commits: [],
      },
      targetIsoWeek,
      targetYear,
      manualRun: true,
      agentInputOverride: storedInput ?? undefined,
    });
  } catch (err) {
    await prisma.triggerEvent.update({
      where: { id: eventId },
      data: { status: "failed", agentDecision: null },
    });
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }

  return NextResponse.json({
    newEventId: eventId,
    targetIsoWeek,
    targetYear,
    agentInput: {
      repo,
      branch,
      commits: storedInput?.commits ?? [],
      jiraTickets: storedInput?.jira ?? [],
    },
  });
}
