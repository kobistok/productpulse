"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";

interface Props {
  productLineId: string;
  existing: { projectSlug: string; branch: string } | null;
}

export function CircleCISection({ productLineId, existing }: Props) {
  const [connected, setConnected] = useState(!!existing);
  const [open, setOpen] = useState(false);

  const [projectSlug, setProjectSlug] = useState(existing?.projectSlug ?? "");
  const [branch, setBranch] = useState(existing?.branch ?? "main");
  const [apiToken, setApiToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);

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
      setTimeout(() => { setSaved(false); setOpen(false); }, 1500);
    }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/product-lines/${productLineId}/integrations/circleci`, { method: "DELETE" });
    if (res.ok) {
      setConnected(false);
      setProjectSlug("");
      setBranch("main");
      setApiToken("");
      setOpen(false);
    }
    setDeleting(false);
  }

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-xl px-5 py-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-zinc-900">CircleCI</p>
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
            Shows the agent what&apos;s currently deployed to production vs what&apos;s been pushed.
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
                <p className="text-sm font-semibold text-zinc-900">CircleCI</p>
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
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600">Project Slug</label>
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
                    API Token{" "}
                    {connected && <span className="text-zinc-400 font-normal">(leave blank to keep existing)</span>}
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
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "Saving..." : saved ? "Saved!" : connected ? "Update" : "Connect"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
