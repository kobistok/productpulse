import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { StoredAgentInput } from "@/lib/cloud-tasks";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const user = await requireSession();
  const { id: productLineId, eventId } = await params;
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { isoWeek, year } = (await req.json()) as { isoWeek: number; year: number };

  const [productLine, event] = await Promise.all([
    prisma.productLine.findFirst({ where: { id: productLineId, orgId }, select: { id: true } }),
    prisma.triggerEvent.findUnique({ where: { id: eventId } }),
  ]);

  if (!productLine || !event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!event.updateContent) return NextResponse.json({ error: "No content to approve" }, { status: 400 });

  const existing = await prisma.update.findUnique({
    where: { productLineId_isoWeek_year: { productLineId, isoWeek, year } },
    select: { content: true },
  });

  const update = existing
    ? await prisma.update.update({
        where: { productLineId_isoWeek_year: { productLineId, isoWeek, year } },
        data: { content: `${existing.content}\n\n---\n\n${event.updateContent}` },
      })
    : await prisma.update.create({
        data: { productLineId, isoWeek, year, content: event.updateContent, commitShas: [] },
      });

  // Now that the user approved, update workerDetail from stored input context
  const inputData = event.agentInputData as StoredAgentInput | null;
  if (inputData) {
    const parts: string[] = [];
    if (inputData.jira && inputData.jira.length > 0) {
      parts.push(`Jira: ${inputData.jira.map((t) => `${t.key} (${t.status})`).join(", ")}`);
    }
    if (parts.length > 0) {
      prisma.triggerEvent.update({ where: { id: eventId }, data: { workerDetail: parts.join(" · ") } })
        .catch(() => {});
    }
  }

  return NextResponse.json(update);
}
