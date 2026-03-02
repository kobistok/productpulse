import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

async function verifyOwnership(productLineId: string, orgId: string) {
  return prisma.productLine.findFirst({ where: { id: productLineId, orgId } });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
  const { id, triggerId } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  if (!(await verifyOwnership(id, orgId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Record<string, unknown> = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.branchFilter !== undefined) data.branchFilter = body.branchFilter?.trim() || null;
  if (body.pathFilter !== undefined) data.pathFilter = body.pathFilter?.trim() || null;
  if (body.repoUrl !== undefined) data.repoUrl = body.repoUrl?.trim() || null;

  const trigger = await prisma.gitTrigger.update({
    where: { id: triggerId, productLineId: id },
    data,
  });

  return NextResponse.json(trigger);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; triggerId: string }> }
) {
  const { id, triggerId } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  if (!(await verifyOwnership(id, orgId))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.gitTrigger.delete({
    where: { id: triggerId, productLineId: id },
  });

  return NextResponse.json({ deleted: true });
}
