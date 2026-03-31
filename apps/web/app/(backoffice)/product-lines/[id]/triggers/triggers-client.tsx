"use client";

import React, { useState, useEffect, useRef, Fragment, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Play, Zap, RefreshCw, X, Telescope, ListRestart } from "lucide-react";
import type { StoredAgentInput } from "@/lib/cloud-tasks";
import type { GitTrigger } from "@productpulse/db";
import type { TriggerEventWithTrigger } from "./page";
import { getISOWeek, getISOWeekYear } from "date-fns";

interface Props {
  productLineId: string;
  triggers: GitTrigger[];
  appUrl: string;
  hasAgent: boolean;
  initialEvents: TriggerEventWithTrigger[];
  jiraBaseUrl: string | null;
  agentConfig: { filterRule: string | null; productContext: string | null } | null;
}

export function TriggersClient({ productLineId, triggers: initial, appUrl, hasAgent, initialEvents, jiraBaseUrl, agentConfig }: Props) {
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
      <RunLog events={events} setEvents={setEvents} productLineId={productLineId} jiraBaseUrl={jiraBaseUrl} agentConfig={agentConfig} />
    </div>
  );
}

// ── Run Log ───────────────────────────────────────────────────────────────────

type LogFilter = "all" | "update" | "no_update" | "failed";

type RerunStep = { label: string; status: "running" | "done" | "error"; detail?: string };

type RerunState = {
  originalEventId: string;
  newEventId: string | null;
  targetIsoWeek: number | null;
  targetYear: number | null;
  status: "preparing" | "polling" | "ready" | "approving" | "approved";
  steps: RerunStep[];
  result: TriggerEventWithTrigger | null;
  agentInput: { repo: string; branch: string; commits: Array<{ sha: string; message: string; author: string }>; jiraTickets: Array<{ key: string; summary: string; status: string; type: string }> } | null;
};

type BatchEventProgress = {
  index: number;
  total: number;
  repo: string;
  branch: string;
  source: string;
  newEventId?: string;
  queuedStatus: "pending" | "queued" | "error";
  agentDecision?: string | null;
  updateContent?: string | null;
};

type BatchSection = {
  proposedRaw: string;
  headline: string;
  status: "new" | "changed";
  existingRaw?: string;
  checked: boolean;
  mode: "override" | "combine";
};

type BatchRerunState = {
  isoWeek: number;
  year: number;
  phase: "streaming" | "polling" | "comparing" | "applying" | "done";
  eventProgress: BatchEventProgress[];
  existingContent: string | null;
  existingUpdateId: string | null;
  sections: BatchSection[];
};

function stripTsComment(raw: string): string {
  return raw.replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "").trimStart();
}

function extractHeadlineFromRaw(raw: string): string {
  const stripped = stripTsComment(raw);
  const firstLine = stripped.split("\n").find(Boolean) ?? "";
  const m = firstLine.match(/^\*\*(.+)\*\*$/);
  return m ? m[1] : firstLine;
}

function computeBatchSections(existingContent: string | null, eventProgress: BatchEventProgress[]): BatchSection[] {
  const existingRaws = existingContent
    ? existingContent.split(/\n\n---\n\n|\n---\n/).map((s) => s.trim()).filter(Boolean)
    : [];
  const existingByHeadline = new Map<string, string>();
  for (const raw of existingRaws) existingByHeadline.set(extractHeadlineFromRaw(raw), raw);

  // Collect all proposed sections (last one per headline wins)
  const proposedByHeadline = new Map<string, string>();
  for (const ep of eventProgress) {
    if (ep.agentDecision === "update_created" && ep.updateContent) {
      for (const raw of ep.updateContent.split(/\n\n---\n\n|\n---\n/).map((s) => s.trim()).filter(Boolean)) {
        proposedByHeadline.set(extractHeadlineFromRaw(raw), raw);
      }
    }
  }

  const sections: BatchSection[] = [];
  for (const [headline, proposedRaw] of proposedByHeadline) {
    const existingRaw = existingByHeadline.get(headline);
    if (!existingRaw) {
      sections.push({ proposedRaw, headline, status: "new", checked: true, mode: "override" });
    } else if (stripTsComment(proposedRaw).trim() !== stripTsComment(existingRaw).trim()) {
      sections.push({ proposedRaw, headline, status: "changed", existingRaw, checked: true, mode: "override" });
    }
    // unchanged sections are skipped — no action needed
  }
  return sections;
}

