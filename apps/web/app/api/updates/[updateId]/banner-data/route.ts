import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

function parseSection(raw: string): { headline: string; bullets: string[] } {
  const stripped = raw.replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "").trimStart();
  const lines = stripped.split("\n").filter(Boolean);
  const firstLine = lines[0]?.trim() ?? "";
  const m = firstLine.match(/^\*\*(.+?)\*\*$/);
  const headline = (m ? m[1] : firstLine).replace(/`([^`]+)`/g, "$1");
  const bullets = lines
    .slice(1)
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.replace(/^-\s+/, "").replace(/`([^`]+)`/g, "$1").trim());
  return { headline, bullets };
}

function simpleHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  const { updateId } = await params;
  const sectionIndex = parseInt(req.nextUrl.searchParams.get("s") ?? "0", 10);

  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return new Response("No org", { status: 403 });

  const update = await prisma.update.findFirst({
    where: { id: updateId, productLine: { orgId } },
    include: { productLine: { select: { name: true } } },
  });
  if (!update) return new Response("Not found", { status: 404 });

  const rawSections = update.content
    .split(/\n\n---\n\n|\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const raw = rawSections[sectionIndex] ?? rawSections[0] ?? "";
  const { headline, bullets } = parseSection(raw);
  const seed = simpleHash(`${updateId}-${sectionIndex}`);

  // Ask Claude Haiku to evaluate and generate a marketing headline
  let shouldShow = false;
  let title: string | undefined;

  try {
    const prompt = `You are evaluating a software update entry for a customer-facing product newsletter.

Product: ${update.productLine.name}
Update entry:
---
${raw.slice(0, 800)}
---

Headline: ${headline}
Details: ${bullets.slice(0, 5).join("; ")}

Your task:
1. Decide if this update delivers genuine NEW value or functionality to end-users — e.g. new features, significant UX improvements, new integrations, meaningful new capabilities.
   → Return show: false for: bug fixes, refactors, internal tooling, infrastructure changes, performance tweaks, dependency upgrades, or anything a customer would not directly notice or care about.
2. If worth showing: write a concise, punchy marketing headline (max 55 characters, no quotes) that a product marketing manager would write. Focus on the customer benefit. Be clear and exciting — not clickbaity. No ellipsis.

Respond with valid JSON only, no extra text:
{"show": true, "title": "Your headline"}
or
{"show": false}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const text = data.content?.[0]?.text ?? "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        shouldShow = parsed.show === true;
        title = parsed.title ?? undefined;
      }
    }
  } catch {
    // If Claude call fails, fall back to not showing the banner
    shouldShow = false;
  }

  return Response.json(
    { shouldShow, title, seed },
    {
      headers: {
        "Cache-Control": "private, max-age=86400, immutable",
      },
    }
  );
}
