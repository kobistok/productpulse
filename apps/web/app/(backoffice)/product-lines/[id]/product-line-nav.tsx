"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Overview", href: "" },
  { label: "Agent", href: "/agent" },
  { label: "Triggers", href: "/triggers" },
  { label: "Integrations", href: "/integrations" },
];

export function ProductLineNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/product-lines/${id}`;

  return (
    <nav className="flex items-center gap-1 border-b border-zinc-200 -mx-1 px-1">
      {TABS.map(({ label, href }) => {
        const fullHref = `${base}${href}`;
        const isActive = href === "" ? pathname === base : pathname.startsWith(fullHref);
        return (
          <Link
            key={href}
            href={fullHref}
            className={cn(
              "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
