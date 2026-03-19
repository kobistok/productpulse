"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ZendeskSectionProps {
  config: { subdomain: string; email: string } | null;
}

export function ZendeskSection({ config: initialConfig }: ZendeskSectionProps) {
  const [config, setConfig] = useState(initialConfig);
  const [subdomain, setSubdomain] = useState(initialConfig?.subdomain ?? "");
  const [email, setEmail] = useState(initialConfig?.email ?? "");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/zendesk", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subdomain, email, apiToken: apiToken || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setConfig(data);
      setApiToken("");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Failed to save");
    }
    setSaving(false);
  }

  async function handleRemove() {
    setRemoving(true);
    const res = await fetch("/api/zendesk", { method: "DELETE" });
    if (res.ok) {
      setConfig(null);
      setSubdomain("");
      setEmail("");
      setApiToken("");
    }
    setRemoving(false);
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-semibold text-zinc-900">Zendesk</h2>
        {config && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-medium">
            Connected
          </span>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
        {config ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Subdomain</p>
              <p className="text-sm text-zinc-900">{config.subdomain}.zendesk.com</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Email</p>
              <p className="text-sm text-zinc-900">{config.email}</p>
            </div>
            <div className="pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={removing}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                {removing ? "Removing..." : "Remove"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-zinc-500">
              Connect Zendesk to surface related Help Center articles on content outputs.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Subdomain</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={subdomain}
                  onChange={(e) => setSubdomain(e.target.value)}
                  placeholder="yourcompany"
                  className="flex-1 text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
                <span className="text-sm text-zinc-400">.zendesk.com</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourcompany.com"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">API Token</label>
              <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="••••••••"
                className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button size="sm" onClick={handleSave} disabled={saving || !subdomain || !email || !apiToken}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
