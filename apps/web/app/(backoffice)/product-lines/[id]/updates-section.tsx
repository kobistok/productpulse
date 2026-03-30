"use client";

import { useState } from "react";
import { UpdateContent } from "@/components/update-content";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { X, RefreshCw, Check } from "lucide-react";
import Link from "next/link";
import type { StoredAgentInput } from "@/lib/cloud-tasks";

type UpdateRow = {
  id: string;
  isoWeek: number;
  year: number;
  content: string;
  updatedAt: string;
};

type WorkflowEvent = {
  id: string;
  createdAt: string;
  repo: string | null;
  branch: string | null;
  source: string;
  updateContent: string | null;
  workerDetail: string | null;
  agentInputData: StoredAgentInput | null;
};

type WorkflowData = {
  update: UpdateRow;
  agent: { filterRule: string | null; productContext: string | null } | null;
  triggerEvents: WorkflowEvent[];
};

interface Props {
  productLineId: string;
  currentWeek: number;
  currentYear: number;
  updates: UpdateRow[];
  jiraBaseUrl?: string;
  hasAgent: boolean;
  hasTriggersConfigured: boolean;
}

// Strip the <!-- ts:ISO --> comment that the worker prepends to each section
function stripTsComment(raw: string): string {
  return raw.replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "").trimStart();
}

