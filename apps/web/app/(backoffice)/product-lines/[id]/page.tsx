import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Bot, GitBranch, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { UpdateContent } from "@/components/update-content";
import { LocalTime } from "@/components/local-time";

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
  const thisWeekUpdate = productLine.updates.find(
    (u) => u.isoWeek === currentWeek && u.year === currentYear
  );

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

      {/* This week */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">
          This week (W{currentWeek})
        </h2>
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          {thisWeekUpdate ? (
            <UpdateContent content={thisWeekUpdate.content} jiraBaseUrl={jiraBaseUrl} />
          ) : (
            <p className="text-sm text-zinc-400 italic">
              No update generated yet this week.{" "}
              {!productLine.agent && (
                <Link href={`/product-lines/${id}/agent`} className="text-zinc-600 underline underline-offset-2">
                  Configure an agent
                </Link>
              )}{" "}
              {productLine.gitTriggers.length === 0 && (
                <Link href={`/product-lines/${id}/triggers`} className="text-zinc-600 underline underline-offset-2">
                  Add a git trigger
                </Link>
              )}
            </p>
          )}
        </div>
      </section>

      {/* Update history */}
      {productLine.updates.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 mb-3">Recent updates</h2>
          <div className="space-y-3">
            {productLine.updates.map((u) => (
              <div key={u.id} className="bg-white border border-zinc-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-medium text-zinc-400">W{u.isoWeek} {u.year}</p>
                  <LocalTime iso={u.updatedAt.toISOString()} className="text-xs text-zinc-400" />
                </div>
                <UpdateContent content={u.content} jiraBaseUrl={jiraBaseUrl} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

