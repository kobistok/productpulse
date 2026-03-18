import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const skill = await prisma.orgSkill.findFirst({ where: { id, orgId } });
  if (!skill) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.orgSkill.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
