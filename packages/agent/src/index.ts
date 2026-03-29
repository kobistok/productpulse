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
  filterRule?: string | null; // optional filter: skip if condition not met
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
- If there are Jira tickets: KEY · Date  e.g. PROJ-123 · March 16, 2026
- Multiple tickets: PROJ-123 PROJ-456 · Date
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
  description?: string | null;
  assignee?: string | null;
  reporter?: string | null;
  priority?: string | null;
  labels?: string[];
  components?: string[];
  fixVersions?: string[];
  created?: string | null;
  updated?: string | null;
  resolution?: string | null;
  customFields?: Array<{ name: string; value: string }>;
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
  integrationContext?: Record<string, IntegrationContext>,
  options?: { forceRun?: boolean }
): Promise<AgentOutput[]> {
  const outputs: AgentOutput[] = [];
  const forceRun = options?.forceRun ?? false;

  for (const productLine of productLines) {
    const result = await generateText({
      model: anthropic("claude-sonnet-4-6"),
      system: SYSTEM_PROMPT,
      prompt: buildPrompt(productLine, gitEvent, integrationContext?.[productLine.id], forceRun),
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
        ...(!forceRun && {
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

export interface ContentAgentInput {
  name: string;
  specificContext: string | null;
  outputTypes: string[];
  orgSkills: Array<{ name: string; content: string }>;
  productLineUpdates: Array<{ productLineName: string; content: string; isoWeek: number; year: number }>;
}

export interface ContentAgentOutput {
  outputType: string;
  title: string;
  content: string;
}

const CONTENT_AGENT_SYSTEM_PROMPT = `You are a content agent that transforms internal product updates into polished customer-facing content.

Your role:
- Read the provided product line updates (written for engineers/stakeholders)
- Apply the provided org skills (tone, style, format guidelines)
- Produce customer-facing content that is clear, engaging, and appropriately scoped

Output types:
- "kb": A knowledge base article. Structured, instructional, written for users who need to understand or use a feature.
- "customer_update": A concise customer-facing release note or update summary. Highlights what's new and why it matters.

Always use the tools provided to create your outputs. Do not produce any text outside of tool calls.`;

export async function runContentAgent(input: ContentAgentInput): Promise<ContentAgentOutput[]> {
  const outputs: ContentAgentOutput[] = [];

  const skillsSection = input.orgSkills.length > 0
    ? `\n## Org Skills (style/format guidelines)\n${input.orgSkills.map(s => `### ${s.name}\n${s.content}`).join("\n\n")}\n`
    : "";

  const updatesSection = input.productLineUpdates.length > 0
    ? `\n## Product Line Updates\n${input.productLineUpdates.map(u => `### ${u.productLineName} (Week ${u.isoWeek}/${u.year})\n${u.content}`).join("\n\n")}\n`
    : "\n## Product Line Updates\nNo updates available for the selected timeframe.\n";

  const contextSection = input.specificContext
    ? `\n## Specific Context\n${input.specificContext}\n`
    : "";

  const outputTypesSection = `\n## Required Output Types\nCreate content for the following types: ${input.outputTypes.join(", ")}\n`;

  const prompt = `You are the "${input.name}" content agent.
${contextSection}${outputTypesSection}${skillsSection}${updatesSection}
Review the product line updates above and produce the requested customer-facing content. Apply the org skills as style and format guidelines. Use the provided tools to submit each piece of content.`;

  const allTools = {
    create_kb_article: tool({
      description: "Create a knowledge base article for customers explaining a feature or change.",
      parameters: z.object({
        title: z.string().describe("The title of the KB article"),
        content: z.string().describe("The full markdown content of the KB article"),
      }),
      execute: async ({ title, content }) => {
        outputs.push({ outputType: "kb", title, content });
        return { success: true };
      },
    }),
    create_customer_update: tool({
      description: "Create a customer-facing release note or update summary.",
      parameters: z.object({
        title: z.string().describe("The title of the customer update"),
        content: z.string().describe("The full markdown content of the customer update"),
      }),
      execute: async ({ title, content }) => {
        outputs.push({ outputType: "customer_update", title, content });
        return { success: true };
      },
    }),
  };

  // Only expose tools matching the requested output types
  const tools = Object.fromEntries(
    Object.entries(allTools).filter(([key]) => {
      if (key === "create_kb_article") return input.outputTypes.includes("kb");
      if (key === "create_customer_update") return input.outputTypes.includes("customer_update");
      return false;
    })
  ) as typeof allTools;

  await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: CONTENT_AGENT_SYSTEM_PROMPT,
    prompt,
    tools,
    toolChoice: "required",
    maxSteps: 5,
  });

  return outputs;
}

export interface DriveDoc {
  id: string;
  name: string;
  content: string;
}

export async function runContentRefinementAgent(
  draft: ContentAgentOutput,
  driveDocs: DriveDoc[]
): Promise<ContentAgentOutput> {
  if (driveDocs.length === 0) return draft;

  const docsSection = driveDocs
    .map((d, i) => `### Document ${i + 1}: ${d.name}\n${d.content}`)
    .join("\n\n");

  const typeLabel = draft.outputType === "kb" ? "KB Article" : "Customer Update";

  const { text } = await generateText({
    model: anthropic("claude-sonnet-4-6"),
    system: `You are refining a customer-facing ${typeLabel} using additional company documentation from Google Drive.
Improve the draft by incorporating relevant specifics, accurate details, and context from the documents.
Rules:
- Keep the same tone, format, and structure as the draft
- Only add information that genuinely improves accuracy or usefulness
- Do not pad or lengthen unnecessarily — quality over quantity
- If the documents contain nothing relevant, return the draft unchanged
- Return ONLY the refined content, no preamble or explanation`,
    prompt: `## Draft ${typeLabel}: ${draft.title}

${draft.content}

## Company documentation from Google Drive

${docsSection}

Refine the draft using any relevant information from the documents above. Return only the refined content.`,
  });

  return { ...draft, content: text };
}

function buildPrompt(
  productLine: AgentProductLine,
  gitEvent: GitEvent,
  context?: IntegrationContext,
  forceRun?: boolean
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
  const lines = [`- ${t.key} [${t.type}] "${t.summary}" (${t.status})`];
  if (t.assignee) lines.push(`  Assignee: ${t.assignee}`);
  if (t.reporter) lines.push(`  Reporter: ${t.reporter}`);
  if (t.priority) lines.push(`  Priority: ${t.priority}`);
  if (t.labels && t.labels.length > 0) lines.push(`  Labels: ${t.labels.join(", ")}`);
  if (t.components && t.components.length > 0) lines.push(`  Components: ${t.components.join(", ")}`);
  if (t.fixVersions && t.fixVersions.length > 0) lines.push(`  Fix versions: ${t.fixVersions.join(", ")}`);
  if (t.description) lines.push(`  Description: ${t.description}`);
  if (t.resolution) lines.push(`  Resolution: ${t.resolution}`);
  if (t.customFields && t.customFields.length > 0) {
    for (const cf of t.customFields) lines.push(`  ${cf.name}: ${cf.value}`);
  }
  return lines.join("\n");
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

${forceRun ? `This is a manual re-run. You MUST call create_update — do not skip. Use all available context (commits, Jira tickets, CircleCI status, product context) to write a meaningful update. If commits are empty, base the update on the integration data and product context.

` : productLine.filterRule ? `Filter — only create an update if ALL of the following conditions are met:
${productLine.filterRule}
If this filter condition is NOT satisfied by this push or its Jira context, call skip_update.

` : ""}${forceRun ? `Call create_update with a clear, user-facing description based on the available context. Your content will be appended to this week's update — do not repeat or rewrite anything already written this week.` : `Decide:
1. Is this push relevant to the "${productLine.name}" product line?
2. Does it satisfy the filter above (if any)?
3. If yes to both — call create_update with a clear, user-facing description of ONLY what was shipped in THIS push. Your content will be appended to this week's update — do not repeat or rewrite anything already written this week.
4. If no — call skip_update with a brief reason.`}`;
}
