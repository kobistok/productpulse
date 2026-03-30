import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pendoTrackServer } from "@/lib/pendo";
import { runProductPulseAgent, type IntegrationContext } from "@productpulse/agent";
import { getISOWeek, getISOWeekYear } from "date-fns";
import type { StoredAgentInput } from "@/lib/cloud-tasks";
import {
  fetchJiraFieldMap,
  fetchJiraTickets,
  fetchJiraTicketsByKeys,
  type JiraConfig,
} from "@/lib/jira";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.WORKER_AUTH_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await request.json();
  const { orgId, productLineId, triggerEventId, payload, targetIsoWeek, targetYear, forceRun, manualRun, agentInputOverride } = job as { orgId: string; productLineId: string; triggerEventId?: string; payload: unknown; targetIsoWeek?: number; targetYear?: number; forceRun?: boolean; manualRun?: boolean; agentInputOverride?: StoredAgentInput };
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
    repo: (payload as { repository?: { full_name?: string } }).repository?.full_name ?? "unknown",
    branch: ((payload as { ref?: string }).ref ?? "").replace("refs/heads/", "") || "unknown",
    commits: agentInputOverride?.commits ?? ((payload as { commits?: Array<{ id: string; message: string; author: { name: string } }> }).commits ?? []).map((c) => ({
      sha: c.id,
      message: c.message,
      author: c.author?.name ?? "unknown",
    })),
    diffSummary: agentInputOverride?.diffSummary ?? buildDiffSummary(payload),
    filesChanged: agentInputOverride?.filesChanged ?? extractFilesChanged(payload),
  };

  // Build per-product-line integration context
  const integrationContext: Record<string, IntegrationContext> = {};

  // Pre-fetch field maps for all distinct Jira workspaces (one request per baseUrl)
  const distinctJiraConfigs = productLines
    .filter((pl) => pl.jiraConfig)
    .reduce((acc, pl) => {
      if (!acc.has(pl.jiraConfig!.baseUrl)) acc.set(pl.jiraConfig!.baseUrl, pl.jiraConfig! as JiraConfig);
      return acc;
    }, new Map<string, JiraConfig>());

  const jiraFieldMaps = new Map<string, Map<string, string>>(
    await Promise.all(
      [...distinctJiraConfigs.entries()].map(async ([baseUrl, cfg]) => [baseUrl, await fetchJiraFieldMap(cfg)] as const)
    )
  );

  await Promise.all(
    productLines.map(async (pl) => {
      const ctx: IntegrationContext = {};
      const fieldMap = pl.jiraConfig ? jiraFieldMaps.get(pl.jiraConfig.baseUrl) : undefined;

      if (agentInputOverride && pl.id === productLineId) {
        // Re-run: fetch Jira using stored ticket keys (fresh status + custom fields)
        if (agentInputOverride.jira && agentInputOverride.jira.length > 0) {
          const keys = agentInputOverride.jira.map((t) => t.key);
          const fresh = pl.jiraConfig
            ? await fetchJiraTicketsByKeys(pl.jiraConfig as JiraConfig, keys, fieldMap)
            : null;
          ctx.jira = fresh && fresh.length > 0 ? fresh : agentInputOverride.jira;
          ctx.jiraBaseUrl = agentInputOverride.jiraBaseUrl;
        } else if (pl.jiraConfig && gitEvent.commits.length > 0) {
          // No stored Jira tickets — try extracting keys from stored commit messages
          const tickets = await fetchJiraTickets(
            pl.jiraConfig as JiraConfig,
            gitEvent.commits.map((c) => c.message),
            fieldMap
          );
          if (tickets.length > 0) {
            ctx.jira = tickets;
            const domain = pl.jiraConfig.atlassianDomain?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
            ctx.jiraBaseUrl = domain ? `https://${domain}` : pl.jiraConfig.baseUrl.replace(/\/+$/, "");
          }
        }
        if (agentInputOverride.circleCI) {
          ctx.circleCI = agentInputOverride.circleCI;
        }
      } else {
        if (pl.circleCIConfig) {
          ctx.circleCI = await fetchCircleCIContext(pl.circleCIConfig, gitEvent.commits.map((c) => c.sha));
        }
        if (pl.jiraConfig) {
          const tickets = await fetchJiraTickets(
            pl.jiraConfig as JiraConfig,
            gitEvent.commits.map((c) => c.message),
            fieldMap
          );
          if (tickets.length > 0) {
            ctx.jira = tickets;
            const domain = pl.jiraConfig.atlassianDomain?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
            ctx.jiraBaseUrl = domain
              ? `https://${domain}`
              : pl.jiraConfig.baseUrl.replace(/\/+$/, "");
          }
        }
      }

      if (ctx.circleCI || ctx.jira) {
        integrationContext[pl.id] = ctx;
      }
    })
  );

  // Persist input context on the TriggerEvent (always, including re-runs with fresh Jira)
  if (triggerEventId) {
    const ctx = integrationContext[productLineId];
    const inputData: StoredAgentInput = agentInputOverride
      ? { ...agentInputOverride, ...(ctx?.jira && { jira: ctx.jira }) }
      : {
          commits: gitEvent.commits,
          filesChanged: gitEvent.filesChanged,
          diffSummary: gitEvent.diffSummary,
          ...(ctx?.jira && { jira: ctx.jira, jiraBaseUrl: ctx.jiraBaseUrl }),
          ...(ctx?.circleCI && { circleCI: ctx.circleCI }),
        };
    prisma.triggerEvent.update({ where: { id: triggerEventId }, data: { agentInputData: inputData as object } })
      .catch((err) => console.error("[worker] Failed to save agentInputData:", err));
  }

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
    integrationContext,
    { forceRun }
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

    // Step 1: always write agentDecision and workerDetail
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
    if (output.decision === "update_created" && output.content && !manualRun) {
      const existing = await prisma.update.findUnique({
        where: { productLineId_isoWeek_year: { productLineId: output.productLineId, isoWeek, year } },
        select: { content: true, commitShas: true },
      });

      const ts = new Date().toISOString();
      const stampedContent = `<!-- ts:${ts} -->\n${output.content}`;

      if (existing) {
        await prisma.update.update({
          where: { productLineId_isoWeek_year: { productLineId: output.productLineId, isoWeek, year } },
          data: {
            content: `${existing.content}\n\n---\n\n${stampedContent}`,
            commitShas: [...(existing.commitShas as string[]), ...gitEvent.commits.map((c) => c.sha)],
          },
        });
      } else {
        await prisma.update.create({
          data: {
            productLineId: output.productLineId,
            isoWeek,
            year,
            content: stampedContent,
            commitShas: gitEvent.commits.map((c) => c.sha),
            diffSummary: gitEvent.diffSummary,
          },
        });
      }
      created.push(output.productLineId);

      await pendoTrackServer({
        event: "product_update_generated",
        visitorId: "system",
        accountId: orgId,
        properties: {
          product_line_id: output.productLineId,
          org_id: orgId,
          iso_week: isoWeek,
          year,
          commit_count: gitEvent.commits.length,
          content_length: output.content.length,
          repo: gitEvent.repo,
          branch: gitEvent.branch,
        },
      });
    } else if (output.decision === "skipped") {
      await pendoTrackServer({
        event: "product_update_skipped",
        visitorId: "system",
        accountId: orgId,
        properties: {
          product_line_id: output.productLineId,
          org_id: orgId,
          commit_count: gitEvent.commits.length,
          repo: gitEvent.repo,
          branch: gitEvent.branch,
        },
      });
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
