"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import type { Agent } from "@productpulse/db";

const MODELS = [
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", description: "Best balance of quality and speed" },
  { value: "claude-opus-4-6", label: "Claude Opus 4.6", description: "Highest quality, slower" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", description: "Fastest, lower cost" },
];

interface Props {
  productLineId: string;
  productLineName: string;
  agent: Agent | null;
}

export function AgentForm({ productLineId, productLineName, agent }: Props) {
  const [productContext, setProductContext] = useState(agent?.productContext ?? "");
  const [filterRule, setFilterRule] = useState(agent?.filterRule ?? "");
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
      body: JSON.stringify({ productContext, filterRule, model }),
    });

    if (res.ok) {
      (window as any).pendo?.track("agent_configured", {
        product_line_id: productLineId,
        model,
        system_prompt_length: systemPrompt.length,
        is_default_prompt: systemPrompt === DEFAULT_SYSTEM_PROMPT,
        is_first_configuration: !agent,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      const body = await res.json();
      setError(body.error ?? "Failed to save");
    }
    setSaving(false);
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

      <div className="mb-6 flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs text-blue-700">
        <Sparkles size={12} className="mt-0.5 shrink-0" />
        <p>
          Product Pulse uses a built-in AI prompt to generate structured updates.
          Add product context below to help the agent make better decisions.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">
            Product Context <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <Textarea
            value={productContext}
            onChange={(e) => setProductContext(e.target.value)}
            rows={4}
            className="text-sm"
            placeholder="e.g. This is a payments API used by enterprise clients. Focus on reliability, security, and performance changes. Skip frontend styling changes."
          />
          <p className="text-xs text-zinc-400">
            Helps the agent understand what matters for this product line.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">
            Update Filter <span className="font-normal text-zinc-400">(optional)</span>
          </label>
          <Textarea
            value={filterRule}
            onChange={(e) => setFilterRule(e.target.value)}
            rows={3}
            className="text-sm"
            placeholder="e.g. Only process if Jira ticket development team is A or B. Skip infrastructure-only changes."
          />
          <p className="text-xs text-zinc-400">
            The agent will skip pushes that don&apos;t match this condition. Useful when multiple product lines share the same repository.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-700">Model</label>
          <div className="grid grid-cols-3 gap-2">
            {MODELS.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setModel(m.value)}
                className={`text-left px-3 py-3 rounded-lg border text-sm transition-colors ${
                  model === m.value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300"
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

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? "Saving..." : saved ? <><Check size={14} /> Saved</> : agent ? "Save Changes" : "Activate Agent"}
          </Button>
          {!agent && (
            <p className="text-xs text-zinc-400">Agent will activate once saved.</p>
          )}
        </div>
      </form>
    </div>
  );
}
