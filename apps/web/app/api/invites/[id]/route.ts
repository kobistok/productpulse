import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireSession();

  const membership = user.memberships.find((m) => m.role === "ADMIN");
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invite = await prisma.invite.findFirst({
    where: { id, orgId: membership.orgId },
  });
  if (!invite) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.invite.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
