import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runProductPulseAgent } from "@productpulse/agent";
import { getISOWeek, getISOWeekYear } from "date-fns";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.WORKER_AUTH_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await request.json();
  const { orgId, payload } = job;

  const productLines = await prisma.productLine.findMany({
    where: { orgId, agent: { isNot: null } },
    include: {
      agent: true,
      updates: { orderBy: { createdAt: "desc" }, take: 4 },
    },
  });

  if (productLines.length === 0) {
    return NextResponse.json({ skipped: "No product lines with agents" });
  }

  const gitEvent = {
    repo: (payload.repository as { full_name: string })?.full_name ?? "unknown",
    branch: (payload.ref as string)?.replace("refs/heads/", "") ?? "unknown",
    commits: ((payload.commits as Array<{ id: string; message: string; author: { name: string } }>) ?? []).map((c) => ({
      sha: c.id,
      message: c.message,
      author: c.author?.name ?? "unknown",
    })),
    diffSummary: buildDiffSummary(payload),
    filesChanged: extractFilesChanged(payload),
  };

  const outputs = await runProductPulseAgent(
    productLines.map((pl) => ({
      id: pl.id,
      name: pl.name,
      description: pl.description,
      systemPrompt: pl.agent!.systemPrompt,
      recentUpdates: pl.updates.map((u) => ({
        content: u.content,
        isoWeek: u.isoWeek,
        year: u.year,
      })),
    })),
    gitEvent
  );

  const now = new Date();
  const isoWeek = getISOWeek(now);
  const year = getISOWeekYear(now);
  const created: string[] = [];

  for (const output of outputs) {
    if (output.decision === "update_created" && output.content) {
      await prisma.update.upsert({
        where: {
          productLineId_isoWeek_year: {
            productLineId: output.productLineId,
            isoWeek,
            year,
          },
        },
        update: {
          content: output.content,
          commitShas: gitEvent.commits.map((c) => c.sha),
        },
        create: {
          productLineId: output.productLineId,
          isoWeek,
          year,
          content: output.content,
          commitShas: gitEvent.commits.map((c) => c.sha),
          diffSummary: gitEvent.diffSummary,
        },
      });
      created.push(output.productLineId);
    }
  }

  return NextResponse.json({ processed: outputs.length, created });
}

type GitPayload = {
  commits?: Array<{
    message: string;
    added?: string[];
    modified?: string[];
    removed?: string[];
  }>;
};

function buildDiffSummary(payload: unknown): string {
  const p = payload as GitPayload;
  return (p.commits ?? [])
    .map(
      (c) =>
        `${c.message}: +${c.added?.length ?? 0} files, ~${c.modified?.length ?? 0} modified, -${c.removed?.length ?? 0} removed`
    )
    .join("\n");
}

function extractFilesChanged(payload: unknown): string[] {
  const p = payload as GitPayload;
  const files = new Set<string>();
  for (const commit of p.commits ?? []) {
    [...(commit.added ?? []), ...(commit.modified ?? []), ...(commit.removed ?? [])].forEach(
      (f) => files.add(f)
    );
  }
  return [...files];
}
