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

  await enqueueAgentJob({
    productLineId: productLine.id,
    orgId: productLine.orgId,
    payload: { ref: "refs/heads/main", repository: { full_name: "manual run" }, commits: [] },
    targetIsoWeek,
    targetYear,
  });

  return NextResponse.json({ queued: true, isoWeek: targetIsoWeek, year: targetYear });
}
