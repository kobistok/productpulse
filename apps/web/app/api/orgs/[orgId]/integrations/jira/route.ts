import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const user = await requireSession();
  if (!user.memberships.some((m) => m.orgId === orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const config = await prisma.jiraConfig.findUnique({ where: { orgId } });
  if (!config) return NextResponse.json(null);

  return NextResponse.json({ ...config, apiToken: "••••••••" });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const user = await requireSession();
  if (!user.memberships.some((m) => m.orgId === orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { baseUrl, email, apiToken } = await request.json();
  if (!baseUrl || !email || !apiToken) {
    return NextResponse.json({ error: "baseUrl, email and apiToken are required" }, { status: 400 });
  }

  const config = await prisma.jiraConfig.upsert({
    where: { orgId },
    update: { baseUrl, email, apiToken },
    create: { orgId, baseUrl, email, apiToken },
  });

  return NextResponse.json({ ...config, apiToken: "••••••••" });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const user = await requireSession();
  if (!user.memberships.some((m) => m.orgId === orgId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.jiraConfig.deleteMany({ where: { orgId } });
  return NextResponse.json({ deleted: true });
}
