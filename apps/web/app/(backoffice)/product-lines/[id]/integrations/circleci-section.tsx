"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  productLineId: string;
  existing: { projectSlug: string; branch: string } | null;
}

export function CircleCISection({ productLineId, existing }: Props) {
  const [projectSlug, setProjectSlug] = useState(existing?.projectSlug ?? "");
  const [branch, setBranch] = useState(existing?.branch ?? "main");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connected, setConnected] = useState(!!existing);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/product-lines/${productLineId}/integrations/circleci`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiToken, projectSlug, branch }),
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
    const res = await fetch(`/api/product-lines/${productLineId}/integrations/circleci`, {
      method: "DELETE",
    });
    if (res.ok) {
      setConnected(false);
      setProjectSlug("");
      setBranch("main");
      setApiToken("");
    }
    setDeleting(false);
  }

  return (
    <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">CircleCI</h3>
            {connected && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Shows the agent what&apos;s currently deployed to production vs what&apos;s been pushed.
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
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">
            Project Slug
          </label>
          <Input
            value={projectSlug}
            onChange={(e) => setProjectSlug(e.target.value)}
            placeholder="gh/myorg/myrepo"
            required
          />
          <p className="text-[11px] text-zinc-400">
            Found in your CircleCI project URL: circleci.com/gh/&lt;org&gt;/&lt;repo&gt;
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">Production branch</label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-600">
              API Token {connected && <span className="text-zinc-400 font-normal">(leave blank to keep existing)</span>}
            </label>
            <Input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder={connected ? "••••••••" : "Enter CircleCI personal API token"}
              required={!connected}
            />
          </div>
        </div>

        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving..." : saved ? "Saved!" : connected ? "Update" : "Connect"}
        </Button>
      </form>
    </section>
  );
}
