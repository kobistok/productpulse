"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Plus } from "lucide-react";
import type { Invite } from "@productpulse/db";

interface Props {
  orgId: string;
  invites: Invite[];
}

export function InviteSection({ orgId, invites: initialInvites }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function generateInvite() {
    setGenerating(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    if (res.ok) {
      const invite = await res.json();
      setInvites((prev) => [invite, ...prev]);
    }
    setGenerating(false);
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/join/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  }

  const activeInvites = invites.filter(
    (i) => !i.usedAt && new Date(i.expiresAt) > new Date()
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">Team Invites</h2>
        <Button size="sm" variant="outline" onClick={generateInvite} disabled={generating} className="gap-1.5">
          <Plus size={12} />
          {generating ? "Generating..." : "New Invite Link"}
        </Button>
      </div>

      {activeInvites.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No active invite links. Generate one and share it with your teammates.
        </p>
      ) : (
        <div className="space-y-2">
          {activeInvites.map((invite) => {
            const url = `${typeof window !== "undefined" ? window.location.origin : ""}/join/${invite.token}`;
            return (
              <div
                key={invite.id}
                className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-4 py-3"
              >
                <p className="text-xs font-mono text-zinc-500 truncate max-w-xs">{url}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyLink(invite.token)}
                  className="ml-3 gap-1.5 shrink-0"
                >
                  {copied === invite.token ? (
                    <><Check size={12} /> Copied</>
                  ) : (
                    <><Copy size={12} /> Copy</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
