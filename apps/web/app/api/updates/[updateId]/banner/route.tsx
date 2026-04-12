import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// ─── Content parsing ────────────────────────────────────────────────────────

function parseSection(raw: string) {
  const stripped = raw
    .replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "")
    .trimStart();
  const lines = stripped.split("\n").filter(Boolean);
  const firstLine = lines[0]?.trim() ?? "";
  const m = firstLine.match(/^\*\*(.+?)\*\*$/);
  const headline = (m ? m[1] : firstLine).replace(/`([^`]+)`/g, "$1");
  const bullets = lines
    .slice(1)
    .filter((l) => l.trim().startsWith("- "))
    .map((l) => l.replace(/^-\s+/, "").replace(/`([^`]+)`/g, "$1").trim())
    .filter((l) => l.length > 0)
    .slice(0, 3);
  return { headline, bullets };
}

// ─── Category detection ──────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  feature: ["add", "new", "implement", "create", "introduce", "launch", "build", "ship", "release", "enable", "support"],
  fix:     ["fix", "resolve", "patch", "correct", "repair", "bug", "issue", "broken", "revert", "crash", "error"],
  perf:    ["optim", "performance", "speed", "faster", "cache", "efficient", "latency", "throughput"],
  security:["security", "auth", "token", "permission", "secure", "encrypt", "vulnerab", "oauth", "rbac", "ssl", "tls", "password"],
  infra:   ["deploy", "infra", "migrat", "upgrade", "kubernetes", "docker", "pipeline", "cloud", "database", "server", "ci/cd"],
  data:    ["analytic", "metric", "report", "tracking", "data", "dashboard", "insight", "log", "event", "chart"],
  api:     ["api", "endpoint", "webhook", "integration", "rest", "graphql", "connect", "sync", "request", "response"],
  ui:      ["ui", "ux", "design", "interface", "style", "component", "layout", "accessib", "button", "form", "page", "modal"],
};

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  feature:  { label: "New Feature",     icon: "feature"  },
  fix:      { label: "Bug Fix",         icon: "fix"      },
  perf:     { label: "Performance",     icon: "perf"     },
  security: { label: "Security",        icon: "security" },
  infra:    { label: "Infrastructure",  icon: "infra"    },
  data:     { label: "Data & Analytics",icon: "data"     },
  api:      { label: "API",             icon: "api"      },
  ui:       { label: "UI / UX",         icon: "ui"       },
};

function detectCategory(text: string): { label: string; icon: string } {
  const lower = text.toLowerCase();
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([cat, words]) => ({
    cat,
    score: words.filter((w) => lower.includes(w)).length,
  }));
  scores.sort((a, b) => b.score - a.score);
  const winner = scores[0].score > 0 ? scores[0].cat : "feature";
  return CATEGORY_META[winner];
}

// ─── Colour palettes ─────────────────────────────────────────────────────────

