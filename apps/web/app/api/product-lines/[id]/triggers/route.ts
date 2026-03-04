import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

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

  const { repoUrl, branchFilter, pathFilter, provider } = await request.json();

  const trigger = await prisma.gitTrigger.create({
    data: {
      productLineId: id,
      provider: provider === "GITLAB" ? "GITLAB" : "GITHUB",
      webhookSecret: randomBytes(32).toString("hex"),
      repoUrl: repoUrl?.trim() || null,
      branchFilter: branchFilter?.trim() || null,
      pathFilter: pathFilter?.trim() || null,
    },
  });

  return NextResponse.json(trigger, { status: 201 });
}
