import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Zap, Sparkles, Clock, Wrench, Star, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Section classification ───────────────────────────────────────────────────

function classifySection(headline: string): "bug" | "feature" | "update" {
  const h = headline.toLowerCase();
  if (/\b(fix(es|ed)?|bug|patch(ed)?|hotfix|resolv(es|ed)?|regression|crash)\b/.test(h)) return "bug";
  if (/\b(launch(ed)?|major|introduc(es|ed)?|ship(ped)?|released?)\b/.test(h) || /\bnew\s+\w/.test(h)) return "feature";
  return "update";
}

function parseAndClassify(content: string): Array<"bug" | "feature" | "update"> {
  return content
    .split(/\n\n---\n\n|\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const source = raw.replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "").trimStart();
      const firstLine = source.split("\n")[0] ?? "";
      const m = firstLine.match(/^\*\*(.+)\*\*$/);
      return classifySection(m?.[1] ?? firstLine);
    });
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  bg,
  border,
  text,
  iconCls,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  bg: string;
  border: string;
  text: string;
  iconCls: string;
}) {
  return (
    <div className={`rounded-xl border px-4 py-4 ${bg} ${border}`}>
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-medium ${text} opacity-70`}>{label}</p>
        <Icon size={14} className={iconCls} />
      </div>
      <p className={`text-[28px] font-bold leading-none tracking-tight ${text}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductLinesPage() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const [productLines, updateCountsRaw, lastRunsRaw, totalRunsResult, allUpdates] =
    await Promise.all([
      prisma.productLine.findMany({
        where: { orgId },
        include: {
          agent: { select: { id: true, ownerId: true } },
          _count: {
            select: {
              gitTriggers: true,
              triggerEvents: { where: { status: { not: "skipped" } } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.triggerEvent.groupBy({
        by: ["productLineId"],
        where: { productLine: { orgId }, agentDecision: "update_created" },
        _count: { id: true },
      }),
      prisma.triggerEvent.groupBy({
        by: ["productLineId"],
        where: { productLine: { orgId }, status: { not: "skipped" } },
        _max: { createdAt: true },
      }),
      prisma.triggerEvent.aggregate({
        where: { productLine: { orgId }, status: { not: "skipped" } },
        _count: { id: true },
      }),
      prisma.update.findMany({
        where: { productLine: { orgId } },
        select: { content: true },
      }),
    ]);

  const updateCountMap = new Map(updateCountsRaw.map((r) => [r.productLineId, r._count.id]));
  const lastRunMap = new Map(lastRunsRaw.map((r) => [r.productLineId, r._max.createdAt]));

  // Classify sections across all generated updates
  let bugFixes = 0;
  let bigFeatures = 0;
  let improvements = 0;
  for (const u of allUpdates) {
    for (const type of parseAndClassify(u.content)) {
      if (type === "bug") bugFixes++;
      else if (type === "feature") bigFeatures++;
      else improvements++;
    }
  }

  const totalRuns = totalRunsResult._count.id;
  const totalUpdatesCreated = updateCountsRaw.reduce((sum, r) => sum + r._count.id, 0);

  // Owner users
  const ownerIds = [
    ...new Set(
      productLines.map((pl) => pl.agent?.ownerId).filter(Boolean) as string[]
    ),
  ];
  const owners =
    ownerIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: ownerIds } },
          select: { id: true, name: true, email: true, avatarUrl: true },
        })
      : [];
  const ownerMap = new Map(owners.map((u) => [u.id, u]));

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

      {/* ── Metrics ── */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        <MetricCard
          label="Total Runs"
          value={totalRuns}
          icon={Zap}
          bg="bg-blue-50"
          border="border-blue-100"
          text="text-blue-700"
          iconCls="text-blue-400"
        />
        <MetricCard
          label="Updates Generated"
          value={totalUpdatesCreated}
          icon={Sparkles}
          bg="bg-violet-50"
          border="border-violet-100"
          text="text-violet-700"
          iconCls="text-violet-400"
        />
        <MetricCard
          label="Bug Fixes"
          value={bugFixes}
          icon={Wrench}
          bg="bg-red-50"
          border="border-red-100"
          text="text-red-700"
          iconCls="text-red-400"
        />
        <MetricCard
          label="Improvements"
          value={improvements}
          icon={TrendingUp}
          bg="bg-amber-50"
          border="border-amber-100"
          text="text-amber-700"
          iconCls="text-amber-400"
        />
        <MetricCard
          label="Major Features"
          value={bigFeatures}
          icon={Star}
          bg="bg-green-50"
          border="border-green-100"
          text="text-green-700"
          iconCls="text-green-400"
        />
      </div>

      {/* ── Product lines ── */}
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
        <>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
            {productLines.length} product line{productLines.length !== 1 ? "s" : ""}
          </p>
          <div className="space-y-3">
            {productLines.map((pl) => {
              const updateCount = updateCountMap.get(pl.id) ?? 0;
              const lastRun = lastRunMap.get(pl.id);
              const owner = pl.agent?.ownerId ? ownerMap.get(pl.agent.ownerId) : null;
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
                    {owner && (
                      <div className="flex items-center gap-1.5 mt-2.5">
                        {owner.avatarUrl ? (
                          <img src={owner.avatarUrl} alt="" className="w-4 h-4 rounded-full" />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-zinc-200 flex items-center justify-center text-[9px] font-semibold text-zinc-600">
                            {(owner.name ?? owner.email)[0].toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs text-zinc-400">{owner.name ?? owner.email}</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight
                    size={15}
                    className="text-zinc-400 group-hover:text-zinc-600 transition-colors"
                  />
                </Link>
              );
            })}
          </div>
        </>
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
