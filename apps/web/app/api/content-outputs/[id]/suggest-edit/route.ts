import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const { articleId, articleTitle, articleUrl } = (await request.json()) as {
    articleId: number;
    articleTitle: string;
    articleUrl: string;
  };

  // Verify the output belongs to this org
  const output = await prisma.contentOutput.findFirst({
    where: { id },
    include: { contentAgent: { select: { orgId: true } } },
  });

  if (!output || output.contentAgent.orgId !== orgId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    prompt: `You are a technical writer helping update a Help Center article based on new product information.

Product update content:
${output.content}

Based on the above, suggest specific edits to the Zendesk Help Center article titled "${articleTitle}" (${articleUrl}).

Be concrete — describe what sections to add, modify, or remove. Where possible, provide the actual suggested text.`,
  });

  return NextResponse.json({ suggestion: text });
}
