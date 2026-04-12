import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Bot, GitBranch, ChevronRight } from "lucide-react";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { UpdatesSection } from "./updates-section";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProductLineOverviewPage({ params }: Props) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    include: {
      agent: { select: { id: true, model: true, updatedAt: true } },
      gitTriggers: { where: { active: true } },
      jiraConfig: { select: { atlassianDomain: true, baseUrl: true } },
      updates: {
        orderBy: [{ year: "desc" }, { isoWeek: "desc" }],
        take: 8,
      },
    },
  });

  if (!productLine) notFound();

  const jiraBaseUrl = productLine.jiraConfig
    ? productLine.jiraConfig.atlassianDomain
      ? `https://${productLine.jiraConfig.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : productLine.jiraConfig.baseUrl.replace(/\/+$/, "")
    : undefined;

  const currentWeek = getISOWeek(new Date());
  const currentYear = getISOWeekYear(new Date());

  const updates = productLine.updates.map((u) => ({
    id: u.id,
    isoWeek: u.isoWeek,
    year: u.year,
    content: u.content,
    updatedAt: u.updatedAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      {/* Status cards */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href={`/product-lines/${id}/agent`}
          className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-zinc-400" />
              <span className="text-sm font-medium text-zinc-700">Agent</span>
            </div>
            <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          </div>
          <div className="mt-3">
            {productLine.agent ? (
              <>
                <p className="text-sm font-semibold text-green-700 bg-green-50 inline-block px-2 py-0.5 rounded-full">Active</p>
                <p className="text-xs text-zinc-400 mt-1">{productLine.agent.model}</p>
              </>
            ) : (
              <p className="text-sm text-zinc-400">Not configured</p>
            )}
          </div>
        </Link>

        <Link
          href={`/product-lines/${id}/triggers`}
          className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition-colors group"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <GitBranch size={16} className="text-zinc-400" />
              <span className="text-sm font-medium text-zinc-700">Git Triggers</span>
            </div>
            <ChevronRight size={14} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
          </div>
          <div className="mt-3">
            <p className="text-2xl font-semibold text-zinc-900">{productLine.gitTriggers.length}</p>
            <p className="text-xs text-zinc-400 mt-0.5">active trigger{productLine.gitTriggers.length !== 1 ? "s" : ""}</p>
          </div>
        </Link>
      </div>

      <UpdatesSection
        productLineId={id}
        currentWeek={currentWeek}
        currentYear={currentYear}
        updates={updates}
        jiraBaseUrl={jiraBaseUrl}
        hasAgent={!!productLine.agent}
        hasTriggersConfigured={productLine.gitTriggers.length > 0}
      />
    </div>
  );
}

