import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getISOWeek, getISOWeekYear } from "date-fns";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  const user = await requireSession();
  const { id, updateId } = await params;
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    include: { agent: { select: { filterRule: true, productContext: true } } },
  });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const update = await prisma.update.findFirst({ where: { id: updateId, productLineId: id } });
  if (!update) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Find trigger events that ran during this update's ISO week and produced an update
  const allEvents = await prisma.triggerEvent.findMany({
    where: { productLineId: id, agentDecision: "update_created", status: { not: "rerun_pending" } },
    orderBy: { createdAt: "asc" },
  });

  const triggerEvents = allEvents.filter(
    (ev) => getISOWeek(ev.createdAt) === update.isoWeek && getISOWeekYear(ev.createdAt) === update.year
  );

  return NextResponse.json({ update, agent: productLine.agent ?? null, triggerEvents });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  const user = await requireSession();
  const { id, updateId } = await params;
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({ where: { id, orgId } });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { content } = (await req.json()) as { content: string };

  if (!content?.trim()) {
    // No sections left — delete the whole record
    await prisma.update.delete({ where: { id: updateId, productLineId: id } });
    return NextResponse.json({ deleted: true });
  }

  const updated = await prisma.update.update({
    where: { id: updateId, productLineId: id },
    data: { content },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; updateId: string }> }
) {
  const user = await requireSession();
  const { id, updateId } = await params;
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({ where: { id, orgId } });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.update.delete({ where: { id: updateId, productLineId: id } });
  return NextResponse.json({ deleted: true });
}
