"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface ProductLine {
  id: string;
  name: string;
}

interface ContentAgentFormProps {
  productLines: ProductLine[];
  defaultValues?: {
    id: string;
    name: string;
    specificContext: string | null;
    outputTypes: string[];
    productLineIds: string[];
  };
}

const OUTPUT_TYPE_OPTIONS = [
  { value: "kb", label: "KB Article" },
  { value: "customer_update", label: "Customer Update" },
];

export function ContentAgentForm({ productLines, defaultValues }: ContentAgentFormProps) {
  const router = useRouter();
  const [name, setName] = useState(defaultValues?.name ?? "");
  const [specificContext, setSpecificContext] = useState(defaultValues?.specificContext ?? "");
  const [outputTypes, setOutputTypes] = useState<string[]>(defaultValues?.outputTypes ?? []);
  const [productLineIds, setProductLineIds] = useState<string[]>(defaultValues?.productLineIds ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!defaultValues?.id;

  function toggleOutputType(value: string) {
    setOutputTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function toggleProductLine(id: string) {
    setProductLineIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (outputTypes.length === 0) {
      setError("Select at least one output type.");
      return;
    }
    setLoading(true);
    setError(null);

    const url = isEdit ? `/api/content-agents/${defaultValues.id}` : "/api/content-agents";
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, specificContext: specificContext || null, outputTypes, productLineIds }),
    });

    if (res.ok) {
      const agent = await res.json();
      router.push(`/content/${agent.id}`);
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Help Center Updates, Release Blog"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">Output Types</label>
        <div className="flex gap-3">
          {OUTPUT_TYPE_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={outputTypes.includes(opt.value)}
                onChange={() => toggleOutputType(opt.value)}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
              />
              <span className="text-sm text-zinc-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700">
          Source Product Lines <span className="text-zinc-400 font-normal">(optional)</span>
        </label>
        {productLines.length === 0 ? (
          <p className="text-sm text-zinc-400">No product lines available.</p>
        ) : (
          <div className="space-y-2">
            {productLines.map((pl) => (
              <label key={pl.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={productLineIds.includes(pl.id)}
                  onChange={() => toggleProductLine(pl.id)}
                  className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500"
                />
                <span className="text-sm text-zinc-700">{pl.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700">
          Specific Context <span className="text-zinc-400 font-normal">(optional)</span>
        </label>
        <Textarea
          value={specificContext}
          onChange={(e) => setSpecificContext(e.target.value)}
          placeholder="e.g. Focus on self-serve features. Write for technical users."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading || !name.trim()} className="w-full">
        {loading ? (isEdit ? "Saving..." : "Creating...") : (isEdit ? "Save Changes" : "Create Agent")}
      </Button>
    </form>
  );
}
