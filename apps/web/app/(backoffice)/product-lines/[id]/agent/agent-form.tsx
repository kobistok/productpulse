"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, Info } from "lucide-react";
import type { Agent } from "@productpulse/db";

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Best balance of quality and speed" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", description: "Highest quality, slower" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fastest, lower cost" },
];

const DEFAULT_SYSTEM_PROMPT = `You are a product update agent. Your job is to monitor git pushes and decide whether they contain user-facing changes worth reporting.

Guidelines:
- Only create updates for changes that affect end users: new features, bug fixes, UX improvements, performance wins
- Skip: internal refactors, infrastructure changes, dependency bumps, test-only changes, CI config
- Write in clear, non-technical language that a non-engineer stakeholder can understand
- Keep updates concise: 2–4 sentences describing what changed and why it matters
- Use past tense: "We shipped...", "Users can now...", "Fixed an issue where..."`;

interface Props {
  productLineId: string;
  productLineName: string;
  agent: Agent | null;
  canEdit: boolean;
}

export function AgentForm({ productLineId, productLineName, agent, canEdit }: Props) {
  const [systemPrompt, setSystemPrompt] = useState(
    agent?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
  );
  const [model, setModel] = useState(agent?.model ?? "claude-sonnet-4-6");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);

    const res = await fetch(`/api/product-lines/${productLineId}/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ systemPrompt, model }),
    });

    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const body = await res.json();
      setError(body.error ?? "Failed to save");
    }
    setSaving(false);
  }

  function handleReset() {
    setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-900">Agent Configuration</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            This agent runs on every git push and decides what to update for{" "}
            <span className="font-medium text-zinc-700">{productLineName}</span>.
          </p>
        </div>
        {agent && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium shrink-0 mt-1">
            Active
          </span>
        )}
      </div>

      {!canEdit && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
          <Info size={12} className="mt-0.5 shrink-0" />
          <p>You can view but not edit this agent. Only the agent creator and org admins can make changes.</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Model selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Model</label>
          <div className="grid grid-cols-3 gap-2">
            {MODELS.map((m) => (
              <button
                key={m.value}
                type="button"
                disabled={!canEdit}
                onClick={() => canEdit && setModel(m.value)}
                className={`text-left px-3 py-3 rounded-lg border text-sm transition-colors disabled:cursor-not-allowed ${
                  model === m.value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 disabled:hover:border-zinc-200"
                }`}
              >
                <p className="font-medium text-xs">{m.label}</p>
                <p className={`text-xs mt-0.5 ${model === m.value ? "text-zinc-300" : "text-zinc-400"}`}>
                  {m.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* System prompt */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-700">System Prompt</label>
            {canEdit && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                Reset to default
              </button>
            )}
          </div>
          <Textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={14}
            disabled={!canEdit}
            className="font-mono text-xs leading-relaxed disabled:cursor-not-allowed disabled:opacity-70"
            placeholder="Describe how this agent should behave..."
          />
          <div className="flex items-start gap-1.5 text-xs text-zinc-400">
            <Info size={12} className="mt-0.5 shrink-0" />
            <p>
              The agent receives: your system prompt, recent updates, commit messages, diff summary,
              and changed file paths. It then calls <code className="font-mono bg-zinc-100 px-1 rounded">create_update</code> or{" "}
              <code className="font-mono bg-zinc-100 px-1 rounded">skip_update</code>.
            </p>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {canEdit && (
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? "Saving..." : saved ? <><Check size={14} /> Saved</> : "Save Agent"}
            </Button>
            {!agent && (
              <p className="text-xs text-zinc-400">Agent will activate once saved.</p>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
