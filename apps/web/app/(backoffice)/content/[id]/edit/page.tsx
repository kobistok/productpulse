import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContentAgentForm } from "../../content-agent-form";

export default async function EditContentAgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;

  const [agent, productLines] = await Promise.all([
    prisma.contentAgent.findFirst({ where: { id, orgId } }),
    prisma.productLine.findMany({
      where: { orgId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!agent) notFound();

  return (
    <div className="max-w-lg">
      <Link
        href={`/content/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">Edit Content Agent</h1>
      <p className="text-sm text-zinc-500 mb-8">{agent.name}</p>
      <ContentAgentForm
        productLines={productLines}
        defaultValues={{
          id: agent.id,
          name: agent.name,
          specificContext: agent.specificContext,
          outputTypes: agent.outputTypes,
          productLineIds: agent.productLineIds,
        }}
      />
    </div>
  );
}
