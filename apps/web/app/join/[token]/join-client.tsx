"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithGoogle } from "@/lib/firebase";

interface Props {
  orgName: string;
  token: string;
}

export function JoinClient({ orgName, token }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    try {
      const idToken = await signInWithGoogle();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      if (!res.ok) throw new Error("Session creation failed");
      // Re-hit this page as a server component — it will now process the invite
      router.push(`/join/${token}`);
      router.refresh();
    } catch {
      setError("Failed to join. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
      <div className="bg-white rounded-xl border border-zinc-200 p-10 w-full max-w-sm shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">You&apos;ve been invited</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Join <span className="font-medium text-zinc-900">{orgName}</span> on Syncop
        </p>

        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full h-11 mt-6 flex items-center justify-center gap-3 border border-zinc-300 bg-white rounded-md text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 transition-colors"
        >
          <GoogleIcon />
          {loading ? "Joining..." : "Continue with Google"}
        </button>
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
