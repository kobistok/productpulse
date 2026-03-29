"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Play, Zap, RefreshCw, X } from "lucide-react";
import type { GitTrigger } from "@productpulse/db";
import type { TriggerEventWithTrigger } from "./page";

interface Props {
  productLineId: string;
  triggers: GitTrigger[];
  appUrl: string;
  hasAgent: boolean;
  initialEvents: TriggerEventWithTrigger[];
}

export function TriggersClient({ productLineId, triggers: initial, appUrl, hasAgent, initialEvents }: Props) {
  const [triggers, setTriggers] = useState(initial);
  const [events, setEvents] = useState<TriggerEventWithTrigger[]>(initialEvents);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch enriched events on mount to populate updateContent
  useEffect(() => {
    fetch(`/api/product-lines/${productLineId}/trigger-events`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setEvents(data); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll while any event is queued but has no agent decision yet
  useEffect(() => {
    const hasPending = events.some((e) => e.status === "queued" && !e.agentDecision);
    if (!hasPending) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    if (pollingRef.current) return; // already polling
    pollingRef.current = setInterval(async () => {
      const res = await fetch(`/api/product-lines/${productLineId}/trigger-events`);
      if (!res.ok) return;
      const fresh: TriggerEventWithTrigger[] = await res.json();
      setEvents(fresh);
      const stillPending = fresh.some((e) => e.status === "queued" && !e.agentDecision);
      if (!stillPending && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    }, 3000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [events, productLineId]);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<"queued" | "error" | null>(null);

  // New trigger form state
  const [provider, setProvider] = useState<"GITHUB" | "GITLAB">("GITHUB");
  const [repoUrl, setRepoUrl] = useState("");
  const [branchFilter, setBranchFilter] = useState("main");
  const [pathFilter, setPathFilter] = useState("");
  const [creating, setCreating] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch(`/api/product-lines/${productLineId}/triggers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, repoUrl, branchFilter, pathFilter }),
    });
    if (res.ok) {
      const trigger = await res.json();
      (window as any).pendo?.track("git_trigger_created", {
        product_line_id: productLineId,
        trigger_id: trigger.id,
        has_repo_url: Boolean(repoUrl.trim()),
        branch_filter: branchFilter || "none",
        has_path_filter: Boolean(pathFilter.trim()),
      });
      // Track onboarding_completed when the first trigger is created
      if (triggers.length === 0) {
        (window as any).pendo?.track("onboarding_completed", {
          product_line_id: productLineId,
        });
      }
      setTriggers((prev) => [...prev, trigger]);
      setShowForm(false);
      setProvider("GITHUB");
      setRepoUrl("");
      setBranchFilter("main");
      setPathFilter("");
    }
    setCreating(false);
  }

  async function handleToggle(trigger: GitTrigger) {
    setToggling(trigger.id);
    const res = await fetch(
      `/api/product-lines/${productLineId}/triggers/${trigger.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !trigger.active }),
      }
    );
    if (res.ok) {
      const updated = await res.json();
      (window as any).pendo?.track("git_trigger_toggled", {
        product_line_id: productLineId,
        trigger_id: trigger.id,
        new_active_state: !trigger.active,
        repo_url: trigger.repoUrl || "",
      });
      setTriggers((prev) => prev.map((t) => (t.id === trigger.id ? updated : t)));
    }
    setToggling(null);
  }

  async function handleDelete(triggerId: string) {
    setDeleting(triggerId);
    const res = await fetch(
      `/api/product-lines/${productLineId}/triggers/${triggerId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      (window as any).pendo?.track("git_trigger_deleted", {
        product_line_id: productLineId,
        trigger_id: triggerId,
      });
      setTriggers((prev) => prev.filter((t) => t.id !== triggerId));
    }
    setDeleting(null);
  }

  async function handleRunLastWeek() {
    setRunning(true);
    setRunResult(null);
    const res = await fetch(`/api/product-lines/${productLineId}/run`, { method: "POST" });
    setRunResult(res.ok ? "queued" : "error");
    setRunning(false);
    setTimeout(() => setRunResult(null), 3000);
    // Refresh events after a short delay to include the new entry
    setTimeout(async () => {
      const evRes = await fetch(`/api/product-lines/${productLineId}/trigger-events`);
      if (evRes.ok) setEvents(await evRes.json());
    }, 1500);
  }

  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const webhookUrl = (triggerId: string) =>
    `${appUrl}/api/webhooks/git/${triggerId}`;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Git Triggers</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            Add a webhook URL to your repo. On every push, the agent decides if there&apos;s something to report.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasAgent && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRunLastWeek}
              disabled={running}
              className="gap-1.5"
            >
              {running ? (
                <><Play size={13} className="animate-pulse" /> Running...</>
              ) : runResult === "queued" ? (
                <><Check size={13} className="text-green-600" /> Queued!</>
              ) : runResult === "error" ? (
                "Error"
              ) : (
                <><Zap size={13} /> Run Last Week</>
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowForm((v) => !v)}
            className="gap-1.5 shrink-0"
          >
            <Plus size={13} />
            Add Trigger
          </Button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-4"
        >
          <p className="text-sm font-medium text-zinc-900">New Trigger</p>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Provider</label>
            <div className="flex gap-2">
              {(["GITHUB", "GITLAB"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setProvider(p)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                    provider === p
                      ? "bg-zinc-900 text-white border-zinc-900"
                      : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                  }`}
                >
                  {p === "GITHUB" ? "GitHub" : "GitLab"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">
              Repository URL <span className="text-zinc-400 font-normal">(optional, for reference)</span>
            </label>
            <Input
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600">
                Branch filter <span className="text-zinc-400 font-normal">(e.g. main, release/*)</span>
              </label>
              <Input
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                placeholder="main"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-600">
                Path filter <span className="text-zinc-400 font-normal">(e.g. src/payments/**)</span>
              </label>
              <Input
                value={pathFilter}
                onChange={(e) => setPathFilter(e.target.value)}
                placeholder="Leave blank to match all paths"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" size="sm" disabled={creating}>
              {creating ? "Creating..." : "Create Trigger"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Trigger list */}
      {triggers.length === 0 && !showForm ? (
        <div className="text-center py-16 border border-dashed border-zinc-300 rounded-xl">
          <p className="text-sm text-zinc-500">No triggers yet.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setShowForm(true)}
          >
            Add your first trigger
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {triggers.map((trigger) => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              webhookUrl={webhookUrl(trigger.id)}
              copied={copied}
              deleting={deleting}
              toggling={toggling}
              onCopy={copyText}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Run log */}
      <RunLog events={events} productLineId={productLineId} />
    </div>
  );
}

// ── Run Log ───────────────────────────────────────────────────────────────────

type LogFilter = "all" | "update" | "no_update" | "failed";

type RerunState = {
  originalEventId: string;
  newEventId: string;
  targetIsoWeek: number;
  targetYear: number;
  status: "polling" | "ready" | "approving" | "approved";
  result: TriggerEventWithTrigger | null;
};

function RunLog({ events, productLineId }: { events: TriggerEventWithTrigger[]; productLineId: string }) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TriggerEventWithTrigger[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [rerunning, setRerunning] = useState<string | null>(null); // eventId being re-run
  const [rerun, setRerun] = useState<RerunState | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Poll for re-run result
  useEffect(() => {
    if (!rerun || rerun.status !== "polling") {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/product-lines/${productLineId}/trigger-events/${rerun.newEventId}`);
      if (!res.ok) return;
      const ev: TriggerEventWithTrigger = await res.json();
      if (ev.agentDecision) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setRerun((r) => r ? { ...r, status: "ready", result: ev } : null);
      }
    }, 2000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [rerun, productLineId]);

  // Debounced server search
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!search.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      const res = await fetch(
        `/api/product-lines/${productLineId}/trigger-events?q=${encodeURIComponent(search.trim())}`
      );
      if (res.ok) setSearchResults(await res.json());
      setSearching(false);
    }, 400);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [search, productLineId]);

  async function handleRerun(eventId: string) {
    setRerunning(eventId);
    const res = await fetch(`/api/product-lines/${productLineId}/trigger-events/${eventId}/rerun`, { method: "POST" });
    setRerunning(null);
    if (!res.ok) return;
    const { newEventId, targetIsoWeek, targetYear } = await res.json() as { newEventId: string; targetIsoWeek: number; targetYear: number };
    setRerun({ originalEventId: eventId, newEventId, targetIsoWeek, targetYear, status: "polling", result: null });
  }

  async function handleApprove() {
    if (!rerun?.result?.updateContent) return;
    setRerun((r) => r ? { ...r, status: "approving" } : null);
    const res = await fetch(
      `/api/product-lines/${productLineId}/trigger-events/${rerun.newEventId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isoWeek: rerun.targetIsoWeek, year: rerun.targetYear }),
      }
    );
    if (res.ok) {
      setRerun((r) => r ? { ...r, status: "approved" } : null);
      setTimeout(() => setRerun(null), 3000);
    }
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // When searching, use server results; otherwise use the initial 100
  const source = searchResults ?? events.filter((e) => e.status !== "skipped");

  if (source.length === 0 && !searching && !search.trim()) return null;

  const byStatus =
    filter === "all"
      ? source
      : filter === "update"
      ? source.filter((e) => e.agentDecision === "update_created")
      : filter === "no_update"
      ? source.filter((e) => e.agentDecision && e.agentDecision !== "update_created")
      : source.filter((e) => e.status === "failed");

  const filtered = byStatus;

  // Counts for filter tabs — always based on source (not filtered)
  const meaningful = source;

  const updateCount = meaningful.filter((e) => e.agentDecision === "update_created").length;
  const noUpdateCount = meaningful.filter(
    (e) => e.agentDecision && e.agentDecision !== "update_created"
  ).length;
  const failedCount = meaningful.filter((e) => e.status === "failed").length;

  return (
    <>
    {/* Re-run result modal */}
    {rerun && rerun.status !== "polling" && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Re-run result</p>
              <p className="text-xs text-zinc-500 mt-0.5">Week {rerun.targetIsoWeek} · {rerun.targetYear}</p>
            </div>
            <button onClick={() => setRerun(null)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <X size={16} />
            </button>
          </div>
          <div className="px-6 py-5 overflow-y-auto flex-1">
            {rerun.status === "approved" ? (
              <div className="text-center py-8">
                <Check size={32} className="text-green-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-zinc-900">Update saved!</p>
                <p className="text-xs text-zinc-500 mt-1">Added to Week {rerun.targetIsoWeek} · {rerun.targetYear}</p>
              </div>
            ) : rerun.result?.agentDecision === "update_created" && rerun.result.updateContent ? (
              <pre className="whitespace-pre-wrap text-sm text-zinc-700 font-sans leading-relaxed">
                {rerun.result.updateContent}
              </pre>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-zinc-500">Agent decided not to create an update.</p>
                {rerun.result?.workerDetail && (
                  <p className="text-xs text-zinc-400 mt-1">{rerun.result.workerDetail}</p>
                )}
              </div>
            )}
          </div>
          {rerun.result?.agentDecision === "update_created" && rerun.status !== "approved" && (
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-100 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setRerun(null)}>Cancel</Button>
              <Button size="sm" onClick={handleApprove} disabled={rerun.status === "approving"}>
                {rerun.status === "approving" ? "Saving..." : `Approve · Week ${rerun.targetIsoWeek}/${rerun.targetYear}`}
              </Button>
            </div>
          )}
        </div>
      </div>
    )}

    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <h3 className="text-sm font-semibold text-zinc-900">Run Log</h3>
          {rerun?.status === "polling" && (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
              <RefreshCw size={10} className="animate-spin" /> Re-running…
            </span>
          )}
        </div>
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search full history by Jira ticket, repo, branch…"
            className="w-full text-xs border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300 placeholder:text-zinc-400"
          />
          {searching && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <RefreshCw size={10} className="animate-spin text-zinc-400" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(["all", "update", "no_update", "failed"] as LogFilter[]).map((f) => {
            const label =
              f === "all" ? `All (${meaningful.length})` :
              f === "update" ? `Updates (${updateCount})` :
              f === "no_update" ? `No update (${noUpdateCount})` :
              `Failed (${failedCount})`;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                  filter === f
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="border border-zinc-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs table-fixed">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 w-32">Time</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 w-44">Source</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500 w-32">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Details</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                  {search.trim() ? `No results for "${search}"` : "No events match this filter."}
                </td>
              </tr>
            ) : (
              filtered.map((ev) => {
                const isExpanded = expandedRows.has(ev.id);
                const canExpand = ev.agentDecision === "update_created" && !!ev.updateContent;
                return (
                  <Fragment key={ev.id}>
                    <tr className="bg-white hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-2.5 text-zinc-400 whitespace-nowrap font-mono">
                        {formatTime(ev.createdAt)}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">
                        {ev.source === "manual" ? (
                          <span className="inline-flex items-center gap-1">
                            <Zap size={10} className="text-zinc-400" /> Manual
                          </span>
                        ) : (
                          <span className="break-all">
                            {ev.trigger?.repoUrl
                              ? ev.trigger.repoUrl.replace(/^https?:\/\/(github|gitlab)\.com\//, "")
                              : ev.trigger?.provider ?? "Webhook"}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <EventStatusBadge ev={ev} />
                          {canExpand && (
                            <button
                              onClick={() => toggleRow(ev.id)}
                              className="text-blue-400 hover:text-blue-600 transition-colors"
                              title={isExpanded ? "Hide update" : "Show update"}
                            >
                              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 w-full">
                        <DetailCell detail={buildDetail(ev)} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {ev.agentDecision && (
                          <button
                            onClick={() => handleRerun(ev.id)}
                            disabled={rerunning === ev.id || rerun?.status === "polling"}
                            className="text-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-40"
                            title="Re-run agent for this event"
                          >
                            <RefreshCw size={12} className={rerunning === ev.id ? "animate-spin" : ""} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && ev.updateContent && (
                      <tr className="bg-blue-50/40">
                        <td colSpan={4} className="px-4 pb-4 pt-2 border-t border-blue-100">
                          <pre className="whitespace-pre-wrap text-xs text-zinc-700 font-sans leading-relaxed max-h-72 overflow-y-auto">
                            {ev.updateContent}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
}

function DetailCell({ detail }: { detail: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(detail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (detail === "—") return <span className="text-zinc-300">—</span>;

  return (
    <div className="flex items-start gap-1.5 group">
      <span className="break-words whitespace-pre-wrap min-w-0">{detail}</span>
      <button
        onClick={handleCopy}
        className="shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400 hover:text-zinc-600"
        title="Copy full detail"
      >
        {copied ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
      </button>
    </div>
  );
}

function EventStatusBadge({ ev }: { ev: TriggerEventWithTrigger }) {
  if (ev.status === "failed") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
        Failed
      </span>
    );
  }
  if (ev.agentDecision === "update_created") {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        Update created
      </span>
    );
  }
  if (ev.agentDecision) {
    // Agent ran but decided nothing was worth reporting
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 text-zinc-500 border border-zinc-200">
        No update
      </span>
    );
  }
  // Queued — agent is still processing
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
      Running…
    </span>
  );
}

function buildDetail(ev: TriggerEventWithTrigger): string {
  const parts: string[] = [];
  if (ev.detail) parts.push(ev.detail);
  if (ev.workerDetail) parts.push(ev.workerDetail);
  return parts.join(" · ") || "—";
}


function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── TriggerCard ───────────────────────────────────────────────────────────────

interface TriggerCardProps {
  trigger: GitTrigger;
  webhookUrl: string;
  copied: string | null;
  deleting: string | null;
  toggling: string | null;
  onCopy: (text: string, key: string) => void;
  onToggle: (trigger: GitTrigger) => void;
  onDelete: (id: string) => void;
}

function TriggerCard({
  trigger,
  webhookUrl,
  copied,
  deleting,
  toggling,
  onCopy,
  onToggle,
  onDelete,
}: TriggerCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`bg-white border rounded-xl transition-colors ${trigger.active ? "border-zinc-200" : "border-zinc-100 opacity-60"}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          onClick={() => onToggle(trigger)}
          disabled={toggling === trigger.id}
          className="text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
          title={trigger.active ? "Disable trigger" : "Enable trigger"}
        >
          {trigger.active ? (
            <ToggleRight size={20} className="text-green-600" />
          ) : (
            <ToggleLeft size={20} />
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {trigger.repoUrl ? (
              <p className="text-sm font-medium text-zinc-900 truncate">{trigger.repoUrl}</p>
            ) : (
              <p className="text-sm font-medium text-zinc-500 italic">No repo specified</p>
            )}
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 shrink-0">
              {trigger.provider ?? "GITHUB"}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {trigger.branchFilter && (
              <span className="text-xs text-zinc-400">branch: <code className="font-mono">{trigger.branchFilter}</code></span>
            )}
            {trigger.pathFilter && (
              <span className="text-xs text-zinc-400">path: <code className="font-mono">{trigger.pathFilter}</code></span>
            )}
            {trigger.fireCount > 0 && (
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Zap size={10} className="text-zinc-400" />
                {trigger.fireCount} {trigger.fireCount === 1 ? "trigger" : "triggers"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="gap-1 text-zinc-400"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Webhook
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(trigger.id)}
            disabled={deleting === trigger.id}
            className="text-zinc-400 hover:text-red-600"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </div>

      {/* Webhook URL panel */}
      {expanded && (
        <div className="border-t border-zinc-100 px-5 py-4 space-y-3 bg-zinc-50 rounded-b-xl">
          <div>
            <p className="text-xs font-medium text-zinc-600 mb-1.5">Webhook URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white border border-zinc-200 rounded-md px-3 py-2 text-zinc-700 truncate">
                {webhookUrl}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCopy(webhookUrl, `url-${trigger.id}`)}
                className="shrink-0 gap-1.5"
              >
                {copied === `url-${trigger.id}` ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </Button>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-zinc-600 mb-1.5">
              {(trigger.provider ?? "GITHUB") === "GITLAB" ? "Secret Token" : "Webhook Secret (HMAC)"}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono bg-white border border-zinc-200 rounded-md px-3 py-2 text-zinc-700 truncate">
                {trigger.webhookSecret}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onCopy(trigger.webhookSecret, `secret-${trigger.id}`)}
                className="shrink-0 gap-1.5"
              >
                {copied === `secret-${trigger.id}` ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
              </Button>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <p className="text-xs text-amber-700">
              {(trigger.provider ?? "GITHUB") === "GITLAB" ? (
                <>In GitLab: go to your <strong>Group</strong> Settings → Webhooks → Add new webhook. Paste the URL above and the secret into the <code className="font-mono">Secret token</code> field. Enable <em>Merge request events</em> only. This will fire across all repos in the group when an MR is merged.</>
              ) : (
                <>In GitHub: go to repo Settings → Webhooks → Add webhook. Set Content type to <code className="font-mono">application/json</code> and paste the secret above into the Secret field.</>
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
