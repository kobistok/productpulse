import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const agents = await prisma.contentAgent.findMany({
    where: { orgId },
    include: { outputs: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(agents);
}

export async function POST(request: NextRequest) {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { name, specificContext, outputTypes, productLineIds } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!outputTypes?.length) return NextResponse.json({ error: "At least one output type is required" }, { status: 400 });

  const agent = await prisma.contentAgent.create({
    data: {
      orgId,
      name: name.trim(),
      specificContext: specificContext?.trim() || null,
      outputTypes: outputTypes ?? [],
      productLineIds: productLineIds ?? [],
      createdBy: user.id,
    },
  });

  return NextResponse.json(agent, { status: 201 });
}
