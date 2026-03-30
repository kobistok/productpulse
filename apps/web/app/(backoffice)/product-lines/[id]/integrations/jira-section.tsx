"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface Props {
  productLineId: string;
  existing: { baseUrl: string; atlassianDomain: string | null; email: string } | null;
}

export function JiraSection({ productLineId, existing }: Props) {
  const [connected, setConnected] = useState(!!existing);
  const [open, setOpen] = useState(false);

  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");
  const [atlassianDomain, setAtlassianDomain] = useState(existing?.atlassianDomain ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<{ ok: boolean; message: string; hint?: string } | null>(null);

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
      setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
    }
    setSaving(false);
  }

  async function handleValidate() {
    setValidating(true);
    setValidateResult(null);
    const res = await fetch(`/api/product-lines/${productLineId}/integrations/jira/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, email, apiToken: apiToken || undefined }),
    });
    const data = await res.json() as { ok: boolean; displayName?: string; emailAddress?: string; error?: string; hint?: string };
    if (data.ok) {
      setValidateResult({ ok: true, message: `OK — authenticated as ${data.displayName ?? data.emailAddress ?? "unknown"}` });
    } else {
      setValidateResult({ ok: false, message: data.error ?? "Validation failed", hint: data.hint });
    }
    setValidating(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/product-lines/${productLineId}/integrations/jira`, { method: "DELETE" });
    if (res.ok) {
      setConnected(false);
      setBaseUrl("");
      setAtlassianDomain("");
      setEmail("");
      setApiToken("");
      setOpen(false);
    }
    setDeleting(false);
  }

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-zinc-900">Jira</p>
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
              Fetches Jira ticket details when commit messages reference tickets (e.g. <code className="font-mono">PROJ-123</code>).
            </p>
          </div>
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
                <p className="text-sm font-semibold text-zinc-900">Jira</p>
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

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
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

              {validateResult && (
                <div className={`text-xs rounded-lg px-3 py-2 ${validateResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  <p className="font-medium">{validateResult.message}</p>
                  {validateResult.hint && (
                    <p className="mt-1 text-xs opacity-80">{validateResult.hint}</p>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                {connected ? (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleting ? "Removing..." : "Remove integration"}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={handleValidate} disabled={validating || !baseUrl || !email}>
                    {validating ? "Validating..." : "Validate token"}
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? "Saving..." : saved ? "Saved!" : connected ? "Update" : "Connect"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
