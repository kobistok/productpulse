"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const org = await res.json();
      (window as any).pendo?.track("workspace_created", {
        org_name: name,
        org_id: org.id,
        org_slug: org.slug,
      });
      router.push("/product-lines");
      router.refresh();
    } else {
      setError("Failed to create workspace. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-zinc-200 p-10 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Create your workspace</h1>
        <p className="text-sm text-zinc-500 mt-1">Name your organization to get started</p>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <form onSubmit={handleCreate} className="mt-6 space-y-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Corp"
            required
            className="w-full px-3 py-2 text-sm border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-zinc-900"
          />
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full h-10 bg-zinc-900 text-white text-sm font-medium rounded-md hover:bg-zinc-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating..." : "Create workspace"}
          </button>
        </form>
      </div>
    </div>
  );
}
