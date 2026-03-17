"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Trash2, UserPlus } from "lucide-react";

interface Invite {
  id: string;
  token: string;
  email: string | null;
  expiresAt: Date | string;
  usedAt: Date | string | null;
}

interface Props {
  orgId: string;
  invites: Invite[];
}

export function InviteSection({ orgId, invites: initialInvites }: Props) {
  const [invites, setInvites] = useState(initialInvites);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setNewLink(null);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId, email }),
    });
    if (res.ok) {
      const invite = await res.json();
      const url = `${window.location.origin}/join/${invite.token}`;
      setInvites((prev) => [invite, ...prev]);
      setNewLink(url);
      setEmail("");
      await navigator.clipboard.writeText(url).catch(() => {});
    }
    setCreating(false);
  }

  async function deleteInvite(id: string) {
    await fetch(`/api/invites/${id}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.id !== id));
    if (newLink) setNewLink(null);
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
      <h2 className="text-sm font-semibold text-zinc-900 mb-3">Team Invites</h2>

      <form onSubmit={createInvite} className="flex gap-2 mb-4">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          className="flex-1 h-9 px-3 text-sm border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white"
        />
        <Button type="submit" disabled={creating} size="sm" className="gap-1.5 shrink-0">
          <UserPlus size={12} />
          {creating ? "Creating..." : "Invite"}
        </Button>
      </form>

      {newLink && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5">
          <p className="text-xs text-green-800 flex-1 font-mono truncate">{newLink}</p>
          <span className="text-xs text-green-700 font-medium shrink-0">Copied to clipboard</span>
        </div>
      )}

      {activeInvites.length === 0 ? (
        <p className="text-sm text-zinc-500">No pending invites.</p>
      ) : (
        <div className="space-y-2">
          {activeInvites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900">
                  {invite.email ?? <span className="text-zinc-400 italic">Any email</span>}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Expires {new Date(invite.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyLink(invite.token)}
                  className="gap-1.5 text-zinc-600"
                >
                  {copied === invite.token ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteInvite(invite.id)}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
