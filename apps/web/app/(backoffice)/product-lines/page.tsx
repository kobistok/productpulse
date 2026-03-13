import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Zap, Sparkles, Clock } from "lucide-react";

export default async function ProductLinesPage() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const [productLines, updateCountsRaw, lastRunsRaw] = await Promise.all([
    prisma.productLine.findMany({
      where: { orgId },
      include: {
        agent: { select: { id: true } },
        _count: {
          select: {
            gitTriggers: true,
            triggerEvents: { where: { status: { not: "skipped" } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Count of trigger events where agent actually created an update
    prisma.triggerEvent.groupBy({
      by: ["productLineId"],
      where: { productLine: { orgId }, agentDecision: "update_created" },
      _count: { id: true },
    }),
    // Most recent run date per product line
    prisma.triggerEvent.groupBy({
      by: ["productLineId"],
      where: { productLine: { orgId }, status: { not: "skipped" } },
      _max: { createdAt: true },
    }),
  ]);

  const updateCountMap = new Map(updateCountsRaw.map((r) => [r.productLineId, r._count.id]));
  const lastRunMap = new Map(lastRunsRaw.map((r) => [r.productLineId, r._max.createdAt]));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Product Lines</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your products and their AI agents
          </p>
        </div>
        <Link href="/product-lines/new">
          <Button size="sm" className="gap-1.5">
            <Plus size={13} />
            New Product Line
          </Button>
        </Link>
      </div>

      {productLines.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-zinc-300 rounded-xl">
          <p className="text-sm text-zinc-500">No product lines yet.</p>
          <Link href="/product-lines/new">
            <Button variant="outline" size="sm" className="mt-4">
              Create your first product line
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {productLines.map((pl) => {
            const updateCount = updateCountMap.get(pl.id) ?? 0;
            const lastRun = lastRunMap.get(pl.id);
            return (
              <Link
                key={pl.id}
                href={`/product-lines/${pl.id}`}
                className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 transition-colors group"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{pl.name}</p>
                  {pl.description && (
                    <p className="text-sm text-zinc-500 mt-0.5">{pl.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    {pl.agent ? (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                        No agent
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100">
                      <Zap size={10} className="shrink-0" />
                      {pl._count.triggerEvents} run{pl._count.triggerEvents !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-violet-50 text-violet-700 border border-violet-100">
                      <Sparkles size={10} className="shrink-0" />
                      {updateCount} update{updateCount !== 1 ? "s" : ""}
                    </span>
                    {lastRun && (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-50 text-zinc-500 border border-zinc-200">
                        <Clock size={10} className="shrink-0" />
                        {formatRelative(lastRun)}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  size={15}
                  className="text-zinc-400 group-hover:text-zinc-600 transition-colors"
                />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelative(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
