"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, GitBranch, Settings, LogOut } from "lucide-react";
import { signOut } from "@/lib/firebase";
import type { User, Organization } from "@productpulse/db";

const NAV_ITEMS = [
  { href: "/product-lines", label: "Product Lines", icon: LayoutGrid },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  user: User;
  org: Organization;
}

export function Sidebar({ user, org }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  return (
    <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-zinc-200 flex flex-col">
      <div className="px-5 py-5 border-b border-zinc-100">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Product Pulse</p>
        <p className="text-sm font-semibold text-zinc-900 mt-0.5 truncate">{org.name}</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
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
      </nav>

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
            {user.name ?? user.email}
          </p>
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
  );
}
