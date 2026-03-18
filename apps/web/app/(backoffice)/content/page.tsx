import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus, ChevronRight } from "lucide-react";
import { SkillsSection } from "./skills-section";

export default async function ContentPage() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const [agents, skills, productLines] = await Promise.all([
    prisma.contentAgent.findMany({
      where: { orgId },
      include: { outputs: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.orgSkill.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } }),
    prisma.productLine.findMany({ where: { orgId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const plMap = new Map(productLines.map((pl) => [pl.id, pl.name]));

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Content</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Generate customer-facing content from product updates
          </p>
        </div>
        <Link href="/content/new">
          <Button size="sm" className="gap-1.5">
            <Plus size={13} />
            New Agent
          </Button>
        </Link>
      </div>

      {/* Content Agents */}
      <section className="mb-10">
        <h2 className="text-sm font-semibold text-zinc-700 mb-3">Content Agents</h2>
        {agents.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-zinc-300 rounded-xl">
            <p className="text-sm text-zinc-500">No content agents yet.</p>
            <Link href="/content/new">
              <Button variant="outline" size="sm" className="mt-4">
                Create your first agent
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => {
              const lastOutput = agent.outputs[0];
              const plNames = agent.productLineIds
                .map((id) => plMap.get(id))
                .filter(Boolean)
                .join(", ");
              return (
                <Link
                  key={agent.id}
                  href={`/content/${agent.id}`}
                  className="flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 transition-colors group"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{agent.name}</p>
                    {plNames && (
                      <p className="text-xs text-zinc-500 mt-0.5">{plNames}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {agent.outputTypes.map((t) => (
                        <span
                          key={t}
                          className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium"
                        >
                          {t === "kb" ? "KB Article" : "Customer Update"}
                        </span>
                      ))}
                      {lastOutput && (
                        <span className="text-xs text-zinc-400">
                          Last run {new Date(lastOutput.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Skills */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-700">Skills</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Reusable style and format guidelines applied to all content agents</p>
          </div>
        </div>
        <SkillsSection initialSkills={skills} />
      </section>
    </div>
  );
}
