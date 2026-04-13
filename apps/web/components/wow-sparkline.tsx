"use client";

import { useState } from "react";

export interface WowDataPoint {
  label: string;
  sections: number;
  features: number;
  bugs: number;
  improvements: number;
  isLatest: boolean;
}

export function WowSparklineChart({ data }: { data: WowDataPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  const VW = 500; const VH = 80;
  const padY = 14;  // vertical breathing room so dots aren't clipped
  const padX = 6;   // tiny horizontal inset so edge dots render fully

  const n = data.length;
  const values = data.map((d) => d.sections);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const xs = data.map((_, i) => padX + (i / (n - 1)) * (VW - padX * 2));
  const ys = data.map((_, i) =>
    VH - padY - ((values[i] - min) / range) * (VH - padY * 2)
  );

  // Smooth bezier path
  const bezier = xs
    .map((x, i) => {
      if (i === 0) return `M ${x},${ys[i]}`;
      const cpx = ((xs[i - 1] + x) / 2).toFixed(2);
      return `C ${cpx},${ys[i - 1].toFixed(2)} ${cpx},${ys[i].toFixed(2)} ${x.toFixed(2)},${ys[i].toFixed(2)}`;
    })
    .join(" ");

  const area = `${bezier} L ${xs[n - 1]},${VH + 2} L ${xs[0]},${VH + 2} Z`;

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * VW;
    let best = 0;
    let bestDist = Infinity;
    xs.forEach((px, i) => {
      const d = Math.abs(px - x);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    setHovered(best);
  }

  // Tooltip x as % of container width — clamped so it stays on screen
  const tipPct = hovered !== null ? (xs[hovered] / VW) * 100 : 0;

  return (
    <div className="rounded-xl border border-zinc-100 bg-white">
      {/* Chart */}
      <div className="relative" style={{ cursor: "crosshair" }}>
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="none"
          className="w-full block"
          style={{ height: 80 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHovered(null)}
        >
          <defs>
            <linearGradient id="wow-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="rgba(139,92,246,0.22)" />
              <stop offset="100%" stopColor="rgba(139,92,246,0)" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={area} fill="url(#wow-area)" />

          {/* Main line */}
          <path
            d={bezier}
            fill="none"
            stroke="rgba(124,58,237,0.75)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Hover crosshair */}
          {hovered !== null && (
            <line
              x1={xs[hovered]} y1={padY / 2}
              x2={xs[hovered]} y2={VH}
              stroke="rgba(124,58,237,0.2)"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
          )}

          {/* Data points */}
          {xs.map((x, i) => {
            const active = hovered === i;
            const latest = data[i].isLatest;
            return (
              <g key={i}>
                {/* Outer ring on hover / latest */}
                {(active || latest) && (
                  <circle
                    cx={x} cy={ys[i]}
                    r={active ? 10 : 7}
                    fill={active ? "rgba(124,58,237,0.12)" : "rgba(124,58,237,0.08)"}
                  />
                )}
                <circle
                  cx={x} cy={ys[i]}
                  r={active ? 5 : latest ? 4.5 : 3.5}
                  fill={active || latest ? "#7c3aed" : "rgba(124,58,237,0.55)"}
                  stroke={active ? "white" : "none"}
                  strokeWidth="2"
                />
              </g>
            );
          })}
        </svg>

        {/* Floating tooltip */}
        {hovered !== null && (
          <div
            className="absolute top-2 pointer-events-none z-10 transition-all duration-75"
            style={{
              left: `clamp(52px, ${tipPct.toFixed(1)}%, calc(100% - 52px))`,
              transform: "translateX(-50%)",
            }}
          >
            <div className="bg-zinc-900/95 backdrop-blur-sm text-white rounded-lg shadow-xl border border-white/10 px-3 py-2 text-xs whitespace-nowrap">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[15px] font-bold text-white">{data[hovered].sections}</span>
                <span className="text-zinc-400">sections</span>
              </div>
              {(data[hovered].features > 0 || data[hovered].bugs > 0) && (
                <div className="flex items-center gap-2 mt-0.5">
                  {data[hovered].features > 0 && (
                    <span className="text-emerald-400 font-medium">
                      {data[hovered].features} feature{data[hovered].features !== 1 ? "s" : ""}
                    </span>
                  )}
                  {data[hovered].bugs > 0 && (
                    <span className="text-red-400 font-medium">
                      {data[hovered].bugs} fix{data[hovered].bugs !== 1 ? "es" : ""}
                    </span>
                  )}
                </div>
              )}
            </div>
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-zinc-900/95 rotate-45 -mt-1 border-r border-b border-white/10" />
            </div>
          </div>
        )}
      </div>

      {/* Week labels — px matches SVG padX so labels sit under their dots */}
      <div
        className="flex justify-between pb-2.5 pt-0.5"
        style={{ paddingLeft: `${(padX / VW) * 100}%`, paddingRight: `${(padX / VW) * 100}%` }}
      >
        {data.map((d, i) => (
          <span
            key={i}
            className={`text-[10px] transition-colors ${
              hovered === i
                ? "text-violet-600 font-bold"
                : d.isLatest
                ? "text-violet-500 font-semibold"
                : "text-zinc-400"
            }`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
