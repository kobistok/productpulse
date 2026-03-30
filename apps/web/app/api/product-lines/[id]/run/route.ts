import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { enqueueAgentJob } from "@/lib/cloud-tasks";
import { getISOWeek, getISOWeekYear, subWeeks } from "date-fns";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    select: { id: true, orgId: true },
  });

  if (!productLine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const lastWeek = subWeeks(new Date(), 1);
  const targetIsoWeek = getISOWeek(lastWeek);
  const targetYear = getISOWeekYear(lastWeek);

  // Find all active triggers to run with their repo/branch context
  const activeTriggers = await prisma.gitTrigger.findMany({
    where: { productLineId: productLine.id, active: true },
    select: { id: true, branchFilter: true, repoUrl: true },
  });

  // No triggers configured — run once with a generic payload
  if (activeTriggers.length === 0) {
    const event = await prisma.triggerEvent.create({
      data: {
        productLineId: productLine.id,
        source: "manual",
        status: "queued",
        detail: `Week ${targetIsoWeek}/${targetYear}`,
      },
    }).catch(() => null);

    try {
      await enqueueAgentJob({
        triggerEventId: event?.id,
        productLineId: productLine.id,
        orgId: productLine.orgId,
        payload: { ref: "refs/heads/main", repository: { full_name: "manual run" }, commits: [] },
        targetIsoWeek,
        targetYear,
        manualRun: true,
      });
    } catch (err) {
      console.error("[run] Failed to enqueue agent job:", err);
      if (event) {
        prisma.triggerEvent.update({
          where: { id: event.id },
          data: { status: "failed", detail: (err as Error).message },
        }).catch(() => null);
      }
      return NextResponse.json(
        { error: "Failed to queue job", detail: (err as Error).message },
        { status: 500 }
      );
    }

    return NextResponse.json({ queued: true, isoWeek: targetIsoWeek, year: targetYear, count: 1 });
  }

  // Run once per active trigger with its repo/branch context
  let queued = 0;
  for (const trigger of activeTriggers) {
    // Use exact branch if no wildcards, otherwise fall back to "main"
    const branch =
      trigger.branchFilter && !trigger.branchFilter.includes("*")
        ? trigger.branchFilter
        : "main";
    const repoName = trigger.repoUrl
      ? trigger.repoUrl.replace(/^https?:\/\/(github|gitlab)\.com\//, "")
      : "manual run";

    const event = await prisma.triggerEvent.create({
      data: {
        productLineId: productLine.id,
        triggerId: trigger.id,
        source: "manual",
        status: "queued",
        detail: `Week ${targetIsoWeek}/${targetYear}`,
        branch,
        repo: repoName,
      },
    }).catch(() => null);

    try {
      await enqueueAgentJob({
        triggerEventId: event?.id,
        triggerId: trigger.id,
        productLineId: productLine.id,
        orgId: productLine.orgId,
        payload: {
          ref: `refs/heads/${branch}`,
          repository: { full_name: repoName },
          commits: [],
        },
        targetIsoWeek,
        targetYear,
        manualRun: true,
      });
      queued++;
    } catch (err) {
      console.error("[run] Failed to enqueue job for trigger", trigger.id, err);
      if (event) {
        prisma.triggerEvent.update({
          where: { id: event.id },
          data: { status: "failed", detail: (err as Error).message },
        }).catch(() => null);
      }
    }
  }

  if (queued === 0) {
    return NextResponse.json({ error: "Failed to queue any jobs" }, { status: 500 });
  }

  return NextResponse.json({ queued: true, isoWeek: targetIsoWeek, year: targetYear, count: queued });
}
