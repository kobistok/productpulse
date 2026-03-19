import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const config = await prisma.zendeskConfig.findUnique({ where: { orgId } });
  if (!config) return NextResponse.json(null);

  return NextResponse.json({
    subdomain: config.subdomain,
    email: config.email,
    apiToken: "••••••••",
  });
}

export async function PUT(request: NextRequest) {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { subdomain, email, apiToken } = (await request.json()) as {
    subdomain: string;
    email: string;
    apiToken?: string;
  };

  if (!subdomain || !email) {
    return NextResponse.json({ error: "subdomain and email are required" }, { status: 400 });
  }

  const existing = await prisma.zendeskConfig.findUnique({ where: { orgId } });

  if (existing) {
    const data: { subdomain: string; email: string; apiToken?: string } = { subdomain, email };
    if (apiToken) data.apiToken = apiToken;
    const updated = await prisma.zendeskConfig.update({ where: { orgId }, data });
    return NextResponse.json({ subdomain: updated.subdomain, email: updated.email, apiToken: "••••••••" });
  }

  if (!apiToken) {
    return NextResponse.json({ error: "apiToken is required for new config" }, { status: 400 });
  }

  const created = await prisma.zendeskConfig.create({ data: { orgId, subdomain, email, apiToken } });
  return NextResponse.json({ subdomain: created.subdomain, email: created.email, apiToken: "••••••••" });
}

export async function DELETE() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  await prisma.zendeskConfig.deleteMany({ where: { orgId } });
  return NextResponse.json({ ok: true });
}
