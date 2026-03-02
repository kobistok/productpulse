import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await requireSession();
  const { name } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const baseSlug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const org = await prisma.organization.create({
    data: {
      name: name.trim(),
      slug: `${baseSlug}-${Date.now()}`,
      memberships: {
        create: { userId: user.id, role: "ADMIN" },
      },
    },
  });

  return NextResponse.json(org, { status: 201 });
}
