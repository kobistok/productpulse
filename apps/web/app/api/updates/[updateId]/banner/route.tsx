import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSection(raw: string): { headline: string } {
  const stripped = raw.replace(/^<!--\s*ts:[^\s>]+\s*-->\n?/, "").trimStart();
  const lines = stripped.split("\n").filter(Boolean);
  const firstLine = lines[0]?.trim() ?? "";
  const m = firstLine.match(/^\*\*(.+?)\*\*$/);
  const headline = (m ? m[1] : firstLine).replace(/`([^`]+)`/g, "$1");
  return { headline };
}

function simpleHash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = (h * 33 ^ str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ─── Palettes ─────────────────────────────────────────────────────────────────

const PALETTES = [
  { from: "#C2410C", to: "#F97316", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#6B21A8", to: "#A855F7", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#1D4ED8", to: "#60A5FA", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#065F46", to: "#34D399", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#9D174D", to: "#F472B6", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#92400E", to: "#FCD34D", text: "rgba(0,0,0,0.88)",       sub: "rgba(0,0,0,0.50)",       dark: true  },
  { from: "#134E4A", to: "#2DD4BF", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#312E81", to: "#818CF8", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#9F1239", to: "#FB7185", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#365314", to: "#A3E635", text: "rgba(0,0,0,0.88)",       sub: "rgba(0,0,0,0.50)",       dark: true  },
  { from: "#0C4A6E", to: "#38BDF8", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
  { from: "#701A75", to: "#E879F9", text: "rgba(255,255,255,0.95)", sub: "rgba(255,255,255,0.55)", dark: false },
];

// ─── Layout components (Satori JSX) ───────────────────────────────────────────

interface BannerProps {
  palette: (typeof PALETTES)[number];
  title: string;
}

/** Split into ≤2 lines near midpoint of the string */
function splitLines(text: string): [string, string | null] {
  const words = text.split(" ");
  if (words.length <= 3 || text.length <= 26) return [text, null];
  const mid = text.length / 2;
  let bestIdx = 1;
  let bestDist = Infinity;
  let pos = 0;
  for (let i = 0; i < words.length - 1; i++) {
    pos += words[i].length + 1;
    const dist = Math.abs(pos - mid);
    if (dist < bestDist) { bestDist = dist; bestIdx = i + 1; }
  }
  return [words.slice(0, bestIdx).join(" "), words.slice(bestIdx).join(" ")];
}

function titleFontSize(line1: string, line2: string | null): number {
  const maxLen = Math.max(line1.length, line2?.length ?? 0);
  if (maxLen <= 14) return 80;
  if (maxLen <= 20) return 68;
  if (maxLen <= 26) return 58;
  if (maxLen <= 32) return 50;
  if (maxLen <= 38) return 43;
  return 37;
}

function BannerA({ palette, title }: BannerProps) {
  const [line1, line2] = splitLines(title);
  const fs = titleFontSize(line1, line2);
  const alpha = palette.dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";
  const alpha2 = palette.dark ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)";
  const alpha3 = palette.dark ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.04)";

  return (
    <div style={{ width: 1200, height: 400, display: "flex", background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Orbs */}
      <div style={{ position: "absolute", right: -40, top: -40, width: 400, height: 400, borderRadius: "50%", background: alpha, display: "flex" }} />
      <div style={{ position: "absolute", right: 80, bottom: -80, width: 280, height: 280, borderRadius: "50%", background: alpha2, display: "flex" }} />
      <div style={{ position: "absolute", right: -80, bottom: 60, width: 220, height: 220, borderRadius: "50%", background: alpha3, display: "flex" }} />
      {/* Ring */}
      <div style={{ position: "absolute", right: -40, top: -40, width: 400, height: 400, borderRadius: "50%", border: `1px solid ${palette.text}`, opacity: 0.08, display: "flex" }} />
      <div style={{ position: "absolute", right: -110, top: -110, width: 540, height: 540, borderRadius: "50%", border: `1px solid ${palette.text}`, opacity: 0.04, display: "flex" }} />

      {/* Content */}
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "60px 72px", flex: 1 }}>
        {/* Badge */}
        <div style={{ display: "flex" }}>
          <div style={{ background: palette.dark ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.18)", borderRadius: 100, padding: "5px 16px", display: "flex" }}>
            <span style={{ color: palette.text, fontSize: 11, fontWeight: 700, letterSpacing: "0.12em" }}>NEW</span>
          </div>
        </div>

        {/* Title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <span style={{ fontSize: fs, fontWeight: 800, color: palette.text, lineHeight: 1.1, letterSpacing: "-0.025em" }}>{line1}</span>
          {line2 && <span style={{ fontSize: fs, fontWeight: 800, color: palette.text, lineHeight: 1.1, letterSpacing: "-0.025em" }}>{line2}</span>}
        </div>

        {/* Rule */}
        <div style={{ width: 280, height: 1, background: palette.text, opacity: 0.2, display: "flex" }} />
      </div>
    </div>
  );
}

function BannerB({ palette, title }: BannerProps) {
  const [line1, line2] = splitLines(title);
  const fs = titleFontSize(line1, line2);
  const alpha = palette.dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.10)";
  const alpha2 = palette.dark ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.07)";

  return (
    <div style={{ width: 1200, height: 400, display: "flex", flexDirection: "column", background: `linear-gradient(150deg, ${palette.from} 0%, ${palette.to} 100%)`, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden", padding: "60px 72px" }}>
      {/* Diagonal polygons */}
      <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "400px 340px 0 0", borderColor: `${alpha} transparent transparent transparent`, display: "flex" }} />
      <div style={{ position: "absolute", right: 0, bottom: 0, width: 0, height: 0, borderStyle: "solid", borderWidth: "0 0 400px 340px", borderColor: `transparent transparent ${alpha2} transparent`, display: "flex" }} />

      {/* Dot grid */}
      <div style={{ position: "absolute", top: 32, right: 56, display: "flex", flexDirection: "column", gap: 18 }}>
        {[0, 1, 2, 3].map((r) => (
          <div key={r} style={{ display: "flex", gap: 18 }}>
            {[0, 1, 2, 3, 4, 5].map((c) => (
              <div key={c} style={{ width: 5, height: 5, borderRadius: "50%", background: palette.text, opacity: 0.2 }} />
            ))}
          </div>
        ))}
      </div>

      {/* UPDATE label */}
      <div style={{ display: "flex", marginBottom: "auto" }}>
        <div style={{ background: palette.dark ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.16)", borderRadius: 100, padding: "5px 16px", display: "flex" }}>
          <span style={{ color: palette.text, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em" }}>UPDATE</span>
        </div>
      </div>

      {/* Title */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0, flex: 1, justifyContent: "center" }}>
        <span style={{ fontSize: fs, fontWeight: 800, color: palette.text, lineHeight: 1.1, letterSpacing: "-0.025em" }}>{line1}</span>
        {line2 && <span style={{ fontSize: fs, fontWeight: 800, color: palette.text, lineHeight: 1.1, letterSpacing: "-0.025em" }}>{line2}</span>}
      </div>

      {/* Bottom accent bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 8, background: palette.dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)", display: "flex" }} />
    </div>
  );
}

function BannerC({ palette, title }: BannerProps) {
  const [line1, line2] = splitLines(title);
  const fs = titleFontSize(line1, line2);
  const alpha = palette.dark ? "rgba(0,0,0,0.14)" : "rgba(255,255,255,0.15)";
  const alpha2 = palette.dark ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.07)";

  return (
    <div style={{ width: 1200, height: 400, display: "flex", background: `linear-gradient(120deg, ${palette.to} 0%, ${palette.from} 100%)`, fontFamily: "system-ui, sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Left accent panel */}
      <div style={{ width: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: alpha, flexShrink: 0, borderRight: `1px solid ${palette.dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)"}`, gap: 24 }}>
        {/* Circle decoration */}
        <div style={{ width: 72, height: 72, borderRadius: "50%", border: `2px solid ${palette.text}`, opacity: 0.25, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: palette.dark ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.15)", display: "flex" }} />
        </div>
        {/* Label: rotated text is not easily doable in Satori — use plain text */}
        <span style={{ fontSize: 10, fontWeight: 700, color: palette.text, letterSpacing: "0.15em", opacity: 0.7 }}>NEW</span>
      </div>

      {/* Right: title area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 64px", gap: 0 }}>
        <span style={{ fontSize: fs, fontWeight: 800, color: palette.text, lineHeight: 1.1, letterSpacing: "-0.025em" }}>{line1}</span>
        {line2 && <span style={{ fontSize: fs, fontWeight: 800, color: palette.text, lineHeight: 1.1, letterSpacing: "-0.025em" }}>{line2}</span>}

        {/* Underline accent */}
        <div style={{ width: 200, height: 2, background: palette.dark ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.25)", marginTop: 28, display: "flex" }} />
      </div>

      {/* Background circle decoration top-right */}
      <div style={{ position: "absolute", right: -40, top: -60, width: 300, height: 300, borderRadius: "50%", background: alpha2, display: "flex" }} />
      <div style={{ position: "absolute", right: 40, top: -100, width: 200, height: 200, borderRadius: "50%", background: alpha2, display: "flex" }} />
    </div>
  );
}

const LAYOUTS = [BannerA, BannerB, BannerC];

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ updateId: string }> }
) {
  const { updateId } = await params;
  const sectionIndex = parseInt(req.nextUrl.searchParams.get("s") ?? "0", 10);
  // Allow passing a pre-generated AI title via ?t=
  const titleParam = req.nextUrl.searchParams.get("t");

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

  const raw = rawSections[sectionIndex] ?? rawSections[0] ?? "";
  const { headline } = parseSection(raw);

  // Use AI-generated title if provided, otherwise fall back to parsed headline
  const title = titleParam ? decodeURIComponent(titleParam) : headline;

  const seed = simpleHash(`${updateId}-${sectionIndex}`);
  const palette = PALETTES[seed % PALETTES.length];
  const Layout = LAYOUTS[seed % LAYOUTS.length];

  return new ImageResponse(<Layout palette={palette} title={title} />, {
    width: 1200,
    height: 400,
    headers: { "Cache-Control": "private, max-age=86400, immutable" },
  });
}
