import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await requireSession();
  const { orgId, label } = await request.json();

  const membership = user.memberships.find((m) => m.orgId === orgId);
  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invite = await prisma.dashboardInvite.create({
    data: {
      orgId,
      label: label?.trim() || null,
      createdBy: user.id,
    },
  });

  return NextResponse.json(invite, { status: 201 });
}
