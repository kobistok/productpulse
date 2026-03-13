"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface ParsedSection {
  headline: string;
  bullets: string[];
  plainLines: string[];
}

function parseSection(raw: string): ParsedSection {
  const lines = raw.trim().split("\n").filter(Boolean);
  const firstLine = lines[0] ?? "";
  const headlineMatch = firstLine.match(/^\*\*(.+)\*\*$/);
  const headline = headlineMatch?.[1] ?? firstLine;
  const bodyLines = headlineMatch ? lines.slice(1) : [];
  return {
    headline,
    bullets: bodyLines.filter((l) => l.trim().startsWith("- ")),
    plainLines: bodyLines.filter((l) => !l.trim().startsWith("- ") && l.trim() !== ""),
  };
}

export function UpdateContent({ content }: { content: string }) {
  const sections = content
    .split(/\n\n---\n\n|\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseSection);

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
        <p className="text-xs text-zinc-400 mb-2">
          {sections.length} pushes processed
        </p>
      )}
      {sections.map((section, i) => {
        const hasDetails = section.bullets.length > 0 || section.plainLines.length > 0;
        const isExpanded = expanded.has(i);
        return (
          <div key={i} className="rounded-lg border border-zinc-100 overflow-hidden">
            <button
              type="button"
              onClick={() => hasDetails && toggle(i)}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left bg-white ${
                hasDetails ? "hover:bg-zinc-50 cursor-pointer" : "cursor-default"
              }`}
            >
              <span className="text-sm font-medium text-zinc-900 leading-snug">
                {section.headline}
              </span>
              {hasDetails && (
                isExpanded
                  ? <ChevronDown size={13} className="text-zinc-400 shrink-0" />
                  : <ChevronRight size={13} className="text-zinc-400 shrink-0" />
              )}
            </button>
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
