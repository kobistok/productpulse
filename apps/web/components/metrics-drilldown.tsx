"use client";

import { useState, useEffect, useRef } from "react";
import { Zap, Sparkles, Wrench, TrendingUp, Star, X, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SectionDetail = {
  headline: string;
  product: string;
  productLineId: string;
  week: number;
  year: number;
};

type DrillType = "bug" | "improvement" | "feature";

// ─── Config ───────────────────────────────────────────────────────────────────

const DRILL_CONFIG: Record<DrillType, {
  label: string;
  emptyLabel: string;
  cardBg: string;
  cardBorder: string;
  cardText: string;
  cardIcon: string;
  icon: LucideIcon;
  pillBg: string;
  pillText: string;
  pillBorder: string;
  dotColor: string;
  headerBg: string;
  headerText: string;
}> = {
  bug: {
    label: "Bug Fixes",
    emptyLabel: "No bug fixes recorded yet.",
    cardBg: "bg-red-50",
    cardBorder: "border-red-100",
    cardText: "text-red-700",
    cardIcon: "text-red-400",
    icon: Wrench,
    pillBg: "bg-red-50",
    pillText: "text-red-600",
    pillBorder: "border-red-100",
    dotColor: "bg-red-400",
    headerBg: "bg-red-50",
    headerText: "text-red-700",
  },
  improvement: {
    label: "Improvements",
    emptyLabel: "No improvements recorded yet.",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-100",
    cardText: "text-amber-700",
    cardIcon: "text-amber-400",
    icon: TrendingUp,
    pillBg: "bg-amber-50",
    pillText: "text-amber-600",
    pillBorder: "border-amber-100",
    dotColor: "bg-amber-400",
    headerBg: "bg-amber-50",
    headerText: "text-amber-700",
  },
  feature: {
    label: "Major Features",
    emptyLabel: "No major features recorded yet.",
    cardBg: "bg-green-50",
    cardBorder: "border-green-100",
    cardText: "text-green-700",
    cardIcon: "text-green-400",
    icon: Star,
    pillBg: "bg-green-50",
    pillText: "text-green-600",
    pillBorder: "border-green-100",
    dotColor: "bg-green-400",
    headerBg: "bg-green-50",
    headerText: "text-green-700",
  },
};

// ─── Static (non-drillable) metric card ───────────────────────────────────────

function StaticCard({
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

// ─── Drillable metric card ────────────────────────────────────────────────────

function DrillCard({
  type, count, onClick,
}: {
  type: DrillType; count: number; onClick: () => void;
}) {
  const cfg = DRILL_CONFIG[type];
  const Icon = cfg.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-4 ${cfg.cardBg} ${cfg.cardBorder} w-full text-left group
        hover:shadow-sm hover:brightness-[0.97] active:brightness-95 transition-all`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className={`text-xs font-medium ${cfg.cardText} opacity-70`}>{cfg.label}</p>
        <Icon size={14} className={cfg.cardIcon} />
      </div>
      <div className="flex items-end justify-between">
        <p className={`text-[28px] font-bold leading-none tracking-tight ${cfg.cardText}`}>
          {count.toLocaleString()}
        </p>
        <span className={`text-[10px] font-semibold ${cfg.cardText} opacity-0 group-hover:opacity-60 transition-opacity flex items-center gap-0.5`}>
          View <ChevronRight size={10} />
        </span>
      </div>
    </button>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function DrillModal({
  type,
  items,
  onClose,
}: {
  type: DrillType;
  items: SectionDetail[];
  onClose: () => void;
}) {
  const cfg = DRILL_CONFIG[type];
  const Icon = cfg.icon;
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Group by product line for a cleaner read
  const byProduct = items.reduce<Record<string, SectionDetail[]>>((acc, d) => {
    (acc[d.product] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[78vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b border-zinc-100 ${cfg.headerBg} flex-shrink-0`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cfg.cardBg} border ${cfg.cardBorder}`}>
              <Icon size={14} className={cfg.cardIcon} />
            </div>
            <div>
              <h2 className={`text-[15px] font-bold ${cfg.headerText}`}>{cfg.label}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {items.length} item{items.length !== 1 ? "s" : ""} across all product lines
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="text-sm text-zinc-400 italic px-5 py-8 text-center">{cfg.emptyLabel}</p>
          ) : (
            <div>
              {items.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 px-5 py-3.5 border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors"
                >
                  {/* Dot */}
                  <div className={`w-1.5 h-1.5 rounded-full ${cfg.dotColor} mt-[6px] flex-shrink-0`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-zinc-900 leading-snug">{item.headline}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Link
                        href={`/product-lines/${item.productLineId}`}
                        onClick={onClose}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.pillBg} ${cfg.pillText} ${cfg.pillBorder} hover:brightness-95 transition-all`}
                      >
                        {item.product}
                      </Link>
                      <span className="text-[11px] text-zinc-400">
                        Week {item.week}, {item.year}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex-shrink-0">
          <p className="text-[11px] text-zinc-400">
            Sorted most recent first
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-[12px] font-medium text-zinc-500 hover:text-zinc-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function MetricsDrilldown({
  totalRuns,
  totalUpdatesCreated,
  bugDetails,
  improvementDetails,
  featureDetails,
}: {
  totalRuns: number;
  totalUpdatesCreated: number;
  bugDetails: SectionDetail[];
  improvementDetails: SectionDetail[];
  featureDetails: SectionDetail[];
}) {
  const [open, setOpen] = useState<DrillType | null>(null);

  const detailMap: Record<DrillType, SectionDetail[]> = {
    bug: bugDetails,
    improvement: improvementDetails,
    feature: featureDetails,
  };

  return (
    <>
      <div className="grid grid-cols-5 gap-3 mb-8">
        <StaticCard
          label="Total Runs" value={totalRuns}
          icon={Zap} bg="bg-blue-50" border="border-blue-100" text="text-blue-700" iconCls="text-blue-400"
        />
        <StaticCard
          label="Updates Generated" value={totalUpdatesCreated}
          icon={Sparkles} bg="bg-violet-50" border="border-violet-100" text="text-violet-700" iconCls="text-violet-400"
        />
        <DrillCard type="bug"         count={bugDetails.length}         onClick={() => setOpen("bug")} />
        <DrillCard type="improvement" count={improvementDetails.length} onClick={() => setOpen("improvement")} />
        <DrillCard type="feature"     count={featureDetails.length}     onClick={() => setOpen("feature")} />
      </div>

      {open && (
        <DrillModal
          type={open}
          items={detailMap[open]}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
