import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function DELETE() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  await prisma.googleDriveConfig.deleteMany({ where: { orgId } });
  return NextResponse.json({ ok: true });
}
