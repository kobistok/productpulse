import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight, Zap, Sparkles } from "lucide-react";

export default async function ProductLinesPage() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLines = await prisma.productLine.findMany({
    where: { orgId },
    include: {
      agent: { select: { id: true } },
      _count: {
        select: {
          updates: true,
          gitTriggers: true,
          triggerEvents: { where: { status: { not: "skipped" } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Product Lines</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your products and their AI agents
          </p>
        </div>
        <Link href="/product-lines/new">
          <Button size="sm" className="gap-1.5">
            <Plus size={13} />
            New Product Line
          </Button>
        </Link>
      </div>

      {productLines.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-zinc-300 rounded-xl">
          <p className="text-sm text-zinc-500">No product lines yet.</p>
          <Link href="/product-lines/new">
            <Button variant="outline" size="sm" className="mt-4">
              Create your first product line
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {productLines.map((pl) => (
            <Link
              key={pl.id}
              href={`/product-lines/${pl.id}`}
              className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-zinc-900">{pl.name}</p>
                {pl.description && (
                  <p className="text-sm text-zinc-500 mt-0.5">{pl.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                  {pl.agent ? (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700 border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-100 text-zinc-500 border border-zinc-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 shrink-0" />
                      No agent
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    <Zap size={10} className="shrink-0" />
                    {pl._count.triggerEvents} run{pl._count.triggerEvents !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-violet-50 text-violet-700 border border-violet-100">
                    <Sparkles size={10} className="shrink-0" />
                    {pl._count.updates} update{pl._count.updates !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <ChevronRight
                size={15}
                className="text-zinc-400 group-hover:text-zinc-600 transition-colors"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
