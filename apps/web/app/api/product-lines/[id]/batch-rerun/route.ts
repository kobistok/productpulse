import { NextRequest } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { enqueueAgentJob, type StoredAgentInput } from "@/lib/cloud-tasks";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { fetchJiraFieldMap, fetchJiraTicketsByKeys, type JiraConfig } from "@/lib/jira";

const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id: productLineId } = await params;
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return new Response(JSON.stringify({ error: "No organization" }), { status: 400 });

  const { isoWeek, year } = (await req.json()) as { isoWeek: number; year: number };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        const [productLine, existingUpdate, allEvents] = await Promise.all([
          prisma.productLine.findFirst({
            where: { id: productLineId, orgId },
            select: {
              id: true,
              orgId: true,
              jiraConfig: { select: { baseUrl: true, email: true, apiToken: true, atlassianDomain: true } },
            },
          }),
          prisma.update.findUnique({
            where: { productLineId_isoWeek_year: { productLineId, isoWeek, year } },
            select: { id: true, content: true },
          }),
          prisma.triggerEvent.findMany({
            where: {
              productLineId,
              agentDecision: { not: null },
              status: { notIn: ["rerun_pending"] },
            },
            include: { trigger: { select: { id: true, repoUrl: true, branchFilter: true } } },
            orderBy: { createdAt: "asc" },
          }),
        ]);

        if (!productLine) {
          send({ type: "error", message: "Product line not found" });
          controller.close();
          return;
        }

        // Filter to the target ISO week
        const weekEvents = allEvents.filter(
          (ev) => getISOWeek(ev.createdAt) === isoWeek && getISOWeekYear(ev.createdAt) === year
        );

        if (weekEvents.length === 0) {
          send({ type: "error", message: `No agent runs found for W${isoWeek} · ${year}` });
          controller.close();
          return;
        }

        // Summarise original week events for the "why missed" explanation in the UI
        const originalWeekEvents = weekEvents.map((ev) => ({
          id: ev.id,
          repo: ev.repo ?? null,
          branch: ev.branch ?? null,
          source: ev.source,
          agentDecision: ev.agentDecision,
          workerDetail: ev.workerDetail ?? null,
        }));

        const total = weekEvents.length;

        // Fetch Jira field map once upfront
        let fieldMap: Map<string, string> | null = null;
        if (productLine.jiraConfig) {
          try { fieldMap = await fetchJiraFieldMap(productLine.jiraConfig as JiraConfig); } catch { /* ignore */ }
        }

        const jiraBaseUrl = productLine.jiraConfig
          ? productLine.jiraConfig.atlassianDomain
            ? `https://${productLine.jiraConfig.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
            : productLine.jiraConfig.baseUrl.replace(/\/+$/, "")
          : undefined;

        const newEventIds: string[] = [];

        for (let i = 0; i < weekEvents.length; i++) {
          const originalEvent = weekEvents[i];
          const storedInput = originalEvent.agentInputData as StoredAgentInput | null;

          const repo =
            originalEvent.repo ??
            originalEvent.trigger?.repoUrl?.replace(/^https?:\/\/(github|gitlab)\.com\//, "") ??
            "manual run";
          const branch =
            originalEvent.branch ??
            (originalEvent.trigger?.branchFilter?.includes("*") ? "main" : originalEvent.trigger?.branchFilter) ??
            "main";

          send({ type: "event_start", index: i, total, repo, branch, source: originalEvent.source });

          // Refresh Jira tickets
          let jiraTickets = storedInput?.jira ?? [];
          if (productLine.jiraConfig && fieldMap) {
            let keysToFetch = jiraTickets.map((t) => t.key);
            if (keysToFetch.length === 0 && originalEvent.workerDetail) {
              keysToFetch = [...originalEvent.workerDetail.matchAll(JIRA_KEY_RE)].map((m) => m[1]);
            }
            if (keysToFetch.length > 0) {
              try {
                const fresh = await fetchJiraTicketsByKeys(productLine.jiraConfig as JiraConfig, keysToFetch, fieldMap);
                if (fresh && fresh.length > 0) jiraTickets = fresh;
              } catch { /* use stored */ }
            }
          }

          const commitCount = storedInput?.commits?.length ?? 0;
          const jiraKeys = jiraTickets.map((t) => t.key);

          const agentInputOverride: StoredAgentInput = storedInput
            ? { ...storedInput, jira: jiraTickets.length > 0 ? jiraTickets : (storedInput.jira ?? []), jiraBaseUrl }
            : { commits: [], filesChanged: [], diffSummary: "", jira: jiraTickets, jiraBaseUrl };

          try {
            const tempEvent = await prisma.triggerEvent.create({
              data: {
                productLineId,
                triggerId: originalEvent.triggerId,
                source: "manual",
                status: "rerun_pending",
                detail: `Batch re-run · Week ${isoWeek}/${year}`,
                repo,
                branch,
              },
            });

            await enqueueAgentJob({
              triggerEventId: tempEvent.id,
              triggerId: originalEvent.triggerId ?? undefined,
              productLineId,
              orgId,
              payload: { ref: `refs/heads/${branch}`, repository: { full_name: repo }, commits: [] },
              targetIsoWeek: isoWeek,
              targetYear: year,
              manualRun: true,
              agentInputOverride,
            });

            newEventIds.push(tempEvent.id);
            send({ type: "event_queued", index: i, newEventId: tempEvent.id, repo, branch, source: originalEvent.source, commitCount, jiraKeys });
          } catch (err) {
            send({ type: "event_error", index: i, repo, branch, message: String(err) });
          }
        }

        send({
          type: "complete",
          newEventIds,
          existingContent: existingUpdate?.content ?? null,
          existingUpdateId: existingUpdate?.id ?? null,
          originalWeekEvents,
          isoWeek,
          year,
        });

        controller.close();
      } catch (err) {
        send({ type: "error", message: String(err) });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
