import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { enqueueAgentJob, type StoredAgentInput } from "@/lib/cloud-tasks";
import { getISOWeek, getISOWeekYear } from "date-fns";

const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eventId: string }> }
) {
  const user = await requireSession();
  const { id: productLineId, eventId } = await params;
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const [productLine, originalEvent] = await Promise.all([
    prisma.productLine.findFirst({
      where: { id: productLineId, orgId },
      select: {
        id: true,
        orgId: true,
        jiraConfig: { select: { baseUrl: true, email: true, apiToken: true, atlassianDomain: true } },
      },
    }),
    prisma.triggerEvent.findUnique({
      where: { id: eventId },
      include: { trigger: { select: { id: true, repoUrl: true, branchFilter: true } } },
    }),
  ]);

  if (!productLine || !originalEvent) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const targetIsoWeek = getISOWeek(originalEvent.createdAt);
  const targetYear = getISOWeekYear(originalEvent.createdAt);

  const repo =
    originalEvent.repo ??
    originalEvent.trigger?.repoUrl?.replace(/^https?:\/\/(github|gitlab)\.com\//, "") ??
    "manual run";
  const branch =
    originalEvent.branch ??
    (originalEvent.trigger?.branchFilter?.includes("*")
      ? "main"
      : originalEvent.trigger?.branchFilter) ??
    "main";

  const storedInput = originalEvent.agentInputData as StoredAgentInput | null;

  // Get Jira tickets: use stored data, or re-fetch using keys from workerDetail
  let jiraTickets = storedInput?.jira ?? [];
  if (jiraTickets.length === 0 && originalEvent.workerDetail && productLine.jiraConfig) {
    const keys = [...originalEvent.workerDetail.matchAll(JIRA_KEY_RE)].map((m) => m[1]);
    if (keys.length > 0) {
      const fresh = await fetchJiraTicketsByKeys(productLine.jiraConfig, keys);
      if (fresh) jiraTickets = fresh;
    }
  }

  const jiraBaseUrl = productLine.jiraConfig
    ? productLine.jiraConfig.atlassianDomain
      ? `https://${productLine.jiraConfig.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : productLine.jiraConfig.baseUrl.replace(/\/+$/, "")
    : (storedInput?.jiraBaseUrl ?? undefined);

  const agentInputOverride: StoredAgentInput | undefined = storedInput
    ? { ...storedInput, jira: jiraTickets.length > 0 ? jiraTickets : storedInput.jira, jiraBaseUrl }
    : jiraTickets.length > 0
    ? { commits: [], filesChanged: [], diffSummary: "", jira: jiraTickets, jiraBaseUrl }
    : undefined;

  // Create a hidden temp event to hold the re-run result — not shown in the run log
  const tempEvent = await prisma.triggerEvent.create({
    data: {
      productLineId,
      triggerId: originalEvent.triggerId,
      source: "manual",
      status: "rerun_pending",
      detail: `Re-run · Week ${targetIsoWeek}/${targetYear}`,
      repo,
      branch,
    },
  });

  try {
    await enqueueAgentJob({
      triggerEventId: tempEvent.id,
      triggerId: originalEvent.triggerId ?? undefined,
      productLineId,
      orgId,
      payload: {
        ref: `refs/heads/${branch}`,
        repository: { full_name: repo },
        commits: [],
      },
      targetIsoWeek,
      targetYear,
      manualRun: true,
      agentInputOverride,
    });
  } catch (err) {
    await prisma.triggerEvent.update({
      where: { id: tempEvent.id },
      data: { status: "failed" },
    });
    return NextResponse.json({ error: "Failed to queue job" }, { status: 500 });
  }

  return NextResponse.json({
    newEventId: tempEvent.id,
    originalEventId: eventId,
    targetIsoWeek,
    targetYear,
    agentInput: {
      repo,
      branch,
      commits: storedInput?.commits ?? [],
      jiraTickets,
    },
  });
}

type JiraIssueResponse = {
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
    description?: { content?: unknown[] } | string | null;
    assignee?: { displayName?: string } | null;
    reporter?: { displayName?: string } | null;
    priority?: { name?: string } | null;
    labels?: string[];
    components?: Array<{ name?: string }>;
    fixVersions?: Array<{ name?: string }>;
    created?: string;
    updated?: string;
    resolution?: { name?: string } | null;
  };
};

function parseJiraIssue(key: string, issue: JiraIssueResponse) {
  const f = issue.fields;
  let description: string | null = null;
  if (typeof f.description === "string") {
    description = f.description;
  } else if (f.description && typeof f.description === "object" && Array.isArray(f.description.content)) {
    description = f.description.content
      .flatMap((block: unknown) => {
        const b = block as { content?: Array<{ text?: string }> };
        return (b.content ?? []).map((c) => c.text ?? "").filter(Boolean);
      })
      .join(" ") || null;
  }
  return {
    key,
    summary: f.summary,
    status: f.status.name,
    type: f.issuetype.name,
    description,
    assignee: f.assignee?.displayName ?? null,
    reporter: f.reporter?.displayName ?? null,
    priority: f.priority?.name ?? null,
    labels: f.labels ?? [],
    components: (f.components ?? []).map((c) => c.name ?? "").filter(Boolean),
    fixVersions: (f.fixVersions ?? []).map((v) => v.name ?? "").filter(Boolean),
    created: f.created ?? null,
    updated: f.updated ?? null,
    resolution: f.resolution?.name ?? null,
  };
}

async function fetchJiraTicketsByKeys(
  config: { baseUrl: string; email: string; apiToken: string },
  keys: string[]
): Promise<ReturnType<typeof parseJiraIssue>[] | null> {
  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        const res = await fetch(`${config.baseUrl}/rest/api/3/issue/${key}`, {
          headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        });
        if (!res.ok) return null;
        return parseJiraIssue(key, (await res.json()) as JiraIssueResponse);
      })
    );
    const tickets = results
      .filter((r): r is PromiseFulfilledResult<ReturnType<typeof parseJiraIssue>> =>
        r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
    return tickets.length > 0 ? tickets : null;
  } catch {
    return null;
  }
}
