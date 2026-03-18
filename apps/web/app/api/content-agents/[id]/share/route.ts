import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const agent = await prisma.contentAgent.findFirst({ where: { id, orgId } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const shareToken = randomBytes(16).toString("hex");
  const updated = await prisma.contentAgent.update({
    where: { id },
    data: { shareToken },
  });

  return NextResponse.json({ shareToken: updated.shareToken });
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

  await prisma.contentAgent.update({ where: { id }, data: { shareToken: null } });
  return NextResponse.json({ revoked: true });
}
