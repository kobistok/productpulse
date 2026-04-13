import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Zap, Sparkles, Clock, Wrench, Star, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getISOWeek, getISOWeekYear, subWeeks } from "date-fns";
import { BannerPreviewSvg, MiniBannerPreviewSvg, bannerHash } from "@/components/banner-preview-svg";

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

function extractFirstHeadline(content: string): string {
  const first = content.split(/\n\n---\n\n|\n---\n/).map((s) => s.trim()).filter(Boolean)[0] ?? "";
  const source = first.replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "").trimStart();
  const firstLine = source.split("\n")[0] ?? "";
  const m = firstLine.match(/^\*\*(.+)\*\*$/);
  return m?.[1] ?? firstLine;
}

// ─── Metric card ──────────────────────────────────────────────────────────────

function MetricCard({
  label, value, icon: Icon, bg, border, text, iconCls,
}: {
  label: string; value: number; icon: LucideIcon;
  bg: string; border: string; text: string; iconCls: string;
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

// ─── WoW sparkline (pure SVG, server-renderable) ──────────────────────────────

function WowSparkline({ values }: { values: number[] }) {
  const W = 500; const H = 44; const padX = 20; const padY = 10;
  const n = values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xs = values.map((_, i) => padX + (i / (n - 1)) * (W - padX * 2));
  const ys = values.map((v) => H - padY - ((v - min) / range) * (H - padY * 2));
  const bezier = xs
    .map((x, i) => {
      if (i === 0) return `M ${x.toFixed(1)},${ys[i].toFixed(1)}`;
      const cpx = ((xs[i - 1] + x) / 2).toFixed(1);
      return `C ${cpx},${ys[i - 1].toFixed(1)} ${cpx},${ys[i].toFixed(1)} ${x.toFixed(1)},${ys[i].toFixed(1)}`;
    })
    .join(" ");
  const area = `${bezier} L ${xs[n - 1].toFixed(1)},${H} L ${xs[0].toFixed(1)},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 44 }}>
      <defs>
        <linearGradient id="wow-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(139,92,246,0.18)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#wow-fill)" />
      <path d={bezier} fill="none" stroke="rgba(139,92,246,0.65)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle
          key={i}
          cx={x.toFixed(1)}
          cy={ys[i].toFixed(1)}
          r={i === n - 1 ? 4.5 : 3.5}
          fill={i === n - 1 ? "#7c3aed" : "rgba(139,92,246,0.55)"}
          stroke={i === n - 1 ? "rgba(124,58,237,0.25)" : "none"}
          strokeWidth="6"
        />
      ))}
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProductLinesPage() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const now = new Date();
  const last4Weeks = [3, 2, 1, 0].map((offset) => {
    const d = subWeeks(now, offset);
    return {
      week: getISOWeek(d),
      year: getISOWeekYear(d),
      offset,
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });

  const [
    productLines,
    updateCountsRaw,
    lastRunsRaw,
    totalRunsResult,
    allUpdates,
    latestUpdatesRaw,
  ] = await Promise.all([
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
    // All updates (for metrics + WoW computation)
    prisma.update.findMany({
      where: { productLine: { orgId } },
      select: { content: true, isoWeek: true, year: true },
    }),
    // Latest 2 updates (for banners section)
    prisma.update.findMany({
      where: { productLine: { orgId } },
      include: { productLine: { select: { id: true, name: true } } },
      orderBy: [{ year: "desc" }, { isoWeek: "desc" }, { updatedAt: "desc" }],
      take: 2,
    }),
  ]);

  const updateCountMap = new Map(updateCountsRaw.map((r) => [r.productLineId, r._count.id]));
  const lastRunMap     = new Map(lastRunsRaw.map((r) => [r.productLineId, r._max.createdAt]));

  // ── All-time metrics ─────────────────────────────────────────────────────────
  let bugFixes = 0; let bigFeatures = 0; let improvements = 0;
  for (const u of allUpdates) {
    for (const type of parseAndClassify(u.content)) {
      if (type === "bug") bugFixes++;
      else if (type === "feature") bigFeatures++;
      else improvements++;
    }
  }
  const totalRuns = totalRunsResult._count.id;
  const totalUpdatesCreated = updateCountsRaw.reduce((sum, r) => sum + r._count.id, 0);

  // ── Week over Week stats ──────────────────────────────────────────────────────
  const wowStats = last4Weeks.map(({ week, year, offset, label }) => {
    const weekUpdates = allUpdates.filter((u) => u.isoWeek === week && u.year === year);
    let sections = 0; let bugs = 0; let features = 0; let improv = 0;
    for (const u of weekUpdates) {
      for (const type of parseAndClassify(u.content)) {
        sections++;
        if (type === "bug") bugs++;
        else if (type === "feature") features++;
        else improv++;
      }
    }
    return {
      week, year, label, sections, bugs, features, improvements: improv,
      seed: bannerHash(`wow-${week}-${year}`),
      isLatest: offset === 0,
    };
  });
  const hasWowData = wowStats.some((w) => w.sections > 0);

  // ── Latest updates for banner display ────────────────────────────────────────
  const latestUpdatesDisplay = latestUpdatesRaw.map((u) => {
    const sectionCount = u.content.split(/\n\n---\n\n|\n---\n/).filter((s) => s.trim()).length;
    return {
      id: u.id,
      headline: extractFirstHeadline(u.content),
      productLineName: u.productLine.name,
      productLineId: u.productLine.id,
      isoWeek: u.isoWeek,
      year: u.year,
      sectionCount,
      seed: bannerHash(`${u.id}-0`),
      uid: u.id.replace(/[^a-z0-9]/gi, ""),
    };
  });

  // Owner users
  const ownerIds = [
    ...new Set(productLines.map((pl) => pl.agent?.ownerId).filter(Boolean) as string[]),
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
          <p className="text-sm text-zinc-500 mt-1">Manage your products and their AI agents</p>
        </div>
        <Link href="/product-lines/new">
          <Button size="sm" className="gap-1.5">
            <Plus size={13} />
            New Product Line
          </Button>
        </Link>
      </div>

      {/* ── All-time metrics ── */}
      <div className="grid grid-cols-5 gap-3 mb-8">
        <MetricCard label="Total Runs"        value={totalRuns}           icon={Zap}       bg="bg-blue-50"   border="border-blue-100"   text="text-blue-700"   iconCls="text-blue-400" />
        <MetricCard label="Updates Generated" value={totalUpdatesCreated} icon={Sparkles}  bg="bg-violet-50" border="border-violet-100" text="text-violet-700" iconCls="text-violet-400" />
        <MetricCard label="Bug Fixes"         value={bugFixes}            icon={Wrench}    bg="bg-red-50"    border="border-red-100"    text="text-red-700"    iconCls="text-red-400" />
        <MetricCard label="Improvements"      value={improvements}        icon={TrendingUp} bg="bg-amber-50" border="border-amber-100"  text="text-amber-700"  iconCls="text-amber-400" />
        <MetricCard label="Major Features"    value={bigFeatures}         icon={Star}      bg="bg-green-50"  border="border-green-100"  text="text-green-700"  iconCls="text-green-400" />
      </div>

      {/* ── Week over Week ── */}
      {hasWowData && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-800">Week over Week</h2>
            <span className="text-xs text-zinc-400">Sections delivered · last 4 weeks</span>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-2">
            {wowStats.map((w, i) => {
              const prev = i > 0 ? wowStats[i - 1].sections : null;
              const delta = prev !== null ? w.sections - prev : null;
              return (
                <div
                  key={`${w.week}-${w.year}`}
                  className={`rounded-xl border overflow-hidden ${
                    w.isLatest
                      ? "border-violet-200 bg-violet-50/60 shadow-sm shadow-violet-100"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <div className="overflow-hidden">
                    <MiniBannerPreviewSvg seed={w.seed} uid={`wow-${w.week}-${w.year}`} />
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className={`text-2xl font-bold tracking-tight ${w.isLatest ? "text-violet-700" : "text-zinc-800"}`}>
                        {w.sections}
                      </span>
                      {delta !== null && (
                        <span className={`text-[11px] font-semibold ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-red-500" : "text-zinc-400"}`}>
                          {delta > 0 ? `+${delta}` : delta === 0 ? "–" : delta}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{w.label}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {w.features > 0 && (
                        <span className="text-[10px] font-medium text-green-700 bg-green-50 border border-green-100 rounded-full px-1.5 py-0.5">
                          {w.features} feature{w.features !== 1 ? "s" : ""}
                        </span>
                      )}
                      {w.bugs > 0 && (
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 border border-red-100 rounded-full px-1.5 py-0.5">
                          {w.bugs} fix{w.bugs !== 1 ? "es" : ""}
                        </span>
                      )}
                    </div>
                    {w.isLatest && (
                      <p className="text-[9px] font-bold uppercase tracking-widest text-violet-500 mt-1.5">
                        Current week
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Sparkline */}
          <div className="rounded-xl border border-zinc-100 bg-white px-5 py-3">
            <WowSparkline values={wowStats.map((w) => w.sections)} />
            <div className="flex justify-between mt-1 px-[20px]">
              {wowStats.map((w) => (
                <span key={`${w.week}-${w.year}-lbl`} className={`text-[10px] ${w.isLatest ? "text-violet-500 font-semibold" : "text-zinc-400"}`}>
                  {w.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Latest Updates with banners ── */}
      {latestUpdatesDisplay.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-800">Latest Updates</h2>
            <span className="text-xs text-zinc-400">Most recent AI-generated content</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {latestUpdatesDisplay.map((u) => (
              <Link
                key={u.id}
                href={`/product-lines/${u.productLineId}`}
                className="rounded-xl border border-zinc-200 bg-white overflow-hidden hover:border-zinc-300 hover:shadow-sm transition-all group"
              >
                <div className="overflow-hidden" style={{ aspectRatio: "3/1" }}>
                  <BannerPreviewSvg seed={u.seed} uid={u.uid} title={u.headline} />
                </div>
                <div className="flex items-center gap-2 px-3.5 py-3">
                  <span className="text-[13px] font-medium text-zinc-900 truncate flex-1 group-hover:text-zinc-700 transition-colors">
                    {u.headline}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px] text-zinc-400">
                    <span className="font-medium text-zinc-500">{u.productLineName}</span>
                    <span>·</span>
                    <span>Wk {u.isoWeek}</span>
                    <span>·</span>
                    <span>{u.sectionCount} section{u.sectionCount !== 1 ? "s" : ""}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Product lines list ── */}
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
                  <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
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
  if (diffMins < 1)  return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7)  return `${diffDays}d ago`;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
