"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/firebase";

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

          {/* Divider hint */}
          <p className="text-center text-xs text-zinc-400 mt-8 leading-relaxed">
            By signing in, you agree to our{" "}
            <a href="/legal/terms" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">Terms</a>
            {" "}and{" "}
            <a href="/legal/privacy" className="underline underline-offset-2 hover:text-zinc-600 transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>

      {/* ── Right: Illustration panel ──────────────────────────────────────── */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden bg-[#0f0a1e]">
        {/* Gradient mesh background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-950 via-[#130d2a] to-fuchsia-950" />
          {/* Radial glows */}
          <div className="absolute top-[-10%] left-[-5%] w-[70%] h-[70%] rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-5%] w-[60%] h-[60%] rounded-full bg-fuchsia-500/20 blur-[100px]" />
          <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full bg-cyan-500/10 blur-[80px]" />
        </div>

        {/* Grid lines overlay */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between w-full p-14">
          {/* Top: floating feature cards */}
          <div className="flex flex-col gap-4 mt-8">
            <FeatureCard
              color="from-violet-500/20 to-violet-600/10"
              border="border-violet-400/20"
              dot="bg-violet-400"
              label="AI-powered"
              title="Weekly digests, on autopilot"
              sub="Claude reads your commits, PRs, and tickets — then writes the update."
            />
            <FeatureCard
              color="from-fuchsia-500/20 to-fuchsia-600/10"
              border="border-fuchsia-400/20"
              dot="bg-fuchsia-400"
              label="Real-time"
              title="Beautiful banners in seconds"
              sub="Per-section visuals generated and ready to share."
            />
            <FeatureCard
              color="from-cyan-500/20 to-cyan-600/10"
              border="border-cyan-400/20"
              dot="bg-cyan-400"
              label="Shareable"
              title="One link for your whole team"
              sub="No login needed for stakeholders — just a link."
            />
          </div>

          {/* Bottom: social proof */}
          <div>
            {/* Decorative chart bars */}
            <div className="flex items-end gap-1.5 mb-8 h-16">
              {[40, 55, 38, 70, 52, 88, 65, 95, 72, 100, 80, 60, 85, 73, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(to top, ${
                      i % 3 === 0
                        ? "rgba(139,92,246,0.7), rgba(167,139,250,0.3)"
                        : i % 3 === 1
                        ? "rgba(217,70,239,0.7), rgba(232,121,249,0.3)"
                        : "rgba(6,182,212,0.6), rgba(103,232,249,0.3)"
                    })`,
                    opacity: 0.5 + (h / 100) * 0.5,
                  }}
                />
              ))}
            </div>

            <blockquote className="text-white/70 text-[15px] leading-relaxed font-medium italic max-w-sm">
              "Syncop turned our messy weekly updates into something our customers actually read."
            </blockquote>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-400 flex items-center justify-center text-white text-xs font-bold">
                S
              </div>
              <div>
                <p className="text-white/90 text-[13px] font-semibold">Sarah K.</p>
                <p className="text-white/40 text-[12px]">Head of Product, Fintech startup</p>
              </div>
              {/* Stars */}
              <div className="ml-auto flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} width="13" height="13" viewBox="0 0 13 13" fill="none">
                    <path d="M6.5 1l1.4 3.1H11l-2.6 2.1.9 3.3L6.5 8 4.2 9.5l.9-3.3L2.5 4.1h3.1z" fill="rgba(251,191,36,0.9)" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Floating orbs */}
        <div className="absolute top-[18%] right-[12%] w-5 h-5 rounded-full bg-violet-400/60 blur-[1px] animate-pulse" />
        <div className="absolute top-[52%] right-[7%] w-3 h-3 rounded-full bg-fuchsia-400/50 blur-[1px] animate-pulse [animation-delay:0.8s]" />
        <div className="absolute bottom-[28%] right-[22%] w-4 h-4 rounded-full bg-cyan-400/40 blur-[1px] animate-pulse [animation-delay:1.6s]" />
      </div>
    </div>
  );
}

function FeatureCard({
  color, border, dot, label, title, sub,
}: {
  color: string;
  border: string;
  dot: string;
  label: string;
  title: string;
  sub: string;
}) {
  return (
    <div
      className={`flex items-start gap-4 rounded-2xl border ${border} bg-gradient-to-br ${color} backdrop-blur-sm px-5 py-4`}
    >
      <div className={`mt-0.5 w-2 h-2 rounded-full ${dot} flex-shrink-0 shadow-lg`} />
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 block mb-0.5">
          {label}
        </span>
        <p className="text-[14px] font-semibold text-white/90 leading-snug">{title}</p>
        <p className="text-[12px] text-white/50 leading-relaxed mt-0.5">{sub}</p>
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
