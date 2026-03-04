import { anthropic } from "@ai-sdk/anthropic";
import { generateText, tool } from "ai";
import { z } from "zod";

export interface GitEvent {
  repo: string;
  branch: string;
  commits: Array<{ sha: string; message: string; author: string }>;
  diffSummary: string;
  filesChanged: string[];
}

export interface AgentProductLine {
  id: string;
  name: string;
  description?: string | null;
  systemPrompt: string;
  recentUpdates: Array<{ content: string; isoWeek: number; year: number }>;
}

export interface CircleCIContext {
  lastSuccessfulPipelineAt: string | null; // ISO date string
  lastSuccessfulCommitSha: string | null;
  unreleasedCommitCount: number | null;
}

export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  type: string;
}

export interface IntegrationContext {
  circleCI?: CircleCIContext;
  jira?: JiraTicket[];
}

export interface AgentOutput {
  productLineId: string;
  decision: "update_created" | "skipped";
  content?: string;
  skipReason?: string;
}

export async function runProductPulseAgent(
  productLines: AgentProductLine[],
  gitEvent: GitEvent,
  integrationContext?: Record<string, IntegrationContext>
): Promise<AgentOutput[]> {
  const outputs: AgentOutput[] = [];

  for (const productLine of productLines) {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: productLine.systemPrompt,
      prompt: buildPrompt(productLine, gitEvent, integrationContext?.[productLine.id]),
      tools: {
        create_update: tool({
          description:
            "Create a user-facing product update for this product line based on what was shipped.",
          parameters: z.object({
            content: z
              .string()
              .describe(
                "Markdown content for the update. Clear, concise, and written for end users — not engineers."
              ),
          }),
          execute: async ({ content }) => {
            outputs.push({
              productLineId: productLine.id,
              decision: "update_created",
              content,
            });
            return { success: true };
          },
        }),
        skip_update: tool({
          description:
            "Skip creating an update if this git push is not relevant to this product line.",
          parameters: z.object({
            reason: z
              .string()
              .describe("Brief reason why this push is not relevant."),
          }),
          execute: async ({ reason }) => {
            outputs.push({
              productLineId: productLine.id,
              decision: "skipped",
              skipReason: reason,
            });
            return { success: true };
          },
        }),
      },
      maxSteps: 3,
    });

    // Fallback if agent didn't call any tool
    if (!outputs.find((o) => o.productLineId === productLine.id)) {
      outputs.push({
        productLineId: productLine.id,
        decision: "skipped",
        skipReason: "Agent did not produce an output.",
      });
    }
  }

  return outputs;
}

function buildPrompt(
  productLine: AgentProductLine,
  gitEvent: GitEvent,
  context?: IntegrationContext
): string {
  const recentUpdatesText =
    productLine.recentUpdates.length > 0
      ? productLine.recentUpdates
          .map((u) => `Week ${u.isoWeek}/${u.year}:\n${u.content}`)
          .join("\n\n")
      : "No recent updates yet.";

  const circleCISection = context?.circleCI
    ? `
[CircleCI — Production Status]
Last successful deploy: ${context.circleCI.lastSuccessfulPipelineAt ?? "unknown"} (commit ${context.circleCI.lastSuccessfulCommitSha?.slice(0, 7) ?? "unknown"})
Commits not yet in production: ${context.circleCI.unreleasedCommitCount ?? "unknown"}
`
    : "";

  const jiraSection =
    context?.jira && context.jira.length > 0
      ? `
[Jira — Related Tickets]
${context.jira.map((t) => `- ${t.key} [${t.type}] "${t.summary}" (${t.status})`).join("\n")}
`
      : "";

  return `You are the Product Pulse agent for the "${productLine.name}" product line.
${productLine.description ? `Description: ${productLine.description}` : ""}

Recent updates for context:
${recentUpdatesText}
${circleCISection}${jiraSection}
A git push just happened:
Repository: ${gitEvent.repo}
Branch: ${gitEvent.branch}
Files changed: ${gitEvent.filesChanged.slice(0, 30).join(", ")}${gitEvent.filesChanged.length > 30 ? ` (+${gitEvent.filesChanged.length - 30} more)` : ""}

Commits:
${gitEvent.commits.map((c) => `- ${c.sha.slice(0, 7)} ${c.message} (${c.author})`).join("\n")}

Diff summary:
${gitEvent.diffSummary}

Decide:
1. Is this push relevant to the "${productLine.name}" product line?
2. If yes — call create_update with a clear, user-facing description of what was shipped.
3. If no — call skip_update with a brief reason.`;
}
