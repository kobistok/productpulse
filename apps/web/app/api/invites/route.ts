import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await requireSession();
  const { orgId, email } = await request.json();

  // Verify user is an admin of this org
  const membership = user.memberships.find(
    (m) => m.orgId === orgId && m.role === "ADMIN"
  );
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7-day expiry

  const invite = await prisma.invite.create({
    data: {
      orgId,
      role: "MEMBER",
      email: email?.toLowerCase().trim() || null,
      expiresAt,
      createdBy: user.id,
    },
  });

  return NextResponse.json(invite, { status: 201 });
}
