"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check } from "lucide-react";

export function OrgNameSection({ currentName }: { currentName: string }) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDirty = name.trim() !== currentName;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isDirty) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/orgs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    } else {
      const data = await res.json();
      setError(data.error ?? "Failed to save");
    }
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-900 mb-3">Company name</h2>
      <form onSubmit={handleSave} className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 max-w-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-600">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <Button type="submit" size="sm" disabled={saving || !isDirty} className="gap-1.5">
          {saved ? <><Check size={13} /> Saved</> : saving ? "Saving..." : "Save"}
        </Button>
      </form>
    </section>
  );
}
