"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/firebase";

// ─── Palettes (mirrors section-banner.tsx) ────────────────────────────────────

const PALETTES = [
  { from: "#C2410C", to: "#F97316", dark: false },
  { from: "#6B21A8", to: "#A855F7", dark: false },
  { from: "#1D4ED8", to: "#60A5FA", dark: false },
  { from: "#065F46", to: "#34D399", dark: false },
  { from: "#9D174D", to: "#F472B6", dark: false },
  { from: "#92400E", to: "#FCD34D", dark: true  },
  { from: "#134E4A", to: "#2DD4BF", dark: false },
  { from: "#312E81", to: "#818CF8", dark: false },
  { from: "#9F1239", to: "#FB7185", dark: false },
  { from: "#0C4A6E", to: "#38BDF8", dark: false },
];

// ─── Mock preview data ────────────────────────────────────────────────────────

const LATEST_UPDATES = [
  { uid: "p1", title: "Instant Search & Smart Filters", product: "Discovery", week: 15, sections: 4, features: 3, seed: 2 },
  { uid: "p2", title: "Checkout Flow Redesign",         product: "Payments",  week: 15, sections: 5, features: 4, seed: 4 },
];

const WOW_DATA = [
  { label: "Mar 17", sections: 8,  features: 2, seed: 7 },
  { label: "Mar 24", sections: 11, features: 4, seed: 3 },
  { label: "Mar 31", sections: 9,  features: 3, seed: 0 },
  { label: "Apr 7",  sections: 13, features: 5, seed: 1, latest: true },
];

// ─── Banner SVG helpers ───────────────────────────────────────────────────────

function splitTitle(title: string): [string, string | null] {
  const words = title.split(" ");
  if (words.length <= 3 || title.length <= 22) return [title, null];
  const mid = title.length / 2;
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

/** Full-width banner SVG (matches section-banner style: orbs + title) */
function UpdateBannerSvg({ seed, uid, title }: { seed: number; uid: string; title: string }) {
  const p = PALETTES[seed % PALETTES.length];
  const gId = `ub-${uid}`;
  const tc = "rgba(255,255,255,0.95)";
  const a1 = p.dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.09)";
  const a2 = p.dark ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
  const [l1, l2] = splitTitle(title);
  const maxLen = Math.max(l1.length, l2?.length ?? 0);
  const fs = maxLen <= 14 ? 72 : maxLen <= 20 ? 60 : maxLen <= 26 ? 52 : 44;
  const ty = l2 ? 168 : 208;
  return (
    <svg viewBox="0 0 1200 380" xmlns="http://www.w3.org/2000/svg" className="w-full block">
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.from} />
          <stop offset="100%" stopColor={p.to} />
        </linearGradient>
      </defs>
      <rect width="1200" height="380" fill={`url(#${gId})`} />
      <circle cx="970" cy="170" r="200" fill={a1} />
      <circle cx="1060" cy="310" r="140" fill={a2} />
      <circle cx="860"  cy="55"  r="110" fill={a2} />
      <circle cx="970" cy="170" r="200" fill="none" stroke={tc} strokeWidth="1" opacity="0.07" />
      <rect x="64" y="52" width="56" height="24" rx="12" fill={tc} opacity="0.16" />
      <text x="92" y="69" fontFamily="system-ui,sans-serif" fontSize="10" fontWeight="700" fill={tc} letterSpacing="1.5" textAnchor="middle">NEW</text>
      <text x="64" y={ty} fontFamily="system-ui,sans-serif" fontSize={fs} fontWeight="800" fill={tc} letterSpacing="-1">{l1}</text>
      {l2 && <text x="64" y={ty + fs * 1.18} fontFamily="system-ui,sans-serif" fontSize={fs} fontWeight="800" fill={tc} letterSpacing="-1">{l2}</text>}
      <line x1="64" y1="362" x2="380" y2="362" stroke={tc} strokeWidth="1" opacity="0.18" />
    </svg>
  );
}

