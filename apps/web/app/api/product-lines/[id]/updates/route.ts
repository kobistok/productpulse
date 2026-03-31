import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id: productLineId } = await params;
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({ where: { id: productLineId, orgId } });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { isoWeek, year, content } = (await req.json()) as {
    isoWeek: number;
    year: number;
    content: string;
  };

  if (!content?.trim()) return NextResponse.json({ error: "Content required" }, { status: 400 });

  const update = await prisma.update.upsert({
    where: { productLineId_isoWeek_year: { productLineId, isoWeek, year } },
    create: { productLineId, isoWeek, year, content, commitShas: [] },
    update: { content },
  });

  return NextResponse.json(update);
}
