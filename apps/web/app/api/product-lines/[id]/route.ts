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

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    select: { id: true, createdBy: true },
  });

  if (!productLine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAdmin = user.memberships[0]?.role === "ADMIN";
  if (productLine.createdBy !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Only the product line creator or an admin can delete it" }, { status: 403 });
  }

  await prisma.productLine.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
