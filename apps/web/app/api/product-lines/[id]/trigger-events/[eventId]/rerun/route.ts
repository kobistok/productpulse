import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { enqueueAgentJob, type StoredAgentInput } from "@/lib/cloud-tasks";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { fetchJiraFieldMap, fetchJiraTicketsByKeys, type JiraConfig } from "@/lib/jira";

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
      const fieldMap = await fetchJiraFieldMap(productLine.jiraConfig as JiraConfig);
      const fresh = await fetchJiraTicketsByKeys(productLine.jiraConfig as JiraConfig, keys, fieldMap);
      if (fresh) jiraTickets = fresh;
    }
  } else if (jiraTickets.length > 0 && productLine.jiraConfig) {
    // Re-fetch stored tickets to get fresh status + custom fields
    const keys = jiraTickets.map((t) => t.key);
    const fieldMap = await fetchJiraFieldMap(productLine.jiraConfig as JiraConfig);
    const fresh = await fetchJiraTicketsByKeys(productLine.jiraConfig as JiraConfig, keys, fieldMap);
    if (fresh && fresh.length > 0) jiraTickets = fresh;
  }

  const jiraBaseUrl = productLine.jiraConfig
    ? productLine.jiraConfig.atlassianDomain
      ? `https://${productLine.jiraConfig.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : productLine.jiraConfig.baseUrl.replace(/\/+$/, "")
    : (storedInput?.jiraBaseUrl ?? undefined);

  // Always pass agentInputOverride so the worker knows this is a re-run.
  // Without it, the worker treats it as a normal webhook with empty commits and skips.
  const agentInputOverride: StoredAgentInput = storedInput
    ? { ...storedInput, jira: jiraTickets.length > 0 ? jiraTickets : (storedInput.jira ?? []), jiraBaseUrl }
    : { commits: [], filesChanged: [], diffSummary: "", jira: jiraTickets, jiraBaseUrl };

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

