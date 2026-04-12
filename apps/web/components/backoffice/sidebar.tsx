"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Settings, LogOut, Users, X, FileText, Rocket } from "lucide-react";
import { signOut } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { User, Organization } from "@productpulse/db";
import { useOnboarding } from "@/components/onboarding/provider";
import { ONBOARDING_STEPS } from "@/components/onboarding/wizard";

const NAV_ITEMS = [
  { href: "/product-lines", label: "Product Lines", icon: LayoutGrid },
  { href: "/content", label: "Content", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  user: User;
  org: Organization;
  isSuperAdmin: boolean;
  isImpersonating: boolean;
  realUserName: string | null;
}

export function Sidebar({ user, org, isSuperAdmin, isImpersonating, realUserName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = useOnboarding();
  const onboardingRemaining = onboarding
    ? ONBOARDING_STEPS.length - Object.values(onboarding.data.completed).filter(Boolean).length
    : 0;
  const [showDialog, setShowDialog] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  async function handleImpersonate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      setShowDialog(false);
      setEmail("");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to impersonate");
    }
    setLoading(false);
  }

  async function handleStopImpersonating() {
    await fetch("/api/impersonate", { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-zinc-200 flex flex-col">
        <div className="px-5 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-2 mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 shrink-0">
              <rect width="32" height="32" rx="7" fill="#18181b"/>
              <polyline points="2,16 7,16 9.5,9 13,23 16,7 19,23 22.5,9 25,16 30,16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Syncop</p>
          </div>
          <p className="text-sm font-semibold text-zinc-900 truncate">{org.name}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 flex flex-col">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                pathname.startsWith(href)
                  ? "bg-zinc-100 text-zinc-900 font-medium"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}

          {/* Getting started button */}
          {onboarding && (
            <button
              onClick={onboarding.open}
              className="mt-auto flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition-colors text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            >
              <Rocket size={15} />
              <span className="flex-1 text-left">Getting started</span>
              {onboardingRemaining > 0 && (
                <span className="text-[10px] font-bold bg-zinc-900 text-white rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                  {onboardingRemaining}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Impersonation banner */}
        {isImpersonating && (
          <div className="mx-3 mb-2 flex items-center justify-between gap-2 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide">Impersonating</p>
              <p className="text-xs text-amber-900 font-medium truncate">{user.name ?? user.email}</p>
            </div>
            <button
              onClick={handleStopImpersonating}
              className="shrink-0 text-amber-600 hover:text-amber-800 transition-colors"
              title="Exit impersonation"
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div className="px-3 py-4 border-t border-zinc-100">
          <div className="flex items-center gap-2.5 px-3 py-2">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name ?? ""}
                className="w-6 h-6 rounded-full"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-600">
                {(user.name ?? user.email)[0].toUpperCase()}
              </div>
            )}
            <p className="flex-1 text-xs font-medium text-zinc-700 truncate">
              {isImpersonating ? realUserName ?? "You" : (user.name ?? user.email)}
            </p>
            {isSuperAdmin && !isImpersonating && (
              <button
                onClick={() => setShowDialog(true)}
                className="text-zinc-400 hover:text-zinc-600 transition-colors"
                aria-label="Impersonate user"
                title="Impersonate user"
              >
                <Users size={13} />
              </button>
            )}
            <button
              onClick={handleSignOut}
              className="text-zinc-400 hover:text-zinc-600 transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </aside>

      {/* Impersonate dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900">Impersonate User</h2>
              <button
                onClick={() => { setShowDialog(false); setEmail(""); setError(null); }}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleImpersonate} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-600">User email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  autoFocus
                  required
                />
              </div>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Loading..." : "Impersonate"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => { setShowDialog(false); setEmail(""); setError(null); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
