import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    select: { id: true },
  });

  if (!productLine) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const events = await prisma.triggerEvent.findMany({
    where: { productLineId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { trigger: { select: { repoUrl: true, provider: true } } },
  });

  return NextResponse.json(events);
}
