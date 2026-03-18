import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const agent = await prisma.contentAgent.findFirst({
    where: { id, orgId },
    include: {
      outputs: { orderBy: [{ year: "desc" }, { isoWeek: "desc" }, { createdAt: "desc" }] },
    },
  });

  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(agent);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const agent = await prisma.contentAgent.findFirst({ where: { id, orgId } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name, specificContext, outputTypes, productLineIds } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const updated = await prisma.contentAgent.update({
    where: { id },
    data: {
      name: name.trim(),
      specificContext: specificContext?.trim() || null,
      outputTypes: outputTypes ?? agent.outputTypes,
      productLineIds: productLineIds ?? agent.productLineIds,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const agent = await prisma.contentAgent.findFirst({ where: { id, orgId } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.contentAgent.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
