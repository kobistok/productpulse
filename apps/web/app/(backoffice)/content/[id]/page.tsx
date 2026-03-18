import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContentAgentDetail } from "./content-agent-detail";

export default async function ContentAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const [agent, productLines] = await Promise.all([
    prisma.contentAgent.findFirst({
      where: { id, orgId },
      include: {
        outputs: {
          orderBy: [{ year: "desc" }, { isoWeek: "desc" }, { createdAt: "desc" }],
        },
      },
    }),
    prisma.productLine.findMany({
      where: { orgId },
      select: { id: true, name: true },
    }),
  ]);

  if (!agent) notFound();

  const plMap = new Map(productLines.map((pl) => [pl.id, pl.name]));
  const sourceProductLines = agent.productLineIds
    .map((plId) => plMap.get(plId))
    .filter(Boolean) as string[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/content"
          className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft size={14} /> Content
        </Link>
        <Link href={`/content/${id}/edit`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Pencil size={12} />
            Edit
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900">{agent.name}</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {agent.outputTypes.map((t) => (
            <span
              key={t}
              className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium"
            >
              {t === "kb" ? "KB Article" : "Customer Update"}
            </span>
          ))}
          {sourceProductLines.length > 0 && (
            <span className="text-xs text-zinc-400">
              from {sourceProductLines.join(", ")}
            </span>
          )}
        </div>
        {agent.specificContext && (
          <p className="text-sm text-zinc-500 mt-2">{agent.specificContext}</p>
        )}
      </div>

      <ContentAgentDetail agent={agent} />
    </div>
  );
}
