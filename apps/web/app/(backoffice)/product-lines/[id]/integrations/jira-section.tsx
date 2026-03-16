"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  productLineId: string;
  existing: { baseUrl: string; atlassianDomain: string | null; email: string } | null;
}

export function JiraSection({ productLineId, existing }: Props) {
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [atlassianDomain, setAtlassianDomain] = useState(existing?.atlassianDomain ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(!!existing);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/product-lines/${productLineId}/integrations/jira`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, atlassianDomain, email, apiToken }),
    });
    if (res.ok) {
      setConnected(true);
      setApiToken("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/product-lines/${productLineId}/integrations/jira`, { method: "DELETE" });
    if (res.ok) {
      setConnected(false);
      setBaseUrl("");
      setEmail("");
      setApiToken("");
    }
    setDeleting(false);
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">Jira</h3>
            {connected && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            When commit messages reference Jira tickets (e.g.{" "}
            <code className="font-mono">PROJ-123</code>), the agent fetches ticket details for context.
          </p>
        </div>
        {connected && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={deleting}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
          >
            {deleting ? "Removing..." : "Remove"}
          </Button>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Jira base URL</label>
            <Input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://yourcompany.atlassian.net"
              type="url"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">
              Atlassian domain <span className="text-zinc-400 font-normal">(for ticket links)</span>
            </label>
            <Input
              value={atlassianDomain}
              onChange={(e) => setAtlassianDomain(e.target.value)}
              placeholder="yourcompany.atlassian.net"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Jira account email</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yourcompany.com"
              type="email"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">
              API Token{" "}
              {connected && <span className="text-zinc-400 font-normal">(leave blank to keep existing)</span>}
            </label>
            <Input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={connected ? "••••••••" : "Enter Jira API token"}
              required={!connected}
            />
          </div>
        </div>

        <p className="text-[11px] text-zinc-400">
          Generate a token at{" "}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            id.atlassian.com/manage-profile/security/api-tokens
          </a>
        </p>

        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved!" : connected ? "Update" : "Connect"}
        </Button>
      </form>
    </section>
  );
}
