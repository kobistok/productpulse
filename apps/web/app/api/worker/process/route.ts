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
  const { orgId, productLineId, triggerEventId, payload, targetIsoWeek, targetYear } = job;
  console.log("[worker] job:", JSON.stringify({ orgId, productLineId, triggerEventId, targetIsoWeek, targetYear }));

  const productLines = await prisma.productLine.findMany({
    where: { orgId, agent: { isNot: null }, ...(productLineId ? { id: productLineId } : {}) },
    include: {
      agent: true,
      updates: { orderBy: { createdAt: "desc" }, take: 4 },
      circleCIConfig: true,
      jiraConfig: true,
    },
  });

  console.log("[worker] productLines found:", productLines.length);
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

  // Build per-product-line integration context
  const integrationContext: Record<string, IntegrationContext> = {};
  await Promise.all(
    productLines.map(async (pl) => {
      const ctx: IntegrationContext = {};
      if (pl.circleCIConfig) {
        ctx.circleCI = await fetchCircleCIContext(pl.circleCIConfig, gitEvent.commits.map((c) => c.sha));
      }
      if (pl.jiraConfig) {
        const tickets = await fetchJiraTickets(pl.jiraConfig, gitEvent.commits.map((c) => c.message));
        if (tickets.length > 0) {
          ctx.jira = tickets;
          // Prefer explicit atlassianDomain for browse links; fall back to normalized baseUrl
          const domain = pl.jiraConfig.atlassianDomain?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
          ctx.jiraBaseUrl = domain
            ? `https://${domain}`
            : pl.jiraConfig.baseUrl.replace(/\/+$/, "");
        }
      }
      if (ctx.circleCI || ctx.jira) {
        integrationContext[pl.id] = ctx;
      }
    })
  );

  const now = new Date();
  const isoWeek = targetIsoWeek ?? getISOWeek(now);
  const year = targetYear ?? getISOWeekYear(now);

  const outputs = await runProductPulseAgent(
    productLines.map((pl) => {
      const currentWeekUpdate = pl.updates.find((u) => u.isoWeek === isoWeek && u.year === year);
      const previousUpdates = pl.updates.filter((u) => !(u.isoWeek === isoWeek && u.year === year));
      return {
        id: pl.id,
        name: pl.name,
        description: pl.description,
        productContext: pl.agent!.productContext ?? null,
        filterRule: pl.agent!.filterRule ?? null,
        currentWeekContent: currentWeekUpdate?.content ?? null,
        recentUpdates: previousUpdates.map((u) => ({
          content: u.content,
          isoWeek: u.isoWeek,
          year: u.year,
        })),
      };
    }),
    gitEvent,
    integrationContext
  );

  const created: string[] = [];

  console.log("[worker] outputs:", JSON.stringify(outputs.map((o) => ({ id: o.productLineId, decision: o.decision }))));

  // Build integration summary for the trigger event log
  const integrationParts: string[] = [];
  for (const pl of productLines) {
    const ctx = integrationContext[pl.id];
    if (ctx?.jira && ctx.jira.length > 0) {
      integrationParts.push(`Jira: ${ctx.jira.map((t) => `${t.key} (${t.status})`).join(", ")}`);
    }
    if (ctx?.circleCI) {
      const cci = ctx.circleCI;
      integrationParts.push(
        `CircleCI: last deploy ${cci.lastSuccessfulPipelineAt ? new Date(cci.lastSuccessfulPipelineAt).toLocaleDateString() : "unknown"}` +
        (cci.unreleasedCommitCount != null ? `, ${cci.unreleasedCommitCount} unreleased commits` : "")
      );
    }
  }

  // Update trigger event with agent result — awaited and split so agentDecision
  // always lands even if the updateContent field causes issues on older deployments
  if (triggerEventId) {
    const output = outputs[0];
    const workerDetailParts: string[] = [];
    if (integrationParts.length > 0) workerDetailParts.push(integrationParts.join(" · "));
    if (output?.decision === "skipped" && output.skipReason) workerDetailParts.push(`Agent: ${output.skipReason}`);

    // Step 1: always write agentDecision (critical — drives the run log status)
    try {
      await prisma.triggerEvent.update({
        where: { id: triggerEventId },
        data: {
          agentDecision: output?.decision ?? "skipped",
          workerDetail: workerDetailParts.join(" · ") || null,
        },
      });
    } catch (err) {
      console.error("[worker] Failed to update TriggerEvent agentDecision:", err);
    }

    // Step 2: optionally persist the generated content for run log expansion
    if (output?.decision === "update_created" && output.content) {
      prisma.triggerEvent.update({
        where: { id: triggerEventId },
        data: { updateContent: output.content },
      }).catch((err) => console.error("[worker] Failed to update TriggerEvent updateContent:", err));
    }
  }

  for (const output of outputs) {
    if (output.decision === "update_created" && output.content) {
      const existing = await prisma.update.findUnique({
        where: { productLineId_isoWeek_year: { productLineId: output.productLineId, isoWeek, year } },
        select: { content: true, commitShas: true },
      });

      if (existing) {
        await prisma.update.update({
          where: { productLineId_isoWeek_year: { productLineId: output.productLineId, isoWeek, year } },
          data: {
            content: `${existing.content}\n\n---\n\n${output.content}`,
            commitShas: [...(existing.commitShas as string[]), ...gitEvent.commits.map((c) => c.sha)],
          },
        });
      } else {
        await prisma.update.create({
          data: {
            productLineId: output.productLineId,
            isoWeek,
            year,
            content: output.content,
            commitShas: gitEvent.commits.map((c) => c.sha),
            diffSummary: gitEvent.diffSummary,
          },
        });
      }
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
    if (!res.ok) return undefined;

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
    return undefined;
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
