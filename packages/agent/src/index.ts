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
  productContext?: string | null; // optional context provided by the user
  recentUpdates: Array<{ content: string; isoWeek: number; year: number }>;
  currentWeekContent?: string | null; // existing update for this week, if any
}

const SYSTEM_PROMPT = `You are a product update agent. Your job is to monitor git pushes and decide whether they contain user-facing changes worth reporting.

Guidelines:
- Only create updates for changes that affect end users: new features, bug fixes, UX improvements, performance wins
- Skip: internal refactors, infrastructure changes, dependency bumps, test-only changes, CI config
- Write in clear, non-technical language that a non-engineer stakeholder can understand
- Use past tense: "Improved...", "Fixed...", "Users can now..."

Output format — always use this exact structure:
**[Short headline summarising the change]**
[metadata line — see below]

- What changed or what users can now do (1 concise sentence)
- Another change if relevant (1 concise sentence)
- Bug fix or improvement if relevant (1 concise sentence)

Metadata line rules:
- If there are Jira tickets: [KEY](url) · Date  e.g. [PROJ-123](https://company.atlassian.net/browse/PROJ-123) · March 16, 2026
- Multiple tickets: [PROJ-123](url) [PROJ-456](url) · Date
- If no Jira tickets: just the date  e.g. March 16, 2026

Keep it to 1 headline + metadata + 2–4 bullets. No paragraphs. No intro text before or after.`;

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
  jiraBaseUrl?: string;
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
      system: SYSTEM_PROMPT,
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
  const currentWeekSection = productLine.currentWeekContent
    ? `This week's update so far (you are ADDING to it — do NOT rewrite or repeat what's already there):\n${productLine.currentWeekContent}\n\n`
    : "";

  const recentUpdatesText =
    productLine.recentUpdates.length > 0
      ? productLine.recentUpdates
          .map((u) => `Week ${u.isoWeek}/${u.year}:\n${u.content}`)
          .join("\n\n")
      : "No previous weekly updates yet.";

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
${context.jira.map((t) => {
  const url = context.jiraBaseUrl ? `${context.jiraBaseUrl}/browse/${t.key}` : null;
  return `- ${t.key} [${t.type}] "${t.summary}" (${t.status})${url ? ` — ${url}` : ""}`;
}).join("\n")}
`
      : "";

  const contextSection = [
    productLine.description ? `Description: ${productLine.description}` : "",
    productLine.productContext ? `Product context: ${productLine.productContext}` : "",
  ].filter(Boolean).join("\n");

  const today = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return `You are the Product Pulse agent for the "${productLine.name}" product line.
Today's date: ${today}
${contextSection}

${currentWeekSection}Recent updates from previous weeks (for context only):
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
2. If yes — call create_update with a clear, user-facing description of ONLY what was shipped in THIS push. Your content will be appended to this week's update — do not repeat or rewrite anything already written this week.
3. If no — call skip_update with a brief reason.`;
}
