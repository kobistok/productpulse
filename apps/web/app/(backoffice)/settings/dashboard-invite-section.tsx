"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Plus, ExternalLink } from "lucide-react";
import type { DashboardInvite } from "@productpulse/db";

interface Props {
  orgId: string;
  invites: DashboardInvite[];
}

export function DashboardInviteSection({ orgId, invites: initialInvites }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    const res = await fetch("/api/dashboard-invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, label }),
    });
    if (res.ok) {
      const invite = await res.json();
      setInvites((prev) => [invite, ...prev]);
      setShowForm(false);
      setLabel("");
    }
    setGenerating(false);
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/d/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Dashboard Links</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Share read-only product update dashboards — no login required.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowForm((v) => !v)}
          className="gap-1.5"
        >
          <Plus size={12} />
          New Link
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleGenerate}
          className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 mb-4 flex items-end gap-3"
        >
          <div className="flex-1 space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">
              Label <span className="text-zinc-400 font-normal">(optional — e.g. Investors, Board)</span>
            </label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Investors"
              className="h-9"
            />
          </div>
          <Button type="submit" size="sm" disabled={generating}>
            {generating ? "Generating..." : "Generate"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
            Cancel
          </Button>
        </form>
      )}

      {invites.length === 0 && !showForm ? (
        <p className="text-sm text-zinc-500">
          No dashboard links yet. Generate one to share your weekly updates.
        </p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/d/${invite.token}`;
            return (
              <div
                key={invite.id}
                className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  {invite.label && (
                    <p className="text-xs font-medium text-zinc-700 mb-0.5">{invite.label}</p>
                  )}
                  <p className="text-xs font-mono text-zinc-400 truncate">{url}</p>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 hover:text-zinc-600 transition-colors"
                  >
                    <ExternalLink size={13} />
                  </a>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyLink(invite.token)}
                    className="gap-1.5"
                  >
                    {copied === invite.token ? (
                      <><Check size={11} /> Copied</>
                    ) : (
                      <><Copy size={11} /> Copy</>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
