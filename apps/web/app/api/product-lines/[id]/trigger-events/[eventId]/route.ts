import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const user = await requireSession();
  const { id: productLineId, eventId } = await params;
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const event = await prisma.triggerEvent.findFirst({
    where: { id: eventId, productLineId, productLine: { orgId } },
    include: { trigger: { select: { repoUrl: true, provider: true } } },
  });

  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(event);
}
