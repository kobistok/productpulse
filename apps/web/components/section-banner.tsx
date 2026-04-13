"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

// ─── Palettes ─────────────────────────────────────────────────────────────────

const PALETTES = [
  { from: "#C2410C", to: "#F97316", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#6B21A8", to: "#A855F7", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#1D4ED8", to: "#60A5FA", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#065F46", to: "#34D399", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#9D174D", to: "#F472B6", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#92400E", to: "#FCD34D", text: "rgba(0,0,0,0.88)",       sub: "rgba(0,0,0,0.55)",       dark: true  },
  { from: "#134E4A", to: "#2DD4BF", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#312E81", to: "#818CF8", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#9F1239", to: "#FB7185", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#365314", to: "#A3E635", text: "rgba(0,0,0,0.88)",       sub: "rgba(0,0,0,0.55)",       dark: true  },
  { from: "#0C4A6E", to: "#38BDF8", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
  { from: "#701A75", to: "#E879F9", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.65)", dark: false },
];

function simpleHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Text layout helpers ───────────────────────────────────────────────────────

/** Split title into at most 2 lines, breaking at word boundaries near midpoint */
function splitLines(text: string): [string, string | null] {
  const words = text.split(" ");
  if (words.length <= 3 || text.length <= 26) return [text, null];

  // Find split point closest to the middle of the string
  const mid = text.length / 2;
  let bestIdx = 1;
  let bestDist = Infinity;
  let pos = 0;
  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i].length + 1; // +1 for space
    const dist = Math.abs(pos - mid);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i + 1;
    }
  }
  const line1 = words.slice(0, bestIdx).join(" ");
  const line2 = words.slice(bestIdx).join(" ");
  return [line1, line2];
}

function fontSize(text: string, line2: string | null): number {
  const maxLen = Math.max(text.length, line2?.length ?? 0);
  if (maxLen <= 14) return 80;
  if (maxLen <= 20) return 68;
  if (maxLen <= 26) return 58;
  if (maxLen <= 32) return 50;
  if (maxLen <= 38) return 43;
  return 37;
}

// ─── SVG Layout A: gradient bg, left-aligned title, floating orbs right ───────

function LayoutA({
  title, seed, uid, palette,
}: {
  title: string; seed: number; uid: string; palette: (typeof PALETTES)[number];
}) {
  const gradId = `lA-${uid}`;
  const [line1, line2] = splitLines(title);
  const fs = fontSize(line1, line2);
  const titleY = line2 ? 185 : 220;
  const circleColors = palette.dark
    ? ["rgba(0,0,0,0.08)", "rgba(0,0,0,0.05)", "rgba(0,0,0,0.04)"]
    : ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.07)", "rgba(255,255,255,0.04)"];

  return (
    <svg viewBox="0 0 1200 400" xmlns="http://www.w3.org/2000/svg" className="w-full block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
      </defs>
      {/* Background */}
      <rect width="1200" height="400" fill={`url(#${gradId})`} />
      {/* Decorative orbs — right side */}
      <circle cx="980" cy="180" r="200" fill={circleColors[0]} />
      <circle cx="1050" cy="320" r="140" fill={circleColors[1]} />
      <circle cx="870" cy="60" r="110" fill={circleColors[2]} />
      {/* Small ring */}
      <circle cx="980" cy="180" r="200" fill="none" stroke={palette.text} strokeWidth="1" opacity="0.08" />
      <circle cx="980" cy="180" r="270" fill="none" stroke={palette.text} strokeWidth="1" opacity="0.04" />

      {/* Title */}
      <text
        x="72"
        y={titleY}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize={fs}
        fontWeight="800"
        fill={palette.text}
        letterSpacing="-1.5"
      >
        {line1}
      </text>
      {line2 && (
        <text
          x="72"
          y={titleY + fs * 1.2}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={fs}
          fontWeight="800"
          fill={palette.text}
          letterSpacing="-1.5"
        >
          {line2}
        </text>
      )}

      {/* NEW label */}
      <rect x="72" y="60" width="62" height="26" rx="13" fill={palette.text} opacity="0.18" />
      <text
        x="103"
        y="78"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill={palette.text}
        letterSpacing="1.5"
        textAnchor="middle"
      >
        NEW
      </text>

      {/* Bottom line */}
      <line x1="72" y1="370" x2="400" y2="370" stroke={palette.text} strokeWidth="1" opacity="0.2" />
    </svg>
  );
}

