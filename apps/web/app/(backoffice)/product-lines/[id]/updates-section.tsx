"use client";

import { useState } from "react";
import { UpdateContent } from "@/components/update-content";
import { LocalTime } from "@/components/local-time";
import { Button } from "@/components/ui/button";
import { Telescope, Trash2, X, RefreshCw, Check } from "lucide-react";
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
  const [exploreOpen, setExploreOpen] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreData, setExploreData] = useState<WorkflowData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UpdateRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const thisWeekUpdate = localUpdates.find(
    (u) => u.isoWeek === currentWeek && u.year === currentYear
  );
  const previousUpdates = localUpdates.filter(
    (u) => !(u.isoWeek === currentWeek && u.year === currentYear)
  );

  async function openExplore(updateId: string) {
    setExploreOpen(true);
    setExploreLoading(true);
    setExploreData(null);
    const res = await fetch(`/api/product-lines/${productLineId}/updates/${updateId}`);
    if (res.ok) setExploreData(await res.json());
    setExploreLoading(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/product-lines/${productLineId}/updates/${deleteTarget.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setLocalUpdates((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    }
    setDeleting(false);
  }

  return (
    <>
      {/* This week */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">This week (W{currentWeek})</h2>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          {thisWeekUpdate ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <LocalTime iso={thisWeekUpdate.updatedAt} className="text-xs text-zinc-400" />
                <UpdateActions
                  update={thisWeekUpdate}
                  onExplore={openExplore}
                  onDelete={() => setDeleteTarget(thisWeekUpdate)}
                />
              </div>
              <UpdateContent content={thisWeekUpdate.content} jiraBaseUrl={jiraBaseUrl} />
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
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-zinc-400">W{u.isoWeek} {u.year}</p>
                    <span className="text-xs text-zinc-300">·</span>
                    <LocalTime iso={u.updatedAt} className="text-xs text-zinc-400" />
                  </div>
                  <UpdateActions
                    update={u}
                    onExplore={openExplore}
                    onDelete={() => setDeleteTarget(u)}
                  />
                </div>
                <UpdateContent content={u.content} jiraBaseUrl={jiraBaseUrl} />
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
                {exploreData && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Week {exploreData.update.isoWeek} · {exploreData.update.year}
                  </p>
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
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Agent configuration</p>
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
                          <p className="text-xs text-zinc-400 italic">No filter rule — agent uses default guidelines</p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Contributing runs */}
                  <section>
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                      Contributing runs ({exploreData.triggerEvents.length})
                    </p>
                    {exploreData.triggerEvents.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic">
                        No matching runs found for this week. This update may have been created before run tracking was introduced.
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {exploreData.triggerEvents.map((ev) => (
                          <RunCard key={ev.id} ev={ev} jiraBaseUrl={jiraBaseUrl} />
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <p className="text-sm text-zinc-400 text-center py-12">Failed to load workflow data.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ────────────────────────────────────────────── */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-zinc-900 mb-1">Delete update?</p>
            <p className="text-xs text-zinc-500 mb-5">
              This will permanently delete the Week {deleteTarget.isoWeek}/{deleteTarget.year} update. This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleDelete}
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

function UpdateActions({
  update,
  onExplore,
  onDelete,
}: {
  update: UpdateRow;
  onExplore: (id: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={() => onExplore(update.id)}
        className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-colors rounded-md hover:bg-zinc-100"
        title="Explore agent workflow"
      >
        <Telescope size={13} />
      </button>
      <button
        onClick={onDelete}
        className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors rounded-md hover:bg-red-50"
        title="Delete update"
      >
        <Trash2 size={13} />
      </button>
    </div>
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
      {/* Run header */}
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
        {ev.repo && <span className="text-zinc-500 font-mono">{ev.repo}</span>}
        {ev.branch && (
          <>
            <span className="text-zinc-300">·</span>
            <span className="text-zinc-500 font-mono">{ev.branch}</span>
          </>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Commits */}
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

        {/* Jira tickets */}
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

        {/* Files changed */}
        {filesChanged.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-1">Files changed</p>
            <p className="text-xs text-zinc-500">{filesChanged.length} file{filesChanged.length !== 1 ? "s" : ""}</p>
          </div>
        )}

        {/* No context at all */}
        {commits.length === 0 && jiraTickets.length === 0 && filesChanged.length === 0 && (
          <p className="text-xs text-zinc-400 italic">No input context stored for this run.</p>
        )}

        {/* Generated content */}
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
