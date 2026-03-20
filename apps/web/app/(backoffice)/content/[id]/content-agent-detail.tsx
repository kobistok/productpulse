"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Check, Globe, Link2Off, Expand, X, Loader2 } from "lucide-react";
import type { ContentAgent, ContentOutput } from "@productpulse/db";

type ZendeskArticle = { id: number; title: string; url: string };

type AgentWithOutputs = ContentAgent & { outputs: ContentOutput[] };

interface ContentAgentDetailProps {
  agent: AgentWithOutputs;
}

const TIMEFRAMES = [
  { value: "this_week", label: "This week" },
  { value: "last_week", label: "Last week" },
  { value: "last_2_weeks", label: "Last 2 weeks" },
  { value: "last_4_weeks", label: "Last 4 weeks" },
] as const;

type Timeframe = (typeof TIMEFRAMES)[number]["value"];

export function ContentAgentDetail({ agent }: ContentAgentDetailProps) {
  const router = useRouter();
  const [showTimeframePicker, setShowTimeframePicker] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [shareToken, setShareToken] = useState<string | null>(agent.shareToken);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | "kb" | "customer_update">("all");

  async function handleGenerate(timeframe: Timeframe) {
    setGenerating(true);
    setShowTimeframePicker(false);
    setGenerationError(null);

    const res = await fetch(`/api/content-agents/${agent.id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeframe }),
    });

    if (res.ok) {
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      setGenerationError(body.error ?? "Generation failed");
    }
    setGenerating(false);
  }

  async function handleShare() {
    setSharingLoading(true);
    const res = await fetch(`/api/content-agents/${agent.id}/share`, { method: "POST" });
    if (res.ok) {
      const { shareToken: token } = await res.json();
      setShareToken(token);
    }
    setSharingLoading(false);
  }

  async function handleRevokeShare() {
    setSharingLoading(true);
    const res = await fetch(`/api/content-agents/${agent.id}/share`, { method: "DELETE" });
    if (res.ok) setShareToken(null);
    setSharingLoading(false);
  }

  function copyShareUrl() {
    if (!shareToken) return;
    const url = `${window.location.origin}/cs/${shareToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function toggleStatus(outputId: string, currentStatus: string) {
    setTogglingStatus(outputId);
    const newStatus = currentStatus === "published" ? "draft" : "published";
    const res = await fetch(`/api/content-outputs/${outputId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) router.refresh();
    setTogglingStatus(null);
  }

  async function copyContent(content: string) {
    await navigator.clipboard.writeText(content);
  }

  // Group outputs by year + week
  const filteredOutputs =
    typeFilter === "all"
      ? agent.outputs
      : agent.outputs.filter((o) => o.outputType === typeFilter);
  const grouped = groupOutputsByWeek(filteredOutputs);

  return (
    <div>
      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <div className="relative">
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setShowTimeframePicker((v) => !v)}
            disabled={generating}
          >
            <Sparkles size={13} />
            {generating ? "Generating..." : "Generate"}
          </Button>
          {showTimeframePicker && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-white border border-zinc-200 rounded-lg shadow-lg w-44 py-1">
              {TIMEFRAMES.map((tf) => (
                <button
                  key={tf.value}
                  onClick={() => handleGenerate(tf.value)}
                  className="w-full text-left px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  {tf.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {shareToken ? (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={copyShareUrl}
            >
              {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy share link"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-zinc-500"
              onClick={handleRevokeShare}
              disabled={sharingLoading}
            >
              <Link2Off size={13} />
              Revoke link
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleShare}
            disabled={sharingLoading}
          >
            <Globe size={13} />
            Share
          </Button>
        )}
      </div>

      {generationError && (
        <p className="text-sm text-red-600 mb-4">{generationError}</p>
      )}

      {/* Type filter */}
      {agent.outputs.length > 0 && (
        <div className="flex items-center gap-1 mb-6">
          {(["all", "kb", "customer_update"] as const).map((f) => {
            const label = f === "all" ? "All" : f === "kb" ? "KB Articles" : "Customer Updates";
            return (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  typeFilter === f
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* Outputs grouped by week */}
      {grouped.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-zinc-300 rounded-xl">
          {agent.outputs.length === 0 ? (
            <>
              <p className="text-sm text-zinc-500">No content generated yet.</p>
              <p className="text-xs text-zinc-400 mt-1">Click Generate to create your first draft.</p>
            </>
          ) : (
            <p className="text-sm text-zinc-500">No outputs match this filter.</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(({ week, year, outputs }) => (
            <div key={`${year}-${week}`}>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Week {week} · {year}
              </p>
              <div className="space-y-4">
                {outputs.map((output) => (
                  <OutputCard
                    key={output.id}
                    output={output}
                    onToggleStatus={toggleStatus}
                    onCopyContent={copyContent}
                    isToggling={togglingStatus === output.id}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface OutputCardProps {
  output: ContentOutput;
  onToggleStatus: (id: string, currentStatus: string) => void;
  onCopyContent: (content: string) => void;
  isToggling: boolean;
}

function OutputCard({ output, onToggleStatus, onCopyContent, isToggling }: OutputCardProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [suggestLoadingId, setSuggestLoadingId] = useState<number | null>(null);
  const [suggestion, setSuggestion] = useState<{ articleTitle: string; text: string } | null>(null);
  const [suggestionCopied, setSuggestionCopied] = useState(false);

  const articles: ZendeskArticle[] = output.zendeskArticles
    ? (JSON.parse(output.zendeskArticles) as ZendeskArticle[])
    : [];

  async function handleCopy() {
    await onCopyContent(output.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSuggestEdit(article: ZendeskArticle) {
    setSuggestLoadingId(article.id);
    const res = await fetch(`/api/content-outputs/${output.id}/suggest-edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articleId: article.id, articleTitle: article.title, articleUrl: article.url }),
    });
    if (res.ok) {
      const { suggestion: text } = await res.json();
      setSuggestion({ articleTitle: article.title, text });
    }
    setSuggestLoadingId(null);
  }

  async function copySuggestion() {
    if (!suggestion) return;
    await navigator.clipboard.writeText(suggestion.text);
    setSuggestionCopied(true);
    setTimeout(() => setSuggestionCopied(false), 2000);
  }

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                output.outputType === "kb"
                  ? "bg-blue-50 text-blue-700 border-blue-100"
                  : "bg-orange-50 text-orange-700 border-orange-100"
              }`}
            >
              {output.outputType === "kb" ? "KB Article" : "Customer Update"}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                output.status === "published"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-zinc-100 text-zinc-500 border-zinc-200"
              }`}
            >
              {output.status}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopy}
              className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1 transition-colors"
            >
              {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1 transition-colors"
            >
              <Expand size={12} />
              Expand
            </button>
            <button
              onClick={() => onToggleStatus(output.id, output.status)}
              disabled={isToggling}
              className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded px-2 py-0.5 transition-colors disabled:opacity-50"
            >
              {isToggling ? "..." : output.status === "published" ? "Unpublish" : "Publish"}
            </button>
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-zinc-900 mb-2">{output.title}</p>
          <div className="text-sm text-zinc-600 whitespace-pre-wrap line-clamp-6">
            {output.content}
          </div>
        </div>

        {articles.length > 0 && (
          <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50">
            <p className="text-xs font-medium text-zinc-500 mb-2">Related Zendesk articles</p>
            <div className="space-y-1.5">
              {articles.map((article) => (
                <div key={article.id} className="flex items-center justify-between gap-3">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline truncate"
                  >
                    {article.title}
                  </a>
                  <button
                    onClick={() => handleSuggestEdit(article)}
                    disabled={suggestLoadingId === article.id}
                    className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded px-2 py-0.5 bg-white transition-colors shrink-0 flex items-center gap-1 disabled:opacity-50"
                  >
                    {suggestLoadingId === article.id ? (
                      <><Loader2 size={10} className="animate-spin" /> Generating...</>
                    ) : (
                      "Suggest Edit"
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <p className="text-sm font-semibold text-zinc-900">{output.title}</p>
              <button
                onClick={() => setExpanded(false)}
                className="text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-6 py-5 overflow-y-auto">
              <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                {output.content}
              </div>
            </div>
          </div>
        </div>
      )}

      {suggestion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSuggestion(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 shrink-0">
              <div>
                <p className="text-sm font-semibold text-zinc-900">Suggested edits</p>
                <p className="text-xs text-zinc-500 mt-0.5">{suggestion.articleTitle}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copySuggestion}
                  className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 rounded px-2 py-1 flex items-center gap-1 transition-colors"
                >
                  {suggestionCopied ? <Check size={11} className="text-green-600" /> : <Copy size={11} />}
                  {suggestionCopied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => setSuggestion(null)}
                  className="text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="px-6 py-5 overflow-y-auto">
              <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                {suggestion.text}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function groupOutputsByWeek(outputs: ContentOutput[]) {
  const map = new Map<string, { week: number; year: number; outputs: ContentOutput[] }>();
  for (const output of outputs) {
    const key = `${output.year}-${output.isoWeek}`;
    if (!map.has(key)) {
      map.set(key, { week: output.isoWeek, year: output.year, outputs: [] });
    }
    map.get(key)!.outputs.push(output);
  }
  return [...map.values()].sort((a, b) => b.year - a.year || b.week - a.week);
}
