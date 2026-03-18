import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const skills = await prisma.orgSkill.findMany({
    where: { orgId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(skills);
}

export async function POST(request: NextRequest) {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { name, content } = await request.json();
  if (!name?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "Name and content are required" }, { status: 400 });
  }

  const skill = await prisma.orgSkill.create({
    data: { orgId, name: name.trim(), content: content.trim(), createdBy: user.id },
  });

  return NextResponse.json(skill, { status: 201 });
}
