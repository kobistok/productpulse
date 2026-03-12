import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getISOWeek, getISOWeekYear } from "date-fns";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    select: { id: true },
  });

  if (!productLine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const events = await prisma.triggerEvent.findMany({
    where: { productLineId: id, status: { not: "skipped" } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { trigger: { select: { repoUrl: true, provider: true } } },
  });

  // Batch-fetch update content for weeks where the agent created an update
  const createdEvents = events.filter((e) => e.agentDecision === "update_created");
  if (createdEvents.length > 0) {
    const weekKeys = [
      ...new Set(
        createdEvents.map((e) => {
          const w = getISOWeek(new Date(e.createdAt));
          const y = getISOWeekYear(new Date(e.createdAt));
          return `${w}-${y}`;
        })
      ),
    ];
    const updates = await prisma.update.findMany({
      where: {
        productLineId: id,
        OR: weekKeys.map((k) => {
          const [w, y] = k.split("-").map(Number);
          return { isoWeek: w, year: y };
        }),
      },
      select: { content: true, isoWeek: true, year: true },
    });
    const updateMap = new Map(updates.map((u) => [`${u.isoWeek}-${u.year}`, u.content]));

    const enriched = events.map((ev) => {
      if (ev.agentDecision !== "update_created") return { ...ev, updateContent: null };
      const w = getISOWeek(new Date(ev.createdAt));
      const y = getISOWeekYear(new Date(ev.createdAt));
      return { ...ev, updateContent: updateMap.get(`${w}-${y}`) ?? null };
    });
    return NextResponse.json(enriched);
  }

  return NextResponse.json(events.map((ev) => ({ ...ev, updateContent: null })));
}
