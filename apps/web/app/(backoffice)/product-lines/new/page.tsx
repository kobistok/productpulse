"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewProductLinePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/product-lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    if (res.ok) {
      const pl = await res.json();
      router.push(`/product-lines/${pl.id}/agent`);
    } else {
      const body = await res.json();
      setError(body.error ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <Link
        href="/product-lines"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </Link>

      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">New Product Line</h1>
      <p className="text-sm text-zinc-500 mb-8">
        After creating it you&apos;ll configure the AI agent and git triggers.
      </p>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">Name</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Payments, Mobile App, API"
            required
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700">
            Description <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this product line covers"
            rows={3}
          />
        </div>

        <Button type="submit" disabled={loading || !name.trim()} className="w-full">
          {loading ? "Creating..." : "Create Product Line"}
        </Button>
      </form>
    </div>
  );
}