export function UpdatesSection({
  productLineId,
  currentWeek,
  currentYear,
  updates,
  jiraBaseUrl,
  hasAgent,
  hasTriggersConfigured,
}: Props) {
  const [localUpdates, setLocalUpdates] = useState(updates);

  // Explore state
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreData, setExploreData] = useState<WorkflowData | null>(null);
  const [exploreSectionContent, setExploreSectionContent] = useState<string | null>(null);
  const [exploreSectionHeadline, setExploreSectionHeadline] = useState<string | null>(null);

  // Delete state
  const [sectionDeleteTarget, setSectionDeleteTarget] = useState<{
    update: UpdateRow;
    sectionIndex: number;
    headline: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const thisWeekUpdate = localUpdates.find(
    (u) => u.isoWeek === currentWeek && u.year === currentYear
  );
  const previousUpdates = localUpdates.filter(
    (u) => !(u.isoWeek === currentWeek && u.year === currentYear)
  );

  async function openExplore(updateId: string, sectionContent: string, headline: string) {
    setExploreOpen(true);
    setExploreLoading(true);
    setExploreData(null);
    setExploreSectionContent(sectionContent);
    setExploreSectionHeadline(headline);
    const res = await fetch(`/api/product-lines/${productLineId}/updates/${updateId}`);
    if (res.ok) setExploreData(await res.json());
    setExploreLoading(false);
  }

  // Find the trigger event that generated this specific section
  function matchedEvent(data: WorkflowData, sectionContent: string): WorkflowEvent | null {
    const stripped = stripTsComment(sectionContent).trim();
    return (
      data.triggerEvents.find(
        (ev) => ev.updateContent && ev.updateContent.trim() === stripped
      ) ?? null
    );
  }

  async function handleDeleteSection() {
    if (!sectionDeleteTarget) return;
    setDeleting(true);
    const { update, sectionIndex } = sectionDeleteTarget;

    const parts = update.content.split(/\n\n---\n\n|\n---\n/).map((s) => s.trim()).filter(Boolean);
    parts.splice(sectionIndex, 1);
    const newContent = parts.join("\n\n---\n\n");

    const res = await fetch(`/api/product-lines/${productLineId}/updates/${update.id}`, {
      method: newContent ? "PATCH" : "DELETE",
      ...(newContent
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: newContent }) }
        : {}),
    });

    if (res.ok) {
      const data = (await res.json()) as { deleted?: boolean; content?: string };
      if (data.deleted) {
        setLocalUpdates((prev) => prev.filter((u) => u.id !== update.id));
      } else if (data.content) {
        setLocalUpdates((prev) =>
          prev.map((u) => (u.id === update.id ? { ...u, content: data.content! } : u))
        );
      }
      setSectionDeleteTarget(null);
    }
    setDeleting(false);
  }

  function makeExploreHandler(update: UpdateRow) {
    return (sectionContent: string, headline: string) =>
      openExplore(update.id, sectionContent, headline);
  }

  function makeDeleteHandler(update: UpdateRow) {
    return (idx: number, headline: string) =>
      setSectionDeleteTarget({ update, sectionIndex: idx, headline });
  }

  return (
    <>
      {/* This week */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">This week (W{currentWeek})</h2>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          {thisWeekUpdate ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs text-zinc-400">W{thisWeekUpdate.isoWeek} {thisWeekUpdate.year}</p>
                <span className="text-xs text-zinc-300">·</span>
                <LocalTime iso={thisWeekUpdate.updatedAt} className="text-xs text-zinc-400" />
              </div>
              <UpdateContent
                content={thisWeekUpdate.content}
                jiraBaseUrl={jiraBaseUrl}
                onExploreSection={makeExploreHandler(thisWeekUpdate)}
                onDeleteSection={makeDeleteHandler(thisWeekUpdate)}
              />
            </>
          ) : (
            <p className="text-sm text-zinc-400 italic">
              No update generated yet this week.{" "}
              {!hasAgent && (
                <Link href={`/product-lines/${productLineId}/agent`} className="text-zinc-600 underline underline-offset-2">
                  Configure an agent
                </Link>
              )}{" "}
              {!hasTriggersConfigured && (
                <Link href={`/product-lines/${productLineId}/triggers`} className="text-zinc-600 underline underline-offset-2">
                  Add a git trigger
                </Link>
              )}
            </p>
          )}
        </div>
      </section>

      {/* Recent updates */}
      {previousUpdates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Recent updates</h2>
          <div className="space-y-3">
            {previousUpdates.map((u) => (
              <div key={u.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-medium text-zinc-400">W{u.isoWeek} {u.year}</p>
                  <span className="text-xs text-zinc-300">·</span>
                  <LocalTime iso={u.updatedAt} className="text-xs text-zinc-400" />
                </div>
                <UpdateContent
                  content={u.content}
                  jiraBaseUrl={jiraBaseUrl}
                  onExploreSection={makeExploreHandler(u)}
                  onDeleteSection={makeDeleteHandler(u)}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Explore modal ─────────────────────────────────────────────────── */}
      {exploreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setExploreOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Agent Workflow</p>
                {exploreSectionHeadline && (
                  <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-md">{exploreSectionHeadline}</p>
                )}
              </div>
              <button onClick={() => setExploreOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
              {exploreLoading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-zinc-400">
                  <RefreshCw size={14} className="animate-spin" />
                  <span className="text-sm">Loading…</span>
                </div>
              ) : exploreData ? (
                <>
                  {/* Agent configuration */}
                  <section>
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                      Agent configuration
                    </p>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-medium text-zinc-600 mb-1">Product context</p>
                        {exploreData.agent?.productContext ? (
                          <p className="text-xs text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded-lg px-3 py-2">
                            {exploreData.agent.productContext}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">Not configured</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-zinc-600 mb-1">Filter rule</p>
                        {exploreData.agent?.filterRule ? (
                          <p className="text-xs text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded-lg px-3 py-2">
                            {exploreData.agent.filterRule}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-400 italic">
                            No filter rule — agent uses default guidelines
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* The run that generated this specific item */}
                  <section>
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                      Run that generated this item
                    </p>
                    {(() => {
                      const ev = exploreSectionContent
                        ? matchedEvent(exploreData, exploreSectionContent)
                        : null;
                      if (ev) {
                        return <RunCard ev={ev} jiraBaseUrl={jiraBaseUrl} />;
                      }
                      // Fallback: show all runs for the week if no match
                      if (exploreData.triggerEvents.length === 0) {
                        return (
                          <p className="text-xs text-zinc-400 italic">
                            No matching run found. This item may have been created before run tracking was introduced.
                          </p>
                        );
                      }
                      return (
                        <>
                          <p className="text-xs text-zinc-400 italic mb-3">
                            Could not match to a specific run — showing all runs for this week.
                          </p>
                          <div className="space-y-4">
                            {exploreData.triggerEvents.map((e) => (
                              <RunCard key={e.id} ev={e} jiraBaseUrl={jiraBaseUrl} />
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </section>
                </>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-12">Failed to load workflow data.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete section confirmation ────────────────────────────────────── */}
      {sectionDeleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSectionDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-zinc-900 mb-1">Delete this item?</p>
            <p className="text-xs text-zinc-600 font-medium mb-1">{sectionDeleteTarget.headline}</p>
            <p className="text-xs text-zinc-400 mb-5">This cannot be undone.</p>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setSectionDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDeleteSection}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white border-0"
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RunCard({ ev, jiraBaseUrl }: { ev: WorkflowEvent; jiraBaseUrl?: string }) {
  const input = ev.agentInputData;
  const commits = input?.commits ?? [];
  const jiraTickets = input?.jira ?? [];
  const filesChanged = input?.filesChanged ?? [];
  const effectiveJiraBaseUrl = input?.jiraBaseUrl ?? jiraBaseUrl;

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-4 py-2.5 bg-zinc-50 flex items-center gap-2 flex-wrap text-xs text-zinc-600">
        <LocalTime iso={ev.createdAt} className="text-zinc-500" />
        <span className="text-zinc-300">·</span>
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${
          ev.source === "webhook"
            ? "bg-blue-50 text-blue-700 border-blue-200"
            : "bg-zinc-100 text-zinc-500 border-zinc-200"
        }`}>
          {ev.source}
        </span>
        {ev.repo && <span className="font-mono text-zinc-500">{ev.repo}</span>}
        {ev.branch && (
          <>
            <span className="text-zinc-300">·</span>
            <span className="font-mono text-zinc-500">{ev.branch}</span>
          </>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {commits.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Commits</p>
            <ul className="space-y-0.5">
              {commits.map((c) => (
                <li key={c.sha} className="text-xs text-zinc-600">
                  <span className="font-mono text-zinc-400">{c.sha.slice(0, 7)}</span>{" "}
                  {c.message}
                  {c.author && <span className="text-zinc-400"> · {c.author}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {jiraTickets.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">Jira tickets</p>
            <ul className="space-y-1">
              {jiraTickets.map((t) => (
                <li key={t.key} className="flex items-start gap-2 text-xs">
                  {effectiveJiraBaseUrl ? (
                    <a
                      href={`${effectiveJiraBaseUrl}/browse/${t.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-blue-600 hover:underline"
                    >
                      {t.key}
                    </a>
                  ) : (
                    <span className="shrink-0 font-mono text-blue-600">{t.key}</span>
                  )}
                  <span className="text-zinc-600">{t.summary}</span>
                  <span className="shrink-0 ml-auto text-zinc-400">{t.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {filesChanged.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Files changed</p>
            <p className="text-xs text-zinc-500">{filesChanged.length} file{filesChanged.length !== 1 ? "s" : ""}</p>
          </div>
        )}

        {commits.length === 0 && jiraTickets.length === 0 && filesChanged.length === 0 && (
          <p className="text-xs text-zinc-400 italic">No input context stored for this run.</p>
        )}

        {ev.updateContent && (
          <div className="border-t border-zinc-100 pt-3">
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Check size={10} className="text-green-500" /> Generated update
            </p>
            <pre className="whitespace-pre-wrap text-xs text-zinc-700 font-sans leading-relaxed">
              {ev.updateContent}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
