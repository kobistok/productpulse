import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  // Verify ownership via contentAgent
  const output = await prisma.contentOutput.findFirst({
    where: { id },
    include: { contentAgent: { select: { orgId: true } } },
  });

  if (!output || output.contentAgent.orgId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { status } = await request.json();
  if (!["draft", "published"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await prisma.contentOutput.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json(updated);
}