/** Tiny banner for the WoW tiles (gradient + subtle orb) */
function MiniBannerSvg({ seed, uid }: { seed: number; uid: string }) {
  const p = PALETTES[seed % PALETTES.length];
  const gId = `mb-${uid}`;
  const a = p.dark ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.08)";
  return (
    <svg viewBox="0 0 300 96" xmlns="http://www.w3.org/2000/svg" className="w-full block rounded-lg">
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={p.from} />
          <stop offset="100%" stopColor={p.to} />
        </linearGradient>
      </defs>
      <rect width="300" height="96" fill={`url(#${gId})`} rx="8" />
      <circle cx="240" cy="48" r="68" fill={a} />
      <circle cx="285" cy="88" r="44" fill={a} />
      <circle cx="195" cy="14" r="36" fill={a} />
    </svg>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, colors }: { values: number[]; colors: string[] }) {
  const W = 360; const H = 40; const pad = 16;
  const n = values.length;
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const range = max - min;
  const xs = values.map((_, i) => pad + (i / (n - 1)) * (W - pad * 2));
  const ys = values.map(v => H - 8 - ((v - min) / range) * (H - 16));
  const bezier = xs.map((x, i) => {
    if (i === 0) return `M ${x},${ys[i]}`;
    const cpx = (xs[i - 1] + x) / 2;
    return `C ${cpx},${ys[i - 1]} ${cpx},${ys[i]} ${x},${ys[i]}`;
  }).join(" ");
  // Area fill
  const area = `${bezier} L ${xs[n - 1]},${H} L ${xs[0]},${H} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 40 }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(139,92,246,0.25)" />
          <stop offset="100%" stopColor="rgba(139,92,246,0)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path d={bezier} fill="none" stroke="rgba(167,139,250,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {xs.map((x, i) => (
        <circle
          key={i}
          cx={x} cy={ys[i]} r={i === n - 1 ? 4 : 3}
          fill={i === n - 1 ? "#a78bfa" : "rgba(167,139,250,0.55)"}
          stroke={i === n - 1 ? "rgba(167,139,250,0.3)" : "none"}
          strokeWidth="4"
        />
      ))}
    </svg>
  );
}

// ─── Preview components ───────────────────────────────────────────────────────

function UpdateCard({ u }: { u: typeof LATEST_UPDATES[number] }) {
  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-sm">
      {/* Banner */}
      <div className="overflow-hidden">
        <UpdateBannerSvg seed={u.seed} uid={u.uid} title={u.title} />
      </div>
      {/* Meta row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className="text-[12px] font-semibold text-white/80 truncate">{u.title}</span>
        <div className="flex items-center gap-2 ml-auto flex-shrink-0">
          <span className="text-[10px] text-white/35 font-medium">{u.product}</span>
          <span className="text-white/20">·</span>
          <span className="text-[10px] text-white/35">Wk {u.week}</span>
          <span className="text-white/20">·</span>
          <span className="text-[10px] text-white/35">{u.sections} sections</span>
        </div>
      </div>
    </div>
  );
}

function WowTile({ w, prevSections }: { w: typeof WOW_DATA[number]; prevSections?: number }) {
  const delta = prevSections !== undefined ? w.sections - prevSections : null;
  const up = delta !== null && delta > 0;
  const down = delta !== null && delta < 0;
  return (
    <div className={`rounded-xl overflow-hidden border backdrop-blur-sm flex flex-col ${w.latest ? "border-violet-400/30 bg-violet-500/10" : "border-white/10 bg-white/5"}`}>
      <MiniBannerSvg seed={w.seed} uid={`wow-${w.label.replace(/\s/g, "")}`} />
      <div className="px-3 py-2.5 flex flex-col gap-0.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-white/90">{w.sections}</span>
          {delta !== null && (
            <span className={`text-[10px] font-semibold ${up ? "text-emerald-400" : down ? "text-rose-400" : "text-white/30"}`}>
              {up ? `+${delta}` : delta}
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/35">{w.label}</span>
        {w.latest && (
          <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-violet-400/80">Latest</span>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const errorMsg =
          typeof data?.error === "string"
            ? data.error
            : (data?.error?.message ?? `Session creation failed (${res.status})`);
        const err = Object.assign(new Error(errorMsg), { code: data?.code ?? String(res.status) });
        throw err;
      }
      (window as any).pendo?.track("user_signed_in", { auth_provider: "google" });
      router.push("/product-lines");
      router.refresh();
    } catch (err) {
      console.error("Sign-in error:", err);
      const e = err as { message?: string; code?: string };
      const msg = e?.message ?? "Sign-in failed. Please try again.";
      const code = e?.code ? ` [${e.code}]` : "";
      setError(msg + code);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left: Login panel ─────────────────────────────────────────────── */}
      <div className="flex flex-col justify-center items-center w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 bg-white px-8 py-12 z-10">
        <div className="w-full max-w-[360px]">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-12">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-200">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8 L6 5 L8 7 L10 3 L13 8" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <circle cx="3" cy="8" r="1.2" fill="white"/>
                <circle cx="13" cy="8" r="1.2" fill="white"/>
              </svg>
            </div>
            <span className="text-[17px] font-bold tracking-tight text-zinc-900">Syncop</span>
          </div>

          {/* Headline */}
          <div className="mb-10">
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-zinc-900">
              Welcome back
            </h1>
            <p className="text-[15px] text-zinc-500 mt-2 leading-relaxed">
              Sign in to your workspace and keep your product updates in sync.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white text-[14px] font-semibold text-zinc-800 shadow-sm hover:shadow-md hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 transition-all duration-200"
          >
            <GoogleIcon />
            {loading ? "Signing in…" : "Continue with Google"}
          </button>

          {/* Terms */}
          <p className="text-center text-xs text-zinc-400 mt-8 leading-relaxed">
            By signing in, you agree to our{" "}
            <a href="/legal/terms" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">Terms</a>
            {" "}and{" "}
            <a href="/legal/privacy" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* ── Right: Product preview panel ──────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#0f0a1e]">

        {/* Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-[#130d2a] to-fuchsia-950" />
          <div className="absolute top-[-15%] left-[-5%]  w-[65%] h-[65%] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[55%] h-[55%] rounded-full bg-fuchsia-500/20 blur-[100px]" />
          <div className="absolute top-[45%] left-[25%]  w-[40%] h-[40%] rounded-full bg-cyan-500/10  blur-[80px]" />
        </div>

        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Floating orbs */}
        <div className="absolute top-[15%] right-[10%] w-5 h-5 rounded-full bg-violet-400/60 blur-[1px] animate-pulse" />
        <div className="absolute top-[55%] right-[6%]  w-3 h-3 rounded-full bg-fuchsia-400/50 blur-[1px] animate-pulse [animation-delay:0.8s]" />
        <div className="absolute bottom-[22%] right-[20%] w-4 h-4 rounded-full bg-cyan-400/40 blur-[1px] animate-pulse [animation-delay:1.6s]" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center w-full h-full px-10 py-10 gap-7 overflow-y-auto">

          {/* ── Latest Updates ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Latest Updates</span>
              <span className="text-[10px] text-white/20">Week 15 · 2026</span>
            </div>
            <div className="flex flex-col gap-3">
              {LATEST_UPDATES.map(u => <UpdateCard key={u.uid} u={u} />)}
            </div>
          </div>

          {/* ── Week over Week ─────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/35">Week over Week</span>
              <span className="text-[10px] text-white/20">Sections delivered · last 4 weeks</span>
            </div>

            {/* 4 tiles */}
            <div className="grid grid-cols-4 gap-2.5">
              {WOW_DATA.map((w, i) => (
                <WowTile key={w.label} w={w} prevSections={i > 0 ? WOW_DATA[i - 1].sections : undefined} />
              ))}
            </div>

            {/* Sparkline */}
            <div className="mt-3 px-1">
              <Sparkline
                values={WOW_DATA.map(w => w.sections)}
                colors={WOW_DATA.map(w => PALETTES[w.seed % PALETTES.length].from)}
              />
              <div className="flex justify-between mt-0.5 px-[14px]">
                {WOW_DATA.map(w => (
                  <span key={w.label} className="text-[9px] text-white/25">{w.label}</span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.04a4.8 4.8 0 01-7.18-2.52H1.83v2.07A8 8 0 008.98 17z" />
      <path fill="#FBBC05" d="M4.5 10.5a4.8 4.8 0 010-3.01V5.42H1.83a8 8 0 000 7.16l2.67-2.08z" />
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.42L4.5 7.5a4.77 4.77 0 014.48-3.32z" />
    </svg>
  );
}
