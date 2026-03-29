/**
 * Shared Jira API utilities used by the worker and rerun route.
 */

export type JiraConfig = {
  baseUrl: string;
  email: string;
  apiToken: string;
  atlassianDomain?: string | null;
};

// ── Field map ─────────────────────────────────────────────────────────────────

/** Fetch all field definitions and return a map of fieldId → human readable name. */
export async function fetchJiraFieldMap(
  config: JiraConfig
): Promise<Map<string, string>> {
  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    const res = await fetch(`${config.baseUrl}/rest/api/3/field`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });
    if (!res.ok) return new Map();
    const fields = (await res.json()) as Array<{ id: string; name: string; custom?: boolean }>;
    const map = new Map<string, string>();
    for (const f of fields) {
      map.set(f.id, f.name);
    }
    return map;
  } catch {
    return new Map();
  }
}

// ── Issue parsing ─────────────────────────────────────────────────────────────

type JiraIssueResponse = {
  fields: Record<string, unknown> & {
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

function parseAdfDescription(description: unknown): string | null {
  if (typeof description === "string") return description;
  if (
    description &&
    typeof description === "object" &&
    Array.isArray((description as { content?: unknown[] }).content)
  ) {
    return (
      (description as { content: unknown[] }).content
        .flatMap((block: unknown) => {
          const b = block as { content?: Array<{ text?: string }> };
          return (b.content ?? []).map((c) => c.text ?? "").filter(Boolean);
        })
        .join(" ") || null
    );
  }
  return null;
}

function parseCustomFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value || null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => {
        if (typeof v === "string") return v;
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          return (o.value ?? o.name ?? o.displayName ?? o.key ?? null);
        }
        return null;
      })
      .filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(", ") : null;
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const scalar = o.value ?? o.name ?? o.displayName ?? o.key;
    if (scalar !== undefined && scalar !== null) return String(scalar);
    return null;
  }
  return null;
}

export type ParsedJiraTicket = {
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
};

export function parseJiraIssue(
  key: string,
  issue: JiraIssueResponse,
  fieldMap?: Map<string, string>
): ParsedJiraTicket {
  const f = issue.fields;

  const customFields: Array<{ name: string; value: string }> = [];
  if (fieldMap && fieldMap.size > 0) {
    for (const [fieldId, fieldName] of fieldMap.entries()) {
      if (!fieldId.startsWith("customfield_")) continue;
      const raw = f[fieldId];
      if (raw === undefined || raw === null) continue;
      const parsed = parseCustomFieldValue(raw);
      if (parsed) customFields.push({ name: fieldName, value: parsed });
    }
  }

  return {
    key,
    summary: f.summary,
    status: f.status.name,
    type: f.issuetype.name,
    description: parseAdfDescription(f.description),
    assignee: (f.assignee as { displayName?: string } | null)?.displayName ?? null,
    reporter: (f.reporter as { displayName?: string } | null)?.displayName ?? null,
    priority: (f.priority as { name?: string } | null)?.name ?? null,
    labels: (f.labels as string[] | undefined) ?? [],
    components: ((f.components as Array<{ name?: string }> | undefined) ?? [])
      .map((c) => c.name ?? "")
      .filter(Boolean),
    fixVersions: ((f.fixVersions as Array<{ name?: string }> | undefined) ?? [])
      .map((v) => v.name ?? "")
      .filter(Boolean),
    created: (f.created as string | undefined) ?? null,
    updated: (f.updated as string | undefined) ?? null,
    resolution: (f.resolution as { name?: string } | null)?.name ?? null,
    ...(customFields.length > 0 && { customFields }),
  };
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

/** Fetch Jira tickets referenced in commit messages. */
export async function fetchJiraTickets(
  config: JiraConfig,
  commitMessages: string[],
  fieldMap?: Map<string, string>
): Promise<ParsedJiraTicket[]> {
  const keys = [
    ...new Set(commitMessages.flatMap((m) => [...m.matchAll(JIRA_KEY_RE)].map((r) => r[1]))),
  ];
  if (keys.length === 0) return [];
  return (await fetchJiraTicketsByKeys(config, keys, fieldMap)) ?? [];
}

/** Fetch Jira tickets by explicit keys. Returns null on total failure. */
export async function fetchJiraTicketsByKeys(
  config: JiraConfig,
  keys: string[],
  fieldMap?: Map<string, string>
): Promise<ParsedJiraTicket[] | null> {
  if (keys.length === 0) return null;
  try {
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString("base64");
    const results = await Promise.allSettled(
      keys.map(async (key) => {
        const res = await fetch(`${config.baseUrl}/rest/api/3/issue/${key}`, {
          headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
        });
        if (!res.ok) return null;
        return parseJiraIssue(key, (await res.json()) as JiraIssueResponse, fieldMap);
      })
    );
    const tickets = results
      .filter(
        (r): r is PromiseFulfilledResult<ParsedJiraTicket> =>
          r.status === "fulfilled" && r.value !== null
      )
      .map((r) => r.value);
    return tickets.length > 0 ? tickets : null;
  } catch {
    return null;
  }
}
