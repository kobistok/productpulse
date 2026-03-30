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

  const productLine = await prisma.productLine.findFirst({ where: { id, orgId } });
  if (!productLine) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { baseUrl: rawBaseUrl, email, apiToken: providedToken } = await request.json();
  const baseUrl = rawBaseUrl?.trim().replace(/\/+$/, "");

  if (!baseUrl || !email) {
    return NextResponse.json({ error: "baseUrl and email are required" }, { status: 400 });
  }

  // Use provided token or fall back to stored token
  let apiToken = providedToken;
  if (!apiToken) {
    const config = await prisma.jiraConfig.findUnique({ where: { productLineId: id } });
    if (!config) return NextResponse.json({ error: "No API token provided and no stored token found" }, { status: 400 });
    apiToken = config.apiToken;
  }

  try {
    const auth = Buffer.from(`${email}:${apiToken}`).toString("base64");
    const url = `${baseUrl}/rest/api/3/myself`;
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });

    if (res.ok) {
      const data = (await res.json()) as { displayName?: string; emailAddress?: string };
      return NextResponse.json({ ok: true, displayName: data.displayName, emailAddress: data.emailAddress });
    } else {
      const body = await res.text();
      let message = `HTTP ${res.status}`;
      try {
        const parsed = JSON.parse(body) as { message?: string; errorMessages?: string[] };
        message = parsed.message ?? parsed.errorMessages?.[0] ?? message;
      } catch {}
      return NextResponse.json({ ok: false, error: message });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}
