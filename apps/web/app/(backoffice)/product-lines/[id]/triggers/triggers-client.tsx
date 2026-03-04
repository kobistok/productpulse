"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Plus, Trash2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from "lucide-react";
import type { GitTrigger } from "@productpulse/db";

interface Props {
  productLineId: string;
  triggers: GitTrigger[];
  appUrl: string;
}

export function TriggersClient({ productLineId, triggers: initial, appUrl }: Props) {
  const [triggers, setTriggers] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

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
      setTriggers((prev) => prev.filter((t) => t.id !== triggerId));
    }
    setDeleting(null);
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
    </div>
  );
}

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
                <>In GitLab: go to repo Settings → Webhooks → Add new webhook. Paste the URL above and the secret token into the <code className="font-mono">Secret token</code> field. Enable <em>Push events</em>.</>
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
