// Server-compatible static banner SVG components (no fetch, no "use client").
// Used by the product-lines dashboard and the login page preview.
// The section-banner.tsx component uses its own internal copy so it can stay
// independent (wraps these same layouts behind a fetch+AI-decision gate).

// ─── Palette ──────────────────────────────────────────────────────────────────

export const BANNER_PALETTES = [
  { from: "#C2410C", to: "#F97316", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#6B21A8", to: "#A855F7", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#1D4ED8", to: "#60A5FA", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#065F46", to: "#34D399", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#9D174D", to: "#F472B6", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#92400E", to: "#FCD34D", text: "rgba(0,0,0,0.88)",       dark: true  },
  { from: "#134E4A", to: "#2DD4BF", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#312E81", to: "#818CF8", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#9F1239", to: "#FB7185", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#365314", to: "#A3E635", text: "rgba(0,0,0,0.88)",       dark: true  },
  { from: "#0C4A6E", to: "#38BDF8", text: "rgba(255,255,255,0.95)", dark: false },
  { from: "#701A75", to: "#E879F9", text: "rgba(255,255,255,0.95)", dark: false },
];

type Palette = (typeof BANNER_PALETTES)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function bannerHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function splitLines(text: string): [string, string | null] {
  const words = text.split(" ");
  if (words.length <= 3 || text.length <= 26) return [text, null];
  const mid = text.length / 2;
  let bestIdx = 1;
  let bestDist = Infinity;
  let pos = 0;
  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i].length + 1;
    const d = Math.abs(pos - mid);
    if (d < bestDist) { bestDist = d; bestIdx = i + 1; }
  }
  return [words.slice(0, bestIdx).join(" "), words.slice(bestIdx).join(" ")];
}

function titleFs(line1: string, line2: string | null): number {
  const m = Math.max(line1.length, line2?.length ?? 0);
  if (m <= 14) return 80;
  if (m <= 20) return 68;
  if (m <= 26) return 58;
  if (m <= 32) return 50;
  if (m <= 38) return 43;
  return 37;
}

// ─── Layout A — orbs right, left-aligned title ────────────────────────────────

function LayoutA({ title, uid, palette }: { title: string; uid: string; palette: Palette }) {
  const gradId = `lA-${uid}`;
  const [l1, l2] = splitLines(title);
  const fs = titleFs(l1, l2);
  const ty = l2 ? 185 : 220;
  const c = palette.dark
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
      <rect width="1200" height="400" fill={`url(#${gradId})`} />
      <circle cx="980" cy="180" r="200" fill={c[0]} />
      <circle cx="1050" cy="320" r="140" fill={c[1]} />
      <circle cx="870"  cy="60"  r="110" fill={c[2]} />
      <circle cx="980" cy="180" r="200" fill="none" stroke={palette.text} strokeWidth="1" opacity="0.08" />
      <circle cx="980" cy="180" r="270" fill="none" stroke={palette.text} strokeWidth="1" opacity="0.04" />
      <rect x="72" y="60" width="62" height="26" rx="13" fill={palette.text} opacity="0.18" />
      <text x="103" y="78" fontFamily="system-ui,-apple-system,sans-serif" fontSize="11" fontWeight="700" fill={palette.text} letterSpacing="1.5" textAnchor="middle">NEW</text>
      <text x="72" y={ty} fontFamily="system-ui,-apple-system,sans-serif" fontSize={fs} fontWeight="800" fill={palette.text} letterSpacing="-1.5">{l1}</text>
      {l2 && <text x="72" y={ty + fs * 1.2} fontFamily="system-ui,-apple-system,sans-serif" fontSize={fs} fontWeight="800" fill={palette.text} letterSpacing="-1.5">{l2}</text>}
      <line x1="72" y1="370" x2="400" y2="370" stroke={palette.text} strokeWidth="1" opacity="0.2" />
    </svg>
  );
}

// ─── Layout B — diagonal stripes, dot grid ────────────────────────────────────

function LayoutB({ title, uid, palette }: { title: string; uid: string; palette: Palette }) {
  const gradId = `lB-${uid}`;
  const [l1, l2] = splitLines(title);
  const fs = titleFs(l1, l2);
  const ty = l2 ? 175 : 215;
  const alpha  = palette.dark ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.10)";
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
      <polygon points="0,0 380,0 0,400"         fill={alpha} />
      <polygon points="0,0 200,0 0,200"          fill={alpha2} />
      <polygon points="1200,400 820,400 1200,0"  fill={alpha} />
      <polygon points="1200,400 1000,400 1200,200" fill={alpha2} />
      {Array.from({ length: 4 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => (
          <circle key={`${r}-${c}`} cx={950 + c * 28} cy={40 + r * 28} r="3" fill={palette.text} opacity="0.2" />
        ))
      )}
      <rect x="72" y="56" width="88" height="26" rx="13" fill={palette.text} opacity="0.15" />
      <text x="116" y="74" fontFamily="system-ui,-apple-system,sans-serif" fontSize="11" fontWeight="700" fill={palette.text} letterSpacing="1.5" textAnchor="middle">UPDATE</text>
      <text x="72" y={ty} fontFamily="system-ui,-apple-system,sans-serif" fontSize={fs} fontWeight="800" fill={palette.text} letterSpacing="-1.5">{l1}</text>
      {l2 && <text x="72" y={ty + fs * 1.2} fontFamily="system-ui,-apple-system,sans-serif" fontSize={fs} fontWeight="800" fill={palette.text} letterSpacing="-1.5">{l2}</text>}
      <rect x="0" y="390" width="1200" height="10" fill={palette.text} opacity="0.12" />
    </svg>
  );
}