// ─── SVG Layout B: diagonal stripe accent, centered title ─────────────────────

function LayoutB({
  title, seed, uid, palette,
}: {
  title: string; seed: number; uid: string; palette: (typeof PALETTES)[number];
}) {
  const gradId = `lB-${uid}`;
  const [line1, line2] = splitLines(title);
  const fs = fontSize(line1, line2);
  const titleY = line2 ? 175 : 215;
  const alpha = palette.dark ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.10)";
  const alpha2 = palette.dark ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)";

  return (
    <svg viewBox="0 0 1200 400" xmlns="http://www.w3.org/2000/svg" className="w-full block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0.8">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
      </defs>
      <rect width="1200" height="400" fill={`url(#${gradId})`} />

      {/* Diagonal stripes */}
      <polygon points="0,0 380,0 0,400" fill={alpha} />
      <polygon points="0,0 200,0 0,200" fill={alpha2} />
      <polygon points="1200,400 820,400 1200,0" fill={alpha} />
      <polygon points="1200,400 1000,400 1200,200" fill={alpha2} />

      {/* Dot grid — top right */}
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <circle
            key={`${r}-${c}`}
            cx={950 + c * 28}
            cy={40 + r * 28}
            r="3"
            fill={palette.text}
            opacity="0.2"
          />
        ))
      )}

      {/* Category pill */}
      <rect x="72" y="56" width="88" height="26" rx="13" fill={palette.text} opacity="0.15" />
      <text
        x="116"
        y="74"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill={palette.text}
        letterSpacing="1.5"
        textAnchor="middle"
      >
        UPDATE
      </text>

      {/* Title */}
      <text
        x="72"
        y={titleY}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize={fs}
        fontWeight="800"
        fill={palette.text}
        letterSpacing="-1.5"
      >
        {line1}
      </text>
      {line2 && (
        <text
          x="72"
          y={titleY + fs * 1.2}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={fs}
          fontWeight="800"
          fill={palette.text}
          letterSpacing="-1.5"
        >
          {line2}
        </text>
      )}

      {/* Accent bar bottom */}
      <rect x="0" y="390" width="1200" height="10" fill={palette.text} opacity="0.12" />
    </svg>
  );
}

// ─── SVG Layout C: left accent panel + title in right area ───────────────────

