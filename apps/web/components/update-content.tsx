"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown, Trash2, Telescope } from "lucide-react";
import { LocalTime } from "./local-time";

interface ParsedSection {
  headline: string;
  meta: string | null;
  bullets: string[];
  plainLines: string[];
  timestamp: string | null;
}

function parseSection(raw: string): ParsedSection {
  // Extract injected timestamp comment <!-- ts:ISO --> if present
  let timestamp: string | null = null;
  let source = raw.trim();
  const tsMatch = source.match(/^<!--\s*ts:([^\s>]+)\s*-->\n?/);
  if (tsMatch) {
    timestamp = tsMatch[1];
    source = source.slice(tsMatch[0].length).trimStart();
  }

  const lines = source.split("\n").filter(Boolean);
  const firstLine = lines[0] ?? "";
  const headlineMatch = firstLine.match(/^\*\*(.+)\*\*$/);
  const headline = headlineMatch?.[1] ?? firstLine;
  const bodyLines = headlineMatch ? lines.slice(1) : [];

  // Second line is meta if it doesn't start with "- "
  const possibleMeta = bodyLines[0];
  const hasMeta = !!possibleMeta && !possibleMeta.trim().startsWith("- ");
  const meta = hasMeta ? possibleMeta.trim() : null;
  const contentLines = hasMeta ? bodyLines.slice(1) : bodyLines;

  return {
    headline,
    meta,
    bullets: contentLines.filter((l) => l.trim().startsWith("- ")),
    plainLines: contentLines.filter((l) => !l.trim().startsWith("- ") && l.trim() !== ""),
    timestamp,
  };
}

const DATE_RE = /\s*·?\s*\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}\b/g;

// Renders a line that may contain Jira keys (bare or as [KEY](url)) and plain text
function InlineMeta({ text, jiraBaseUrl, timestamp }: { text: string; jiraBaseUrl?: string; timestamp?: string | null }) {
  // If we have a precise timestamp, strip the agent-written date — we'll show LocalTime instead
  const baseText = timestamp ? text.replace(DATE_RE, "").trim() : text;
  // Strip any existing [KEY](url) links to bare keys — avoids double-linking and removes stale URLs
  const stripped = baseText.replace(/\[([A-Z][A-Z0-9]+-\d+)\]\([^)]*\)/g, "$1");
  // Re-link bare keys using the configured domain
  const processed = jiraBaseUrl
    ? stripped.replace(/\b([A-Z][A-Z0-9]+-\d+)\b/g, (key) => `[${key}](${jiraBaseUrl}/browse/${key})`)
    : stripped;
  const parts = processed.split(/(\[[^\]]+\]\([^)]+\))/g);
  const hasVisibleParts = parts.some((p) => p.trim().length > 0);
  return (
    <span className="flex flex-wrap items-center gap-x-1 text-xs text-zinc-400 mt-0.5">
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (m) {
          return (
            <a
              key={i}
              href={m[2]}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-blue-500 hover:text-blue-700 font-medium"
            >
              {m[1]}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
      {timestamp && hasVisibleParts && <span>·</span>}
      {timestamp && <LocalTime iso={timestamp} className="text-xs text-zinc-400" />}
    </span>
  );
}

export function UpdateContent({
  content,
  jiraBaseUrl,
  onDeleteSection,
  onExploreSection,
}: {
  content: string;
  jiraBaseUrl?: string;
  onDeleteSection?: (index: number, headline: string) => void;
  onExploreSection?: (sectionContent: string, headline: string) => void;
}) {
  const rawSections = content
    .split(/\n\n---\n\n|\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  // Display newest first; track original index and raw content for callbacks
  const sections = rawSections
    .map((raw, originalIndex) => ({ ...parseSection(raw), originalIndex, raw }))
    .reverse();

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggle(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div className="space-y-1.5">
      {sections.length > 1 && (
        <p className="text-xs text-zinc-400 mb-2">{sections.length} pushes processed</p>
      )}
      {sections.map((section, i) => {
        const hasDetails = section.bullets.length > 0 || section.plainLines.length > 0;
        const isExpanded = expanded.has(i);
        return (
          <div key={i} className="group rounded-lg border border-zinc-100 overflow-hidden">
            <div className="flex items-stretch bg-white">
              <button
                type="button"
                onClick={() => hasDetails && toggle(i)}
                className={`flex-1 flex items-center justify-between gap-3 px-3 py-2.5 text-left min-w-0 ${
                  hasDetails ? "hover:bg-zinc-50 cursor-pointer" : "cursor-default"
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium text-zinc-900 leading-snug">
                    {section.headline}
                  </span>
                  {(section.meta || section.timestamp) && (
                    <InlineMeta text={section.meta ?? ""} jiraBaseUrl={jiraBaseUrl} timestamp={section.timestamp} />
                  )}
                </div>
                {hasDetails && (
                  isExpanded
                    ? <ChevronDown size={13} className="text-zinc-400 shrink-0" />
                    : <ChevronRight size={13} className="text-zinc-400 shrink-0" />
                )}
              </button>
              {(onExploreSection || onDeleteSection) && (
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 pr-1.5 transition-all shrink-0">
                  {onExploreSection && (
                    <button
                      type="button"
                      onClick={() => onExploreSection(section.raw, section.headline)}
                      className="p-1.5 text-zinc-300 hover:text-zinc-600 transition-colors rounded"
                      title="Explore how this was created"
                    >
                      <Telescope size={12} />
                    </button>
                  )}
                  {onDeleteSection && (
                    <button
                      type="button"
                      onClick={() => onDeleteSection(section.originalIndex, section.headline)}
                      className="p-1.5 text-zinc-300 hover:text-red-500 transition-colors rounded"
                      title="Delete this item"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
            {isExpanded && hasDetails && (
              <div className="px-3 pb-3 pt-1 border-t border-zinc-100 bg-zinc-50/50">
                {section.bullets.length > 0 && (
                  <ul className="space-y-1">
                    {section.bullets.map((b, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-zinc-600">
                        <span className="mt-2 w-1 h-1 rounded-full bg-zinc-400 shrink-0" />
                        <span>{b.replace(/^-\s+/, "")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.plainLines.map((l, j) => (
                  <p key={j} className="text-sm text-zinc-600 mt-1">{l}</p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
