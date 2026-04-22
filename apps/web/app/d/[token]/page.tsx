import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { UpdateContent } from "@/components/update-content";
import { LocalTime } from "@/components/local-time";
import { WowSparklineChart } from "@/components/wow-sparkline";
import { BannerPreviewSvg, bannerHash } from "@/components/banner-preview-svg";
import { getISOWeek, getISOWeekYear, subWeeks } from "date-fns";
import { Zap, Sparkles, Wrench, TrendingUp, Star } from "lucide-react";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pl?: string }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function classifySection(headline: string): "bug" | "feature" | "update" {
  const h = headline.toLowerCase();
  // No-op entries ("no new user-facing changes", "no changes in this release", etc.) → never a feature
  if (/\bno\s+(new|changes?|updates?|user.facing)\b/.test(h)) return "update";
  if (/\b(fix(es|ed|ing)?|bug|patch(ed)?|hotfix|resolv(es|ed)?|regression|crash)\b/.test(h)) return "bug";
  // Only promote to feature on strong launch/ship signals; drop "released?" (matches "in this release")
  if (/\b(launch(ed)?|major|introduc(es|ed)?|ship(ped)?)\b/.test(h) || /\bnew\s+\w/.test(h)) return "feature";
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

function formatLastUpdate(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PublicDashboardPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { pl: plParam } = await searchParams;

  const dashboardInvite = await prisma.dashboardInvite.findUnique({
    where: { token },
    include: { org: true },
  });

  if (!dashboardInvite) notFound();
  if (dashboardInvite.expiresAt && dashboardInvite.expiresAt < new Date()) notFound();

  const productLines = await prisma.productLine.findMany({
    where: { orgId: dashboardInvite.orgId },
    include: {
      jiraConfig: { select: { atlassianDomain: true, baseUrl: true } },
      updates: {
        orderBy: [{ year: "desc" }, { isoWeek: "desc" }],
        take: 52,
      },
      _count: { select: { triggerEvents: true, updates: true } },
    },
    orderBy: { name: "asc" },
  });

  const plsWithUpdates = productLines.filter((pl) => pl.updates.length > 0);
  const selectedPl = plsWithUpdates.find((pl) => pl.id === plParam) ?? plsWithUpdates[0];

  const jiraBaseUrl = selectedPl?.jiraConfig
    ? selectedPl.jiraConfig.atlassianDomain
      ? `https://${selectedPl.jiraConfig.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : selectedPl.jiraConfig.baseUrl.replace(/\/+$/, "")
    : undefined;

  // ── Metrics for selected product line ────────────────────────────────────────
  let plBugs = 0; let plFeatures = 0; let plImprovements = 0;
  if (selectedPl) {
    for (const u of selectedPl.updates) {
      for (const type of parseAndClassify(u.content)) {
        if (type === "bug") plBugs++;
        else if (type === "feature") plFeatures++;
        else plImprovements++;
      }
    }
  }
  const plTotalRuns = selectedPl?._count.triggerEvents ?? 0;
  const plTotalUpdates = selectedPl?._count.updates ?? 0;

  // ── WoW stats for selected product line ────────────────────────────────────
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

  const wowStats = last4Weeks.map(({ week, year, offset, label }) => {
    const update = selectedPl?.updates.find((u) => u.isoWeek === week && u.year === year);
    let sections = 0; let bugs = 0; let features = 0; let improvements = 0;
    if (update) {
      for (const type of parseAndClassify(update.content)) {
        sections++;
        if (type === "bug") bugs++;
        else if (type === "feature") features++;
        else improvements++;
      }
    }
    return { label, sections, bugs, features, improvements, isLatest: offset === 0 };
  });

  const hasWow = wowStats.some((w) => w.sections > 0);

  // ── Most-recently-updated product line (for "Latest" badge) ─────────────────
  const latestPlId = plsWithUpdates.reduce<string | null>((best, pl) => {
    if (!best) return pl.id;
    const bestDate = plsWithUpdates.find((p) => p.id === best)!.updates[0]?.updatedAt ?? new Date(0);
    const plDate = pl.updates[0]?.updatedAt ?? new Date(0);
    return plDate > bestDate ? pl.id : best;
  }, null);

  // ── Latest update hero banner ───────────────────────────────────────────────
  const latestUpdate = selectedPl?.updates[0];
  const latestHeadline = latestUpdate ? extractFirstHeadline(latestUpdate.content) : null;
  const latestSeed = latestUpdate ? bannerHash(`${latestUpdate.id}-0`) : 0;
  const latestUid = latestUpdate ? latestUpdate.id.replace(/[^a-z0-9]/gi, "") : "";

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      {/* Header */}
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex-shrink-0 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M3 8 L6 5 L8 7 L10 3 L13 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="3" cy="8" r="1.2" fill="white"/>
            <circle cx="13" cy="8" r="1.2" fill="white"/>
          </svg>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider leading-none">Syncop</p>
          <h1 className="text-[15px] font-semibold text-zinc-900 leading-snug mt-0.5">{dashboardInvite.org.name}</h1>
        </div>
      </header>

      {productLines.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">No product lines yet.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left sidebar ── */}
          <aside className="w-64 border-r border-zinc-200 bg-white flex-shrink-0 overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                Product Lines
              </p>
              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 rounded-full px-1.5 py-0.5">
                {plsWithUpdates.length}
              </span>
            </div>

            {plsWithUpdates.map((pl) => {
              const isSelected = pl.id === selectedPl?.id;
              const isLatest = pl.id === latestPlId;
              const lastUpdate = pl.updates[0];
              const firstHeadline = extractFirstHeadline(lastUpdate.content);
              const miniSeed = bannerHash(`${lastUpdate.id}-0`);
              const miniUid = `sb-${pl.id.replace(/[^a-z0-9]/gi, "")}`;

              return (
                <a
                  key={pl.id}
                  href={`?pl=${pl.id}`}
                  className={`block border-b border-zinc-100 relative transition-colors group ${
                    isSelected ? "bg-violet-50" : "hover:bg-zinc-50"
                  }`}
                >
                  {/* Left accent bar */}
                  <div className={`absolute left-0 top-0 bottom-0 w-[3px] transition-colors rounded-r-full ${
                    isSelected ? "bg-violet-500" : "bg-transparent group-hover:bg-zinc-200"
                  }`} />

                  <div className="px-3 pt-3 pb-2.5 pl-4">
                    {/* Compact gradient banner */}
                    <div className="rounded-md overflow-hidden mb-2">
                      <svg viewBox="0 0 300 36" xmlns="http://www.w3.org/2000/svg" className="w-full block">
                        <defs>
                          <linearGradient id={`sg-${miniUid}`} x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor={getSeedColor(miniSeed, "from")} />
                            <stop offset="100%" stopColor={getSeedColor(miniSeed, "to")} />
                          </linearGradient>
                        </defs>
                        <rect width="300" height="36" fill={`url(#sg-${miniUid})`} />
                        <circle cx="240" cy="18" r="40" fill="rgba(255,255,255,0.08)" />
                        <circle cx="290" cy="36" r="28" fill="rgba(255,255,255,0.05)" />
                      </svg>
                    </div>

                    {/* Name + Latest badge */}
                    <div className="flex items-start justify-between gap-1.5">
                      <p className={`text-[13px] font-semibold truncate leading-snug flex-1 min-w-0 ${
                        isSelected ? "text-violet-800" : "text-zinc-800"
                      }`}>
                        {pl.name}
                      </p>
                      {isLatest && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-violet-500 bg-violet-50 border border-violet-100 rounded-full px-1.5 py-0.5 flex-shrink-0 mt-0.5">
                          Latest
                        </span>
                      )}
                    </div>

                    {/* First headline */}
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5 leading-snug">
                      {firstHeadline}
                    </p>

                    {/* Metadata */}
                    <p className={`text-[10px] mt-1.5 ${isSelected ? "text-violet-400" : "text-zinc-400"}`}>
                      {formatLastUpdate(lastUpdate.updatedAt)}
                      <span className="mx-1 opacity-50">·</span>
                      W{lastUpdate.isoWeek}
                      <span className="mx-1 opacity-50">·</span>
                      {pl._count.updates} update{pl._count.updates !== 1 ? "s" : ""}
                    </p>
                  </div>
                </a>
              );
            })}
          </aside>

          {/* ── Right main ── */}
          <main className="flex-1 overflow-y-auto">
            {selectedPl ? (
              <div className="max-w-2xl mx-auto px-8 py-8">

                {/* Hero banner for latest update */}
                {latestUpdate && latestHeadline && (
                  <div className="mb-8 rounded-2xl overflow-hidden shadow-sm border border-zinc-100">
                    <BannerPreviewSvg seed={latestSeed} uid={`hero-${latestUid}`} title={latestHeadline} />
                    <div className="bg-white px-5 py-3 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-zinc-900 truncate">{latestHeadline}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">
                          Week {latestUpdate.isoWeek}, {latestUpdate.year}
                          {" · "}
                          <LocalTime iso={latestUpdate.updatedAt.toISOString()} className="text-[11px] text-zinc-400" />
                        </p>
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-violet-600 bg-violet-50 border border-violet-100 rounded-full px-2.5 py-1">
                        Latest
                      </span>
                    </div>
                  </div>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-5 gap-3 mb-8">
                  {(
                    [
                      { label: "Total Runs",        value: plTotalRuns,    icon: Zap,       bg: "bg-blue-50",   border: "border-blue-100",   text: "text-blue-700",   iconCls: "text-blue-400" },
                      { label: "Updates Generated", value: plTotalUpdates, icon: Sparkles,  bg: "bg-violet-50", border: "border-violet-100", text: "text-violet-700", iconCls: "text-violet-400" },
                      { label: "Bug Fixes",         value: plBugs,         icon: Wrench,    bg: "bg-red-50",    border: "border-red-100",    text: "text-red-700",    iconCls: "text-red-400" },
                      { label: "Improvements",      value: plImprovements, icon: TrendingUp, bg: "bg-amber-50", border: "border-amber-100",  text: "text-amber-700",  iconCls: "text-amber-400" },
                      { label: "Major Features",    value: plFeatures,     icon: Star,      bg: "bg-green-50",  border: "border-green-100",  text: "text-green-700",  iconCls: "text-green-400" },
                    ] as const
                  ).map(({ label, value, icon: Icon, bg, border, text, iconCls }) => (
                    <div key={label} className={`rounded-xl border px-4 py-4 ${bg} ${border}`}>
                      <div className="flex items-center justify-between mb-3">
                        <p className={`text-xs font-medium ${text} opacity-70`}>{label}</p>
                        <Icon size={14} className={iconCls} />
                      </div>
                      <p className={`text-[28px] font-bold leading-none tracking-tight ${text}`}>
                        {value.toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>

                {/* WoW chart */}
                {hasWow && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">Week over Week</h3>
                      <span className="text-[10px] text-zinc-300">Sections · last 4 weeks</span>
                    </div>
                    <WowSparklineChart data={wowStats} />
                  </div>
                )}

                {/* Product line name */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-zinc-900">{selectedPl.name}</h2>
                  {selectedPl.description && (
                    <p className="text-sm text-zinc-500 mt-1">{selectedPl.description}</p>
                  )}
                </div>

                {/* Updates */}
                {selectedPl.updates.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">No updates yet.</p>
                ) : (
                  <div className="space-y-10">
                    {selectedPl.updates.map((update) => (
                      <div key={update.id}>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                            Week {update.isoWeek}, {update.year}
                          </p>
                          <span className="text-xs text-zinc-300">·</span>
                          <LocalTime iso={update.updatedAt.toISOString()} className="text-xs text-zinc-400" />
                        </div>
                        <UpdateContent
                          content={update.content}
                          jiraBaseUrl={jiraBaseUrl}
                          updateId={update.id}
                          staticBanners
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-zinc-400">Select a product line to view updates.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

// ─── Palette helpers (mirrors BANNER_PALETTES order) ──────────────────────────

const PALETTE_COLORS = [
  { from: "#C2410C", to: "#F97316" },
  { from: "#6B21A8", to: "#A855F7" },
  { from: "#1D4ED8", to: "#60A5FA" },
  { from: "#065F46", to: "#34D399" },
  { from: "#9D174D", to: "#F472B6" },
  { from: "#92400E", to: "#FCD34D" },
  { from: "#134E4A", to: "#2DD4BF" },
  { from: "#312E81", to: "#818CF8" },
  { from: "#9F1239", to: "#FB7185" },
  { from: "#365314", to: "#A3E635" },
  { from: "#0C4A6E", to: "#38BDF8" },
  { from: "#701A75", to: "#E879F9" },
];

function getSeedColor(seed: number, key: "from" | "to"): string {
  return PALETTE_COLORS[seed % PALETTE_COLORS.length][key];
}
