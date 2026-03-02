import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const { name, description } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const productLine = await prisma.productLine.create({
    data: {
      orgId,
      name: name.trim(),
      description: description?.trim() || null,
      slug: `${slug}-${Date.now()}`,
      createdBy: user.id,
    },
  });

  return NextResponse.json(productLine, { status: 201 });
}