const PALETTES = [
  // 0 Coral / Orange
  { from: "#C2410C", to: "#F97316", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 1 Electric Purple
  { from: "#6B21A8", to: "#A855F7", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 2 Ocean Blue
  { from: "#1D4ED8", to: "#60A5FA", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 3 Emerald
  { from: "#065F46", to: "#34D399", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 4 Hot Pink
  { from: "#9D174D", to: "#F472B6", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 5 Amber Gold
  { from: "#92400E", to: "#FCD34D", accent: "rgba(0,0,0,0.88)",       sub: "rgba(0,0,0,0.60)"       },
  // 6 Teal
  { from: "#134E4A", to: "#2DD4BF", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 7 Indigo
  { from: "#312E81", to: "#818CF8", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 8 Rose Red
  { from: "#9F1239", to: "#FB7185", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 9 Lime
  { from: "#365314", to: "#A3E635", accent: "rgba(0,0,0,0.88)",       sub: "rgba(0,0,0,0.60)"       },
  // 10 Sky
  { from: "#0C4A6E", to: "#38BDF8", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
  // 11 Fuchsia
  { from: "#701A75", to: "#E879F9", accent: "rgba(255,255,255,0.92)", sub: "rgba(255,255,255,0.70)" },
];

function simpleHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Category icons (inline SVG paths) ───────────────────────────────────────

function CategoryIcon({ type, color }: { type: string; color: string }) {
  const s = { fill: "none", stroke: color, strokeWidth: "3", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "fix")
    return (
      <svg width="64" height="64" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" {...s} />
        <polyline points="7 12 10 15 17 8" {...s} />
      </svg>
    );
  if (type === "perf")
    return (
      <svg width="64" height="64" viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" {...s} />
      </svg>
    );
  if (type === "security")
    return (
      <svg width="64" height="64" viewBox="0 0 24 24">
        <path d="M12 2 L20 6 L20 12 C20 16.4 16.5 20.3 12 22 C7.5 20.3 4 16.4 4 12 L4 6 Z" {...s} />
        <polyline points="9 12 11 14 15 10" {...s} />
      </svg>
    );
  if (type === "infra")
    return (
      <svg width="64" height="64" viewBox="0 0 24 24">
        <rect x="2" y="3" width="20" height="5" rx="2" {...s} />
        <rect x="2" y="10" width="20" height="5" rx="2" {...s} />
        <rect x="2" y="17" width="20" height="4" rx="2" {...s} />
        <circle cx="6" cy="5.5" r="0.5" fill={color} />
        <circle cx="6" cy="12.5" r="0.5" fill={color} />
      </svg>
    );
  if (type === "data")
    return (
      <svg width="64" height="64" viewBox="0 0 24 24">
        <line x1="18" y1="20" x2="18" y2="10" {...s} strokeWidth="4" />
        <line x1="12" y1="20" x2="12" y2="4"  {...s} strokeWidth="4" />
        <line x1="6"  y1="20" x2="6"  y2="14" {...s} strokeWidth="4" />
        <line x1="2"  y1="20" x2="22" y2="20" {...s} strokeWidth="2" />
      </svg>
    );
  if (type === "api")
    return (
      <svg width="64" height="64" viewBox="0 0 24 24">
        <circle cx="5" cy="12" r="3" {...s} />
        <circle cx="19" cy="5" r="3" {...s} />
        <circle cx="19" cy="19" r="3" {...s} />
        <line x1="8" y1="11" x2="16" y2="7"  {...s} />
        <line x1="8" y1="13" x2="16" y2="17" {...s} />
      </svg>
    );
  if (type === "ui")
    return (
      <svg width="64" height="64" viewBox="0 0 24 24">
        <rect x="3" y="3" width="8" height="8" rx="1" {...s} />
        <rect x="13" y="3" width="8" height="8" rx="1" {...s} />
        <rect x="3" y="13" width="8" height="8" rx="1" {...s} />
        <rect x="13" y="13" width="8" height="8" rx="1" {...s} />
      </svg>
    );
  // default: feature — star
  return (
    <svg width="64" height="64" viewBox="0 0 24 24">
      <polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2" {...s} />
    </svg>
  );
}

// ─── Layout variants ─────────────────────────────────────────────────────────

function BannerA(props: BannerProps) {
  const { palette, category, headline, bullets, productName, week, year } = props;
  const iconColor = palette.accent;
  return (
    <div style={{ width: 1200, height: 400, display: "flex", background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Decorative background circle */}
      <div style={{ position: "absolute", right: -60, top: -60, width: 420, height: 420, borderRadius: "50%", background: "rgba(255,255,255,0.06)", display: "flex" }} />
      <div style={{ position: "absolute", right: 60, bottom: -100, width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex" }} />

      {/* Left: text */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 52px" }}>
        {/* Top row: brand + category */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="22" height="22" viewBox="0 0 32 32">
              <rect width="32" height="32" rx="7" fill="rgba(255,255,255,0.2)" />
              <polyline points="2,16 7,16 9.5,9 13,23 16,7 19,23 22.5,9 25,16 30,16" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ color: palette.sub, fontSize: 12, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Syncop</span>
          </div>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.18)", borderRadius: 100, padding: "5px 14px" }}>
            <span style={{ color: palette.accent, fontSize: 11, fontWeight: 700, letterSpacing: "0.06em" }}>{category.label}</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1, justifyContent: "center", marginTop: 20 }}>
          <span style={{ fontSize: headline.length > 50 ? 32 : 40, fontWeight: 800, color: palette.accent, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {headline.length > 70 ? headline.slice(0, 68) + "…" : headline}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: palette.sub, flexShrink: 0 }} />
                <span style={{ fontSize: 14, color: palette.sub, lineHeight: 1.4 }}>{b.length > 75 ? b.slice(0, 73) + "…" : b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom: product + week */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: palette.sub, fontWeight: 600 }}>{productName}</span>
          <span style={{ fontSize: 11, color: palette.sub, opacity: 0.5 }}>·</span>
          <span style={{ fontSize: 11, color: palette.sub }}>Week {week} · {year}</span>
        </div>
      </div>

      {/* Right: icon */}
      <div style={{ width: 300, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: "relative" }}>
        <div style={{ display: "flex", opacity: 0.8 }}>
          <CategoryIcon type={category.icon} color={iconColor} />
        </div>
        {/* Ring behind icon */}
        <div style={{ position: "absolute", width: 130, height: 130, borderRadius: "50%", border: `2px solid rgba(255,255,255,0.15)`, display: "flex" }} />
        <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", border: `1px solid rgba(255,255,255,0.08)`, display: "flex" }} />
      </div>
    </div>
  );
}

function BannerB(props: BannerProps) {
  const { palette, category, headline, bullets, productName, week, year } = props;
  const iconColor = palette.accent;
  return (
    <div style={{ width: 1200, height: 400, display: "flex", flexDirection: "column", background: `linear-gradient(160deg, ${palette.from} 0%, ${palette.to} 60%, ${palette.from} 100%)`, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden", padding: "40px 56px" }}>
      {/* Background large icon watermark */}
      <div style={{ position: "absolute", right: 48, top: "50%", display: "flex", opacity: 0.12, transform: "translateY(-50%) scale(3.5)", transformOrigin: "center" }}>
        <CategoryIcon type={category.icon} color={palette.accent} />
      </div>
      {/* Stripe accent left */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 6, height: 400, background: "rgba(255,255,255,0.3)", display: "flex" }} />
      {/* Corner dots top-right */}
      <div style={{ position: "absolute", top: 24, right: 24, display: "flex", flexDirection: "column", gap: 6 }}>
        {[0,1,2].map(r => (
          <div key={r} style={{ display: "flex", gap: 6 }}>
            {[0,1,2].map(c => <div key={c} style={{ width: 4, height: 4, borderRadius: "50%", background: "rgba(255,255,255,0.25)" }} />)}
          </div>
        ))}
      </div>

      {/* Brand + category */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <svg width="20" height="20" viewBox="0 0 32 32">
          <rect width="32" height="32" rx="7" fill="rgba(255,255,255,0.22)" />
          <polyline points="2,16 7,16 9.5,9 13,23 16,7 19,23 22.5,9 25,16 30,16" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ color: palette.sub, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Syncop</span>
        <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.25)", display: "flex" }} />
        <span style={{ color: palette.sub, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>{category.label}</span>
      </div>

      {/* Headline */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <span style={{ fontSize: headline.length > 45 ? 34 : 44, fontWeight: 800, color: palette.accent, lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: 760 }}>
          {headline.length > 72 ? headline.slice(0, 70) + "…" : headline}
        </span>

        {bullets.length > 0 && (
          <div style={{ display: "flex", gap: 20, marginTop: 18 }}>
            {bullets.slice(0, 2).map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: palette.sub, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: palette.sub }}>{b.length > 50 ? b.slice(0, 48) + "…" : b}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16 }}>
        <span style={{ fontSize: 11, color: palette.sub, fontWeight: 600 }}>{productName}</span>
        <span style={{ color: palette.sub, opacity: 0.4 }}>·</span>
        <span style={{ fontSize: 11, color: palette.sub }}>W{week} · {year}</span>
      </div>
    </div>
  );
}

function BannerC(props: BannerProps) {
  const { palette, category, headline, bullets, productName, week, year } = props;
  const iconColor = palette.accent;
  return (
    <div style={{ width: 1200, height: 400, display: "flex", background: `linear-gradient(120deg, ${palette.to} 0%, ${palette.from} 100%)`, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Left icon panel */}
      <div style={{ width: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.12)", position: "relative", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 88, height: 88, borderRadius: 22, background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.22)" }}>
          <CategoryIcon type={category.icon} color={iconColor} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: palette.sub, letterSpacing: "0.12em", textTransform: "uppercase" }}>{category.label}</span>
        {/* Ring */}
        <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)", display: "flex" }} />
      </div>

      {/* Right: text */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "40px 48px" }}>
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="7" fill="rgba(255,255,255,0.2)" />
            <polyline points="2,16 7,16 9.5,9 13,23 16,7 19,23 22.5,9 25,16 30,16" fill="none" stroke={iconColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ color: palette.sub, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Syncop</span>
        </div>

        {/* Headline + bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <span style={{ fontSize: headline.length > 50 ? 32 : 40, fontWeight: 800, color: palette.accent, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {headline.length > 68 ? headline.slice(0, 66) + "…" : headline}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {bullets.map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: palette.sub, marginTop: 8, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: palette.sub, lineHeight: 1.5 }}>{b.length > 72 ? b.slice(0, 70) + "…" : b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: palette.sub, fontWeight: 600 }}>{productName}</span>
          <span style={{ color: palette.sub, opacity: 0.4 }}>·</span>
          <span style={{ fontSize: 11, color: palette.sub }}>W{week} · {year}</span>
        </div>
      </div>

      {/* Background decoration */}
      <div style={{ position: "absolute", right: -40, bottom: -40, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.05)", display: "flex" }} />
      <div style={{ position: "absolute", right: 20, top: -60, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)", display: "flex" }} />
    </div>
  );
}

interface BannerProps {
  palette: (typeof PALETTES)[number];
  category: { label: string; icon: string };
  headline: string;
  bullets: string[];
  productName: string;
  week: number;
  year: number;
}

const LAYOUTS = [BannerA, BannerB, BannerC];

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  const { updateId } = await params;
  const sectionIndex = parseInt(req.nextUrl.searchParams.get("s") ?? "0", 10);

  const user = await getSession();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return new Response("No org", { status: 403 });

  const update = await prisma.update.findFirst({
    where: { id: updateId, productLine: { orgId } },
    include: { productLine: { select: { name: true } } },
  });
  if (!update) return new Response("Not found", { status: 404 });

  const rawSections = update.content
    .split(/\n\n---\n\n|\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  const raw = rawSections[sectionIndex] ?? rawSections[0];
  const { headline, bullets } = parseSection(raw ?? "");
  const category = detectCategory(headline + " " + bullets.join(" "));

  // Deterministic but unique per section — use updateId + sectionIndex as seed
  const seed = simpleHash(`${updateId}-${sectionIndex}`);
  const palette = PALETTES[seed % PALETTES.length];
  const Layout = LAYOUTS[seed % LAYOUTS.length];

  const productName = update.productLine.name.length > 28
    ? update.productLine.name.slice(0, 26) + "…"
    : update.productLine.name;

  return new ImageResponse(
    <Layout
      palette={palette}
      category={category}
      headline={headline}
      bullets={bullets}
      productName={productName}
      week={update.isoWeek}
      year={update.year}
    />,
    {
      width: 1200,
      height: 400,
      headers: { "Cache-Control": "private, max-age=86400, immutable" },
    }
  );
}
