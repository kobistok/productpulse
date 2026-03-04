import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { runProductPulseAgent, type IntegrationContext } from "@productpulse/agent";
import { getISOWeek, getISOWeekYear } from "date-fns";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.WORKER_AUTH_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await request.json();
  const { orgId, payload } = job;

  const [productLines, jiraConfig] = await Promise.all([
    prisma.productLine.findMany({
      where: { orgId, agent: { isNot: null } },
      include: {
        agent: true,
        updates: { orderBy: { createdAt: "desc" }, take: 4 },
        circleCIConfig: true,
      },
    }),
    prisma.jiraConfig.findUnique({ where: { orgId } }),
  ]);

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

  // Fetch Jira tickets referenced in commit messages (org-wide config)
  const jiraTickets = jiraConfig
    ? await fetchJiraTickets(jiraConfig, gitEvent.commits.map((c) => c.message))
    : [];

  // Build per-product-line integration context
  const integrationContext: Record<string, IntegrationContext> = {};
  await Promise.all(
    productLines.map(async (pl) => {
      const ctx: IntegrationContext = {};
      if (pl.circleCIConfig) {
        ctx.circleCI = await fetchCircleCIContext(pl.circleCIConfig, gitEvent.commits.map((c) => c.sha));
      }
      if (jiraTickets.length > 0) {
        ctx.jira = jiraTickets;
      }
      if (ctx.circleCI || ctx.jira) {
        integrationContext[pl.id] = ctx;
      }
    })
  );

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
    gitEvent,
    integrationContext
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

// ── CircleCI ──────────────────────────────────────────────────────────────────

async function fetchCircleCIContext(
  config: { apiToken: string; projectSlug: string; branch: string },
  pushedShas: string[]
): Promise<IntegrationContext["circleCI"]> {
  try {
    const res = await fetch(
      `https://circleci.com/api/v2/project/${config.projectSlug}/pipeline?branch=${encodeURIComponent(config.branch)}`,
      { headers: { "Circle-Token": config.apiToken } }
    );
    if (!res.ok) return null;

    type Pipeline = { vcs?: { revision?: string }; created_at?: string; status?: string };
    const data = (await res.json()) as { items?: Pipeline[] };
    const pipelines = data.items ?? [];

    // Find the most recent successful pipeline
    const lastSuccess = pipelines.find((p) => p.status === "success");
    const lastSha = lastSuccess?.vcs?.revision ?? null;
    const lastAt = lastSuccess?.created_at ?? null;

    // Count commits pushed that come after the last deployed SHA
    const unreleasedCommitCount = lastSha
      ? pushedShas.findIndex((sha) => sha.startsWith(lastSha)) // shas after last deployed
      : pushedShas.length;

    return {
      lastSuccessfulPipelineAt: lastAt,
      lastSuccessfulCommitSha: lastSha,
      unreleasedCommitCount,
    };
  } catch {
    return null;
  }
}

// ── Jira ─────────────────────────────────────────────────────────────────────

const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

async function fetchJiraTickets(
  config: { baseUrl: string; email: string; apiToken: string },
  commitMessages: string[]
): Promise<NonNullable<IntegrationContext["jira"]>> {
  const keys = [
    ...new Set(commitMessages.flatMap((m) => [...m.matchAll(JIRA_KEY_RE)].map((r) => r[1]))),
  ];
  if (keys.length === 0) return [];

  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");

  const results = await Promise.allSettled(
    keys.map(async (key) => {
      const res = await fetch(`${config.baseUrl}/rest/api/3/issue/${key}?fields=summary,status,issuetype`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
      if (!res.ok) return null;
      type JiraIssue = { fields: { summary: string; status: { name: string }; issuetype: { name: string } } };
      const issue = (await res.json()) as JiraIssue;
      return {
        key,
        summary: issue.fields.summary,
        status: issue.fields.status.name,
        type: issue.fields.issuetype.name,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<NonNullable<IntegrationContext["jira"]>[0]> =>
      r.status === "fulfilled" && r.value !== null
    )
    .map((r) => r.value);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