function LayoutC({
  title, seed, uid, palette,
}: {
  title: string; seed: number; uid: string; palette: (typeof PALETTES)[number];
}) {
  const gradId = `lC-${uid}`;
  const gradId2 = `lC2-${uid}`;
  const [line1, line2] = splitLines(title);
  const fs = fontSize(line1, line2);
  const titleY = line2 ? 175 : 215;
  const alpha = palette.dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)";

  return (
    <svg viewBox="0 0 1200 400" xmlns="http://www.w3.org/2000/svg" className="w-full block">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
        <linearGradient id={gradId2} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={palette.from} stopOpacity="1" />
          <stop offset="100%" stopColor={palette.from} stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Main background */}
      <rect width="1200" height="400" fill={`url(#${gradId})`} />

      {/* Left accent panel */}
      <rect width="220" height="400" fill={`url(#${gradId2})`} />
      <rect width="220" height="400" fill={alpha} />

      {/* Vertical text in left panel */}
      <text
        x="110"
        y="280"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="11"
        fontWeight="700"
        fill={palette.text}
        letterSpacing="3"
        textAnchor="middle"
        transform="rotate(-90, 110, 280)"
        opacity="0.7"
      >
        PRODUCT UPDATE
      </text>

      {/* Decorative circle in left panel */}
      <circle cx="110" cy="100" r="40" fill="none" stroke={palette.text} strokeWidth="1.5" opacity="0.2" />
      <circle cx="110" cy="100" r="28" fill={palette.text} opacity="0.1" />

      {/* Separator line */}
      <line x1="220" y1="40" x2="220" y2="360" stroke={palette.text} strokeWidth="1" opacity="0.15" />

      {/* Right area: title */}
      <text
        x="292"
        y={titleY}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize={fs}
        fontWeight="800"
        fill={palette.text}
        letterSpacing="-1.5"
      >
        {line1}
      </text>
      {line2 && (
        <text
          x="292"
          y={titleY + fs * 1.2}
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize={fs}
          fontWeight="800"
          fill={palette.text}
          letterSpacing="-1.5"
        >
          {line2}
        </text>
      )}

      {/* Decorative circles top-right */}
      <circle cx="1100" cy="80" r="120" fill={palette.text} opacity="0.05" />
      <circle cx="1100" cy="80" r="80" fill={palette.text} opacity="0.06" />

      {/* Horizontal rule below title */}
      <line
        x1="292"
        y1={titleY + (line2 ? fs * 2.5 : fs * 1.6)}
        x2="680"
        y2={titleY + (line2 ? fs * 2.5 : fs * 1.6)}
        stroke={palette.text}
        strokeWidth="1.5"
        opacity="0.25"
      />
    </svg>
  );
}

// ─── Main SVG dispatcher ──────────────────────────────────────────────────────

function SvgBanner({ title, seed, uid }: { title: string; seed: number; uid: string }) {
  const palette = PALETTES[seed % PALETTES.length];
  const variant = seed % 3;
  const props = { title, seed, uid, palette };
  if (variant === 0) return <LayoutA {...props} />;
  if (variant === 1) return <LayoutB {...props} />;
  return <LayoutC {...props} />;
}

// ─── Public component ─────────────────────────────────────────────────────────

interface BannerData {
  shouldShow: boolean;
  title?: string;
  seed?: number;
}

export function SectionBanner({
  updateId,
  sectionIndex,
  headline,
}: {
  updateId: string;
  sectionIndex: number;
  headline: string;
}) {
  const [data, setData] = useState<BannerData | null>(null);

  useEffect(() => {
    fetch(`/api/updates/${updateId}/banner-data?s=${sectionIndex}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d ?? { shouldShow: false }))
      .catch(() => setData({ shouldShow: false }));
  }, [updateId, sectionIndex]);

  // Still loading — show placeholder (same aspect ratio, no flicker shift later)
  if (data === null) {
    return (
      <div
        className="rounded-t-lg bg-gradient-to-r from-zinc-200 via-zinc-100 to-zinc-200 animate-pulse"
        style={{ aspectRatio: "3 / 1" }}
      />
    );
  }

  if (!data.shouldShow || !data.title || data.seed === undefined) return null;

  const uid = `${updateId}-${sectionIndex}`.replace(/[^a-z0-9]/gi, "");
  const downloadHref = `/api/updates/${updateId}/banner?s=${sectionIndex}&t=${encodeURIComponent(data.title)}`;
  const filename = `update-banner-${headline.slice(0, 30).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.png`;

  return (
    <div className="relative group/banner overflow-hidden rounded-t-lg" style={{ aspectRatio: "3 / 1" }}>
      <SvgBanner title={data.title} seed={data.seed} uid={uid} />
      <a
        href={downloadHref}
        download={filename}
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-2 right-2 opacity-0 group-hover/banner:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/50 hover:bg-black/70 text-white text-[10px] font-medium px-2 py-1 rounded-md backdrop-blur-sm"
        title="Download as PNG"
      >
        <Download size={10} />
        PNG
      </a>
    </div>
  );
}
