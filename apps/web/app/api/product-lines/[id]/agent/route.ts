import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    include: { agent: { select: { ownerId: true } } },
  });
  if (!productLine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If an agent already exists, only the owner or an org admin may modify it
  const isAdmin = user.memberships[0]?.role === "ADMIN";
  if (productLine.agent && productLine.agent.ownerId !== user.id && !isAdmin) {
    return NextResponse.json({ error: "Only the agent owner or an admin can edit this agent" }, { status: 403 });
  }

  const { systemPrompt, model } = await request.json();
  if (!systemPrompt?.trim()) {
    return NextResponse.json({ error: "System prompt is required" }, { status: 400 });
  }

  const agent = await prisma.agent.upsert({
    where: { productLineId: id },
    create: {
      productLineId: id,
      systemPrompt: systemPrompt.trim(),
      model: model ?? "claude-sonnet-4-6",
      ownerId: user.id,
      createdBy: user.id,
    },
    update: {
      systemPrompt: systemPrompt.trim(),
      model: model ?? "claude-sonnet-4-6",
    },
  });

  return NextResponse.json(agent);
}
