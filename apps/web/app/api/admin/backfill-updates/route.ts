import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Reformat a single section into **Headline** + bullets using Claude Haiku
async function reformatSection(content: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system:
        "Reformat a product update into this exact structure:\n**[Short headline summarising the change]**\n\n- Bullet 1 (1 concise sentence)\n- Bullet 2 (1 concise sentence)\n\nRules: output ONLY the reformatted content, 1 headline + 2–4 bullets, use past tense, no intro text or paragraphs.",
      messages: [{ role: "user", content: `Reformat this product update:\n\n${content}` }],
    }),
  });
  const data = (await res.json()) as { content?: Array<{ text?: string }> };
  return data.content?.[0]?.text?.trim() ?? content;
}

function isAlreadyStructured(content: string): boolean {
  const firstSection = content.split(/\n\n---\n\n|\n---\n/)[0]?.trim() ?? "";
  return /^\*\*.+\*\*/.test(firstSection);
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.WORKER_AUTH_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const updates = await prisma.update.findMany({ orderBy: { createdAt: "asc" } });
  const results: Array<{ id: string; week: string; status: string }> = [];

  for (const update of updates) {
    const label = `W${update.isoWeek}/${update.year} (${update.id})`;

    if (isAlreadyStructured(update.content)) {
      results.push({ id: update.id, week: label, status: "skipped" });
      continue;
    }

    try {
      const sections = update.content
        .split(/\n\n---\n\n|\n---\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const reformattedSections: string[] = [];
      for (const section of sections) {
        reformattedSections.push(await reformatSection(section));
      }

      await prisma.update.update({
        where: { id: update.id },
        data: { content: reformattedSections.join("\n\n---\n\n") },
      });

      results.push({ id: update.id, week: label, status: "reformatted" });
    } catch (err) {
      results.push({ id: update.id, week: label, status: `failed: ${String(err)}` });
    }
  }

  const summary = {
    total: updates.length,
    reformatted: results.filter((r) => r.status === "reformatted").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status.startsWith("failed")).length,
    details: results,
  };

  return NextResponse.json(summary);
}
