import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
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

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const where = q
    ? {
        productLineId: id,
        status: { not: "skipped" as const },
        OR: [
          { detail: { contains: q, mode: "insensitive" as const } },
          { workerDetail: { contains: q, mode: "insensitive" as const } },
          { repo: { contains: q, mode: "insensitive" as const } },
          { branch: { contains: q, mode: "insensitive" as const } },
          { updateContent: { contains: q, mode: "insensitive" as const } },
          { trigger: { repoUrl: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : { productLineId: id, status: { not: "skipped" as const } };

  const events = await prisma.triggerEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    // No limit when searching — return all matches; cap default view at 100
    ...(q ? {} : { take: 100 }),
    include: { trigger: { select: { repoUrl: true, provider: true } } },
  });

  return NextResponse.json(events);
}
