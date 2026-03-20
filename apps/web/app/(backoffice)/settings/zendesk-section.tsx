"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ZendeskSectionProps {
  config: { subdomain: string; email: string } | null;
}

export function ZendeskSection({ config: initialConfig }: ZendeskSectionProps) {
  const [config, setConfig] = useState(initialConfig);
  const [open, setOpen] = useState(false);

  const [subdomain, setSubdomain] = useState(initialConfig?.subdomain ?? "");
  const [email, setEmail] = useState(initialConfig?.email ?? "");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [saved, setSaved] = useState(false);
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
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
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
      setOpen(false);
    }
    setRemoving(false);
  }

  const connected = !!config;

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">Zendesk</p>
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                connected
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-zinc-100 text-zinc-500 border-zinc-200"
              }`}
            >
              {connected ? "Connected" : "Not connected"}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Surfaces related Help Center articles on content outputs.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="shrink-0">
          Edit
        </Button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Zendesk</p>
                {connected && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    Connected
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-zinc-700 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700">Subdomain</label>
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

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourcompany.com"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-700">
                  API Token{" "}
                  {connected && <span className="text-zinc-400 font-normal text-[11px]">(leave blank to keep existing)</span>}
                </label>
                <input
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-sm border border-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-zinc-300"
                />
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex items-center justify-between pt-1">
                {connected ? (
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removing}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    {removing ? "Removing..." : "Remove integration"}
                  </button>
                ) : (
                  <span />
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !subdomain || !email || (!connected && !apiToken)}
                >
                  {saving ? "Saving..." : saved ? "Saved!" : connected ? "Update" : "Connect"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
