import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({ where: { id, orgId } });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = await prisma.circleCIConfig.findUnique({ where: { productLineId: id } });
  if (!config) return NextResponse.json(null);

  // Mask the token
  return NextResponse.json({ ...config, apiToken: "••••••••" });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({ where: { id, orgId } });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { apiToken, projectSlug, branch } = await request.json();
  if (!apiToken || !projectSlug) {
    return NextResponse.json({ error: "apiToken and projectSlug are required" }, { status: 400 });
  }

  const config = await prisma.circleCIConfig.upsert({
    where: { productLineId: id },
    update: { apiToken, projectSlug, branch: branch || "main" },
    create: { productLineId: id, apiToken, projectSlug, branch: branch || "main" },
  });

  return NextResponse.json({ ...config, apiToken: "••••••••" });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({ where: { id, orgId } });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.circleCIConfig.deleteMany({ where: { productLineId: id } });
  return NextResponse.json({ deleted: true });
}
