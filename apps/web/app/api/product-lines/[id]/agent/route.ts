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
  });
  if (!productLine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { productContext, filterRule, model } = await request.json();

  const agent = await prisma.agent.upsert({
    where: { productLineId: id },
    create: {
      productLineId: id,
      productContext: productContext?.trim() || null,
      filterRule: filterRule?.trim() || null,
      model: model ?? "claude-sonnet-4-6",
      ownerId: user.id,
      createdBy: user.id,
    },
    update: {
      productContext: productContext?.trim() || null,
      filterRule: filterRule?.trim() || null,
      model: model ?? "claude-sonnet-4-6",
    },
  });

  return NextResponse.json(agent);
}
