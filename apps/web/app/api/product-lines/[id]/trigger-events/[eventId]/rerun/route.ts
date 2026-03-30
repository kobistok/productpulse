import { NextRequest } from "next/server";
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
  if (!orgId) return new Response(JSON.stringify({ error: "No organization" }), { status: 400 });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: object) {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      }

      try {
        // ── Step 1: Load stored run data ──────────────────────────────────────
        send({ type: "step", label: "Loading stored run data", status: "running" });

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
          send({ type: "step", label: "Loading stored run data", status: "error", detail: "Run event not found" });
          send({ type: "error", message: "Not found" });
          controller.close();
          return;
        }

        const storedInput = originalEvent.agentInputData as StoredAgentInput | null;
        const commitCount = storedInput?.commits?.length ?? 0;
        send({
          type: "step",
          label: "Loading stored run data",
          status: "done",
          detail: commitCount > 0 ? `${commitCount} commit${commitCount !== 1 ? "s" : ""} found` : "No commits stored",
        });

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

        // ── Step 2: Check stored Jira tickets ────────────────────────────────
        let jiraTickets = storedInput?.jira ?? [];

        send({ type: "step", label: "Checking stored Jira tickets", status: "running" });
        if (jiraTickets.length > 0) {
          send({
            type: "step",
            label: "Checking stored Jira tickets",
            status: "done",
            detail: `${jiraTickets.length} stored: ${jiraTickets.map((t) => t.key).join(", ")}`,
          });
        } else {
          send({ type: "step", label: "Checking stored Jira tickets", status: "done", detail: "None stored" });
        }

        // ── Step 3: Extract keys from run details (if no stored tickets) ──────
        let keysFromDetail: string[] = [];
        if (jiraTickets.length === 0 && originalEvent.workerDetail) {
          keysFromDetail = [...originalEvent.workerDetail.matchAll(JIRA_KEY_RE)].map((m) => m[1]);
          if (keysFromDetail.length > 0) {
            send({
              type: "step",
              label: "Extracting Jira keys from run details",
              status: "done",
              detail: keysFromDetail.join(", "),
            });
          }
        }

        // ── Step 4: Fetch fresh Jira data ─────────────────────────────────────
        if (productLine.jiraConfig) {
          const keysToFetch =
            jiraTickets.length > 0
              ? jiraTickets.map((t) => t.key)
              : keysFromDetail;

          if (keysToFetch.length > 0) {
            const label =
              jiraTickets.length > 0
                ? `Refreshing Jira ticket${keysToFetch.length !== 1 ? "s" : ""}`
                : `Fetching Jira ticket${keysToFetch.length !== 1 ? "s" : ""}`;

            send({ type: "step", label, status: "running", detail: keysToFetch.join(", ") });

            // Fetch field map
            send({ type: "step", label: "Fetching Jira field map", status: "running" });
            const fieldMap = await fetchJiraFieldMap(productLine.jiraConfig as JiraConfig);
            send({ type: "step", label: "Fetching Jira field map", status: "done" });

            const fresh = await fetchJiraTicketsByKeys(
              productLine.jiraConfig as JiraConfig,
              keysToFetch,
              fieldMap
            );

            if (fresh && fresh.length > 0) {
              jiraTickets = fresh;
              send({
                type: "step",
                label,
                status: "done",
                detail: `${fresh.length} ticket${fresh.length !== 1 ? "s" : ""} fetched`,
              });
            } else {
              send({
                type: "step",
                label,
                status: "error",
                detail:
                  jiraTickets.length > 0
                    ? "Could not refresh — using stored data"
                    : "Could not fetch Jira tickets",
              });
            }
          }
        } else if (jiraTickets.length === 0) {
          // No Jira config — skip silently (no step needed)
        }

        // ── Step 5: Queue agent job ────────────────────────────────────────────
        const jiraBaseUrl = productLine.jiraConfig
          ? productLine.jiraConfig.atlassianDomain
            ? `https://${productLine.jiraConfig.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
            : productLine.jiraConfig.baseUrl.replace(/\/+$/, "")
          : (storedInput?.jiraBaseUrl ?? undefined);

        const agentInputOverride: StoredAgentInput = storedInput
          ? { ...storedInput, jira: jiraTickets.length > 0 ? jiraTickets : (storedInput.jira ?? []), jiraBaseUrl }
          : { commits: [], filesChanged: [], diffSummary: "", jira: jiraTickets, jiraBaseUrl };

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

        send({ type: "step", label: "Queueing agent job", status: "running" });
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
          send({ type: "step", label: "Queueing agent job", status: "done" });
        } catch (err) {
          await prisma.triggerEvent.update({ where: { id: tempEvent.id }, data: { status: "failed" } });
          send({ type: "step", label: "Queueing agent job", status: "error", detail: "Failed to queue" });
          send({ type: "error", message: "Failed to queue job" });
          controller.close();
          return;
        }

        // ── Final ─────────────────────────────────────────────────────────────
        send({
          type: "done",
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