function RunLog({ events, setEvents, productLineId, jiraBaseUrl, agentConfig }: { events: TriggerEventWithTrigger[]; setEvents: React.Dispatch<React.SetStateAction<TriggerEventWithTrigger[]>>; productLineId: string; jiraBaseUrl: string | null; agentConfig: { filterRule: string | null; productContext: string | null } | null }) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TriggerEventWithTrigger[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [rerun, setRerun] = useState<RerunState | null>(null);
  const [exploreEvent, setExploreEvent] = useState<TriggerEventWithTrigger | null>(null);
  const [batchRerun, setBatchRerun] = useState<BatchRerunState | null>(null);
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const batchRerunRef = useRef<BatchRerunState | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep ref in sync for polling interval
  useEffect(() => { batchRerunRef.current = batchRerun; }, [batchRerun]);

  // Derive available weeks from event list (newest first, up to 8)
  const availableWeeks = useMemo(() => {
    const seen = new Set<string>();
    const weeks: { isoWeek: number; year: number }[] = [];
    for (const ev of events) {
      const d = new Date(ev.createdAt as unknown as string);
      const isoWeek = getISOWeek(d);
      const year = getISOWeekYear(d);
      const key = `${year}-${isoWeek}`;
      if (!seen.has(key)) {
        seen.add(key);
        weeks.push({ isoWeek, year });
      }
      if (weeks.length >= 8) break;
    }
    return weeks;
  }, [events]);

  // Poll for re-run result
  useEffect(() => {
    if (!rerun || rerun.status !== "polling" || !rerun.newEventId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    if (pollRef.current) return;
    const newEventId = rerun.newEventId;
    pollRef.current = setInterval(async () => {
      const res = await fetch(`/api/product-lines/${productLineId}/trigger-events/${newEventId}`);
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

  // Batch rerun polling
  useEffect(() => {
    if (!batchRerun || batchRerun.phase !== "polling") {
      if (batchPollRef.current) { clearInterval(batchPollRef.current); batchPollRef.current = null; }
      return;
    }
    if (batchPollRef.current) return;

    batchPollRef.current = setInterval(async () => {
      const current = batchRerunRef.current;
      if (!current || current.phase !== "polling") return;

      const pending = current.eventProgress.filter(
        (p) => p.newEventId && p.queuedStatus === "queued" && !p.agentDecision
      );

      await Promise.all(
        pending.map(async (p) => {
          if (!p.newEventId) return;
          try {
            const res = await fetch(`/api/product-lines/${productLineId}/trigger-events/${p.newEventId}`);
            if (!res.ok) return;
            const ev = await res.json();
            if (ev.agentDecision) {
              setBatchRerun((r) => {
                if (!r) return null;
                const updated = r.eventProgress.map((ep) =>
                  ep.newEventId === p.newEventId
                    ? { ...ep, agentDecision: ev.agentDecision, updateContent: ev.updateContent ?? null }
                    : ep
                );
                const allResolved = updated
                  .filter((ep) => ep.queuedStatus === "queued")
                  .every((ep) => ep.agentDecision != null);
                if (allResolved) {
                  clearInterval(batchPollRef.current!);
                  batchPollRef.current = null;
                  const sections = computeBatchSections(r.existingContent, updated);
                  return { ...r, eventProgress: updated, phase: "comparing", sections };
                }
                return { ...r, eventProgress: updated };
              });
            }
          } catch { /* ignore */ }
        })
      );
    }, 2000);

    return () => { if (batchPollRef.current) { clearInterval(batchPollRef.current); batchPollRef.current = null; } };
  }, [batchRerun?.phase, productLineId]);

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
    // Open modal immediately so the user sees progress right away
    setRerun({ originalEventId: eventId, newEventId: null, targetIsoWeek: null, targetYear: null, status: "preparing", steps: [], result: null, agentInput: null });

    const res = await fetch(`/api/product-lines/${productLineId}/trigger-events/${eventId}/rerun`, { method: "POST" });
    if (!res.ok || !res.body) {
      setRerun(null);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as { type: string; label?: string; status?: string; detail?: string; newEventId?: string; originalEventId?: string; targetIsoWeek?: number; targetYear?: number; agentInput?: RerunState["agentInput"]; message?: string };
          if (msg.type === "step" && msg.label && msg.status) {
            const step: RerunStep = { label: msg.label, status: msg.status as RerunStep["status"], detail: msg.detail };
            setRerun((r) => {
              if (!r) return null;
              const steps = [...r.steps];
              const idx = steps.findIndex((s) => s.label === msg.label && s.status === "running");
              if (idx >= 0) steps[idx] = step; else steps.push(step);
              return { ...r, steps };
            });
          } else if (msg.type === "done" && msg.newEventId) {
            setRerun((r) => r ? {
              ...r,
              newEventId: msg.newEventId!,
              targetIsoWeek: msg.targetIsoWeek!,
              targetYear: msg.targetYear!,
              status: "polling",
              agentInput: msg.agentInput ?? null,
            } : null);
          } else if (msg.type === "error") {
            setRerun(null);
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }

  async function handleApprove() {
    if (!rerun?.result?.updateContent) return;
    setRerun((r) => r ? { ...r, status: "approving" } : null);
    const res = await fetch(
      `/api/product-lines/${productLineId}/trigger-events/${rerun.newEventId}/approve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isoWeek: rerun.targetIsoWeek, year: rerun.targetYear, originalEventId: rerun.originalEventId }),
      }
    );
    if (res.ok) {
      // Update the original event row to reflect the approved result
      setEvents((prev) => prev.map((e) =>
        e.id === rerun.originalEventId
          ? { ...e, agentDecision: "update_created", updateContent: rerun.result?.updateContent ?? null }
          : e
      ));
      setRerun((r) => r ? { ...r, status: "approved" } : null);
      setTimeout(() => setRerun(null), 3000);
    }
  }

  async function handleBatchRerun(isoWeek: number, year: number) {
    setShowWeekPicker(false);
    setBatchRerun({ isoWeek, year, phase: "streaming", eventProgress: [], existingContent: null, existingUpdateId: null, sections: [] });

    const res = await fetch(`/api/product-lines/${productLineId}/batch-rerun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isoWeek, year }),
    });

    if (!res.ok || !res.body) { setBatchRerun(null); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line) as {
            type: string;
            index?: number; total?: number; repo?: string; branch?: string; source?: string;
            newEventId?: string; message?: string;
            newEventIds?: string[]; existingContent?: string | null; existingUpdateId?: string | null;
            isoWeek?: number; year?: number;
          };

          if (msg.type === "event_start" && msg.index != null) {
            const ep: BatchEventProgress = {
              index: msg.index, total: msg.total ?? 1,
              repo: msg.repo ?? "", branch: msg.branch ?? "", source: msg.source ?? "manual",
              queuedStatus: "pending",
            };
            setBatchRerun((r) => r ? { ...r, eventProgress: [...r.eventProgress, ep] } : null);
          } else if (msg.type === "event_queued" && msg.index != null) {
            setBatchRerun((r) => {
              if (!r) return null;
              const updated = r.eventProgress.map((ep) =>
                ep.index === msg.index ? { ...ep, newEventId: msg.newEventId, queuedStatus: "queued" as const } : ep
              );
              return { ...r, eventProgress: updated };
            });
          } else if (msg.type === "event_error" && msg.index != null) {
            setBatchRerun((r) => {
              if (!r) return null;
              const updated = r.eventProgress.map((ep) =>
                ep.index === msg.index ? { ...ep, queuedStatus: "error" as const } : ep
              );
              return { ...r, eventProgress: updated };
            });
          } else if (msg.type === "complete") {
            setBatchRerun((r) => r ? {
              ...r,
              phase: "polling",
              existingContent: msg.existingContent ?? null,
              existingUpdateId: msg.existingUpdateId ?? null,
            } : null);
          } else if (msg.type === "error") {
            setBatchRerun(null);
          }
        } catch { /* ignore */ }
      }
    }
  }

  async function handleApplyBatch() {
    if (!batchRerun) return;
    setBatchRerun((r) => r ? { ...r, phase: "applying" } : null);

    const { existingContent, existingUpdateId, sections, isoWeek, year } = batchRerun;

    function extractHeadline(raw: string): string {
      const stripped = raw.replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "").trimStart();
      const firstLine = stripped.split("\n").find(Boolean) ?? "";
      const m = firstLine.match(/^\*\*(.+)\*\*$/);
      return m ? m[1] : firstLine;
    }

    const existingRaws = existingContent
      ? existingContent.split(/\n\n---\n\n|\n---\n/).map((s) => s.trim()).filter(Boolean)
      : [];

    const result: string[] = [...existingRaws];

    for (const section of sections) {
      if (!section.checked) continue;
      if (section.status === "new") {
        result.push(section.proposedRaw);
      } else if (section.status === "changed") {
        const idx = result.findIndex((r) => extractHeadline(r) === section.headline);
        if (idx >= 0) {
          result[idx] = section.mode === "override"
            ? section.proposedRaw
            : result[idx] + "\n\n" + section.proposedRaw;
        } else {
          result.push(section.proposedRaw);
        }
      }
    }

    const newContent = result.join("\n\n---\n\n");

    const url = existingUpdateId
      ? `/api/product-lines/${productLineId}/updates/${existingUpdateId}`
      : `/api/product-lines/${productLineId}/updates`;
    const method = existingUpdateId ? "PATCH" : "POST";
    const body = existingUpdateId
      ? JSON.stringify({ content: newContent })
      : JSON.stringify({ isoWeek, year, content: newContent });

    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body });
    if (res.ok) {
      setBatchRerun((r) => r ? { ...r, phase: "done" } : null);
      setTimeout(() => setBatchRerun(null), 2500);
    } else {
      setBatchRerun((r) => r ? { ...r, phase: "comparing" } : null);
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
    {/* Re-run modal — shown during polling and after */}
    {rerun && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {rerun.status === "preparing" ? "Preparing re-run…" : rerun.status === "polling" ? "Running agent…" : "Re-run result"}
              </p>
              {rerun.targetIsoWeek && (
                <p className="text-xs text-zinc-500 mt-0.5">Week {rerun.targetIsoWeek} · {rerun.targetYear}</p>
              )}
            </div>
            <button onClick={() => setRerun(null)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Preparation steps — shown during preparing and polling */}
          {rerun.steps.length > 0 && (
            <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50 shrink-0">
              <ul className="space-y-1.5">
                {rerun.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {step.status === "running" ? (
                      <RefreshCw size={12} className="animate-spin text-zinc-400 mt-0.5 shrink-0" />
                    ) : step.status === "done" ? (
                      <Check size={12} className="text-green-500 mt-0.5 shrink-0" />
                    ) : (
                      <X size={12} className="text-red-500 mt-0.5 shrink-0" />
                    )}
                    <span className="text-zinc-700">{step.label}</span>
                    {step.detail && <span className="text-zinc-400 ml-1">{step.detail}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Agent input context — shown once preparation is done */}
          {rerun.agentInput && (
            <div className="px-6 py-3 border-b border-zinc-100 bg-zinc-50 shrink-0">
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-2">Agent input</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                <span><span className="text-zinc-400">Repo</span> {rerun.agentInput.repo}</span>
                <span><span className="text-zinc-400">Branch</span> {rerun.agentInput.branch}</span>
              </div>
              {rerun.agentInput.commits.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {rerun.agentInput.commits.map((c) => (
                    <li key={c.sha} className="text-xs text-zinc-600">
                      <span className="text-zinc-400 font-mono">{c.sha.slice(0, 7)}</span> {c.message}
                    </li>
                  ))}
                </ul>
              )}
              {rerun.agentInput.jiraTickets.length > 0 && (
                <ul className="mt-1.5 space-y-1">
                  {rerun.agentInput.jiraTickets.map((t) => (
                    <li key={t.key} className="flex items-start gap-2 text-xs">
                      {jiraBaseUrl ? (
                        <a
                          href={`${jiraBaseUrl}/browse/${t.key}`}
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
              )}
            </div>
          )}

          <div className="px-6 py-5 overflow-y-auto flex-1">
            {rerun.status === "preparing" ? (
              <div className="flex items-center justify-center py-6 gap-2 text-zinc-400">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm">Preparing…</span>
              </div>
            ) : rerun.status === "polling" ? (
              <div className="flex items-center justify-center py-6 gap-2 text-zinc-400">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm">Agent is running…</span>
              </div>
            ) : rerun.status === "approved" ? (
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
              <div className="py-8 space-y-2">
                <p className="text-sm text-zinc-500">Agent decided not to create an update.</p>
                {rerun.result?.workerDetail && (
                  <p className="text-xs text-zinc-400">{rerun.result.workerDetail.replace(/^Agent:\s*/i, "")}</p>
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
          {availableWeeks.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowWeekPicker((v) => !v)}
                className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 border border-zinc-200 rounded-md px-2 py-1 transition-colors"
                title="Re-run all events for a week"
              >
                <ListRestart size={11} />
                Re-run week
              </button>
              {showWeekPicker && (
                <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-zinc-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                  {availableWeeks.map(({ isoWeek, year }) => (
                    <button
                      key={`${year}-${isoWeek}`}
                      onClick={() => handleBatchRerun(isoWeek, year)}
                      className="w-full text-left px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      W{isoWeek} · {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                        <DetailCell detail={buildDetail(ev)} jiraBaseUrl={jiraBaseUrl} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ev.agentDecision && (
                            <button
                              onClick={() => setExploreEvent(ev)}
                              className="text-zinc-400 hover:text-zinc-700 transition-colors"
                              title="Explore agent workflow"
                            >
                              <Telescope size={12} />
                            </button>
                          )}
                          {ev.agentDecision && (
                            <button
                              onClick={() => handleRerun(ev.id)}
                              disabled={rerun !== null}
                              className="text-zinc-400 hover:text-zinc-700 transition-colors disabled:opacity-40"
                              title="Re-run agent for this event"
                            >
                              <RefreshCw size={12} className={rerun?.originalEventId === ev.id && rerun.status === "preparing" ? "animate-spin" : ""} />
                            </button>
                          )}
                        </div>
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

    {/* ── Batch re-run modal ─────────────────────────────────────────────── */}
    {batchRerun && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
            <div>
              <p className="text-sm font-semibold text-zinc-900">
                {batchRerun.phase === "streaming" ? "Queueing runs…"
                  : batchRerun.phase === "polling" ? "Agent running…"
                  : batchRerun.phase === "comparing" ? "Review changes"
                  : batchRerun.phase === "applying" ? "Saving…"
                  : "Applied!"}
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">W{batchRerun.isoWeek} · {batchRerun.year}</p>
            </div>
            {batchRerun.phase !== "applying" && (
              <button onClick={() => setBatchRerun(null)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
            {/* Event progress list (streaming + polling phases) */}
            {(batchRerun.phase === "streaming" || batchRerun.phase === "polling") && (
              <ul className="space-y-2">
                {batchRerun.eventProgress.map((ep, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    {ep.queuedStatus === "error" ? (
                      <X size={12} className="text-red-500 shrink-0" />
                    ) : ep.agentDecision ? (
                      <Check size={12} className="text-green-500 shrink-0" />
                    ) : ep.queuedStatus === "queued" ? (
                      <RefreshCw size={12} className="animate-spin text-zinc-400 shrink-0" />
                    ) : (
                      <RefreshCw size={12} className="text-zinc-200 shrink-0" />
                    )}
                    <span className="font-mono text-zinc-500">{ep.repo}</span>
                    {ep.branch && <><span className="text-zinc-300">·</span><span className="font-mono text-zinc-400">{ep.branch}</span></>}
                    <span className="ml-auto text-zinc-400">
                      {ep.queuedStatus === "error" ? "Error" :
                       ep.agentDecision === "update_created" ? "Update created" :
                       ep.agentDecision ? "No update" :
                       ep.queuedStatus === "queued" ? "Running…" : "Queuing…"}
                    </span>
                  </li>
                ))}
                {batchRerun.phase === "polling" && batchRerun.eventProgress.every(ep => ep.agentDecision) && (
                  <li className="flex items-center gap-2 text-xs text-zinc-400">
                    <RefreshCw size={12} className="animate-spin shrink-0" /> Computing comparison…
                  </li>
                )}
              </ul>
            )}

            {/* Comparison phase */}
            {batchRerun.phase === "comparing" && (
              <>
                {batchRerun.sections.length === 0 ? (
                  <p className="text-sm text-zinc-500 py-4 text-center">
                    No changes — the re-run produced identical content.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {batchRerun.sections.map((section, i) => (
                      <div key={i} className={`border rounded-lg overflow-hidden ${section.checked ? "border-zinc-200" : "border-zinc-100 opacity-60"}`}>
                        {/* Section header */}
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-50 border-b border-zinc-100">
                          <input
                            type="checkbox"
                            checked={section.checked}
                            onChange={() => setBatchRerun((r) => {
                              if (!r) return null;
                              const updated = r.sections.map((s, j) => j === i ? { ...s, checked: !s.checked } : s);
                              return { ...r, sections: updated };
                            })}
                            className="shrink-0"
                          />
                          <span className="text-xs font-medium text-zinc-800 flex-1">{section.headline}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                            section.status === "new"
                              ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                            {section.status === "new" ? "New" : "Changed"}
                          </span>
                          {section.status === "changed" && section.checked && (
                            <div className="flex items-center gap-0.5 bg-zinc-200 rounded-md p-0.5">
                              <button
                                onClick={() => setBatchRerun((r) => {
                                  if (!r) return null;
                                  const updated = r.sections.map((s, j) => j === i ? { ...s, mode: "override" as const } : s);
                                  return { ...r, sections: updated };
                                })}
                                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${section.mode === "override" ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500"}`}
                              >
                                Override
                              </button>
                              <button
                                onClick={() => setBatchRerun((r) => {
                                  if (!r) return null;
                                  const updated = r.sections.map((s, j) => j === i ? { ...s, mode: "combine" as const } : s);
                                  return { ...r, sections: updated };
                                })}
                                className={`text-[10px] px-2 py-0.5 rounded transition-colors ${section.mode === "combine" ? "bg-white text-zinc-800 shadow-sm" : "text-zinc-500"}`}
                              >
                                Combine
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Content preview */}
                        {section.checked && (
                          <div className="px-4 py-3 space-y-2">
                            {section.status === "changed" && section.existingRaw && (
                              <div>
                                <p className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Current</p>
                                <pre className="whitespace-pre-wrap text-xs text-zinc-500 font-sans bg-zinc-50 rounded px-2 py-1.5 line-through decoration-zinc-300">
                                  {stripTsComment(section.existingRaw)}
                                </pre>
                              </div>
                            )}
                            <div>
                              {section.status === "changed" && <p className="text-[10px] font-semibold text-zinc-400 uppercase mb-1">Proposed</p>}
                              <pre className="whitespace-pre-wrap text-xs text-zinc-700 font-sans bg-green-50 rounded px-2 py-1.5">
                                {stripTsComment(section.proposedRaw)}
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Applying */}
            {batchRerun.phase === "applying" && (
              <div className="flex items-center justify-center py-8 gap-2 text-zinc-400">
                <RefreshCw size={14} className="animate-spin" />
                <span className="text-sm">Saving…</span>
              </div>
            )}

            {/* Done */}
            {batchRerun.phase === "done" && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Check size={28} className="text-green-500" />
                <p className="text-sm font-semibold text-zinc-900">Changes applied!</p>
                <p className="text-xs text-zinc-400">W{batchRerun.isoWeek} · {batchRerun.year} updated</p>
              </div>
            )}
          </div>

          {/* Footer */}
          {batchRerun.phase === "comparing" && batchRerun.sections.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-zinc-100 shrink-0">
              <p className="text-xs text-zinc-400">
                {batchRerun.sections.filter(s => s.checked).length} of {batchRerun.sections.length} change{batchRerun.sections.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setBatchRerun(null)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleApplyBatch}
                  disabled={batchRerun.sections.every(s => !s.checked)}
                >
                  Apply selected
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* ── Explore modal ──────────────────────────────────────────────────── */}
    {exploreEvent && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        onClick={() => setExploreEvent(null)}
      >
        <div
          className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Agent Workflow</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {exploreEvent.source === "manual" ? "Manual run" : exploreEvent.repo ?? "Webhook"}{exploreEvent.branch ? ` · ${exploreEvent.branch}` : ""}
                {" · "}{formatTime(exploreEvent.createdAt)}
              </p>
            </div>
            <button onClick={() => setExploreEvent(null)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
            {/* Agent configuration */}
            <section>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Agent configuration</p>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-zinc-600 mb-1">Product context</p>
                  {agentConfig?.productContext ? (
                    <p className="text-xs text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded-lg px-3 py-2">{agentConfig.productContext}</p>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">Not configured</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-600 mb-1">Filter rule</p>
                  {agentConfig?.filterRule ? (
                    <p className="text-xs text-zinc-700 whitespace-pre-wrap bg-zinc-50 rounded-lg px-3 py-2">{agentConfig.filterRule}</p>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">No filter rule — agent uses default guidelines</p>
                  )}
                </div>
              </div>
            </section>

            {/* Run input & decision */}
            <section>
              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">Run details</p>
              <ExploreRunCard ev={exploreEvent} jiraBaseUrl={jiraBaseUrl} />
            </section>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function extractDecisionReason(workerDetail: string | null | undefined): string | null {
  if (!workerDetail) return null;
  const m = workerDetail.match(/Decision:\s*(.+?)(?:\s*·|$)/);
  return m ? m[1].trim() : null;
}

function ExploreRunCard({ ev, jiraBaseUrl }: { ev: TriggerEventWithTrigger; jiraBaseUrl: string | null }) {
  const input = ev.agentInputData as StoredAgentInput | null;
  const commits = input?.commits ?? [];
  const jiraTickets = input?.jira ?? [];
  const filesChanged = input?.filesChanged ?? [];
  const effectiveJiraBaseUrl = input?.jiraBaseUrl ?? jiraBaseUrl ?? undefined;
  const decisionReason = extractDecisionReason(ev.workerDetail);
  const skipReason = ev.workerDetail?.match(/Agent:\s*(.+?)(?:\s*·|$)/)?.[1]?.trim() ?? null;

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 space-y-3">
        {/* Decision */}
        {ev.agentDecision === "update_created" && decisionReason && (
          <div className="bg-green-50 border border-green-100 rounded-md px-3 py-2">
            <p className="text-[11px] font-semibold text-green-700 uppercase tracking-wide mb-0.5">Why this update was created</p>
            <p className="text-xs text-green-800">{decisionReason}</p>
          </div>
        )}
        {ev.agentDecision !== "update_created" && skipReason && (
          <div className="bg-zinc-50 border border-zinc-200 rounded-md px-3 py-2">
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-0.5">Why no update was created</p>
            <p className="text-xs text-zinc-600">{skipReason}</p>
          </div>
        )}

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
                    <a href={`${effectiveJiraBaseUrl}/browse/${t.key}`} target="_blank" rel="noopener noreferrer" className="shrink-0 font-mono text-blue-600 hover:underline">{t.key}</a>
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

const JIRA_KEY_RE = /\b([A-Z][A-Z0-9]+-\d+)\b/g;

function renderWithJiraLinks(text: string, jiraBaseUrl: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  JIRA_KEY_RE.lastIndex = 0;
  while ((match = JIRA_KEY_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const key = match[1];
    parts.push(
      <a
        key={match.index}
        href={`${jiraBaseUrl}/browse/${key}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {key}
      </a>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function DetailCell({ detail, jiraBaseUrl }: { detail: string; jiraBaseUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(detail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (detail === "—") return <span className="text-zinc-300">—</span>;

  const content = jiraBaseUrl ? renderWithJiraLinks(detail, jiraBaseUrl) : detail;

  return (
    <div className="flex items-start gap-1.5 group">
      <span className="break-words whitespace-pre-wrap min-w-0">{content}</span>
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
