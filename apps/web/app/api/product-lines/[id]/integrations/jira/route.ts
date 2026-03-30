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

  const config = await prisma.jiraConfig.findUnique({ where: { productLineId: id } });
  if (!config) return NextResponse.json(null);

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

  const { baseUrl: rawBaseUrl, atlassianDomain, email, apiToken } = await request.json();
  const baseUrl = rawBaseUrl?.trim().replace(/\/+$/, "");
  if (!baseUrl || !email) {
    return NextResponse.json({ error: "baseUrl and email are required" }, { status: 400 });
  }

  const existing = await prisma.jiraConfig.findUnique({ where: { productLineId: id } });
  if (!existing && !apiToken) {
    return NextResponse.json({ error: "apiToken is required" }, { status: 400 });
  }

  const config = await prisma.jiraConfig.upsert({
    where: { productLineId: id },
    update: {
      baseUrl,
      atlassianDomain: atlassianDomain?.trim() || null,
      email,
      ...(apiToken ? { apiToken } : {}),
    },
    create: { productLineId: id, baseUrl, atlassianDomain: atlassianDomain?.trim() || null, email, apiToken },
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

  await prisma.jiraConfig.deleteMany({ where: { productLineId: id } });
  return NextResponse.json({ deleted: true });
}