// ─── Layout C — left accent panel ─────────────────────────────────────────────

function LayoutC({ title, uid, palette }: { title: string; uid: string; palette: Palette }) {
  const gId  = `lC-${uid}`;
  const gId2 = `lC2-${uid}`;
  const [l1, l2] = splitLines(title);
  const fs = titleFs(l1, l2);
  const ty = l2 ? 175 : 215;
  const alpha = palette.dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)";
  return (
    <svg viewBox="0 0 1200 400" xmlns="http://www.w3.org/2000/svg" className="w-full block">
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={palette.from} />
          <stop offset="100%" stopColor={palette.to} />
        </linearGradient>
        <linearGradient id={gId2} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={palette.from} stopOpacity="1" />
          <stop offset="100%" stopColor={palette.from} stopOpacity="0.7" />
        </linearGradient>
      </defs>
      <rect width="1200" height="400" fill={`url(#${gId})`} />
      <rect width="220"  height="400" fill={`url(#${gId2})`} />
      <rect width="220"  height="400" fill={alpha} />
      <text x="110" y="280" fontFamily="system-ui,-apple-system,sans-serif" fontSize="11" fontWeight="700" fill={palette.text} letterSpacing="3" textAnchor="middle" transform="rotate(-90,110,280)" opacity="0.7">PRODUCT UPDATE</text>
      <circle cx="110" cy="100" r="40" fill="none" stroke={palette.text} strokeWidth="1.5" opacity="0.2" />
      <circle cx="110" cy="100" r="28" fill={palette.text} opacity="0.1" />
      <line x1="220" y1="40" x2="220" y2="360" stroke={palette.text} strokeWidth="1" opacity="0.15" />
      <text x="292" y={ty} fontFamily="system-ui,-apple-system,sans-serif" fontSize={fs} fontWeight="800" fill={palette.text} letterSpacing="-1.5">{l1}</text>
      {l2 && <text x="292" y={ty + fs * 1.2} fontFamily="system-ui,-apple-system,sans-serif" fontSize={fs} fontWeight="800" fill={palette.text} letterSpacing="-1.5">{l2}</text>}
      <circle cx="1100" cy="80" r="120" fill={palette.text} opacity="0.05" />
      <circle cx="1100" cy="80" r="80"  fill={palette.text} opacity="0.06" />
      <line x1="292" y1={ty + (l2 ? fs * 2.5 : fs * 1.6)} x2="680" y2={ty + (l2 ? fs * 2.5 : fs * 1.6)} stroke={palette.text} strokeWidth="1.5" opacity="0.25" />
    </svg>
  );
}

// ─── Public components ────────────────────────────────────────────────────────

/** Full-size banner (1200×400 viewBox) — matches section-banner.tsx visuals */
export function BannerPreviewSvg({
  seed,
  uid,
  title,
}: {
  seed: number;
  uid: string;
  title: string;
}) {
  const palette = BANNER_PALETTES[seed % BANNER_PALETTES.length];
  const variant = seed % 3;
  const props = { title, uid, palette };
  if (variant === 0) return <LayoutA {...props} />;
  if (variant === 1) return <LayoutB {...props} />;
  return <LayoutC {...props} />;
}

/** Mini gradient thumbnail for WoW tiles and compact lists */
export function MiniBannerPreviewSvg({
  seed,
  uid,
}: {
  seed: number;
  uid: string;
}) {
  const p = BANNER_PALETTES[seed % BANNER_PALETTES.length];
  const gId = `mbp-${uid}`;
  const a = p.dark ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)";
  return (
    <svg viewBox="0 0 300 96" xmlns="http://www.w3.org/2000/svg" className="w-full block">
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.from} />
          <stop offset="100%" stopColor={p.to} />
        </linearGradient>
      </defs>
      <rect width="300" height="96" fill={`url(#${gId})`} />
      <circle cx="240" cy="48" r="68" fill={a} />
      <circle cx="285" cy="88" r="44" fill={a} />
      <circle cx="195" cy="14" r="36" fill={a} />
    </svg>
  );
}
