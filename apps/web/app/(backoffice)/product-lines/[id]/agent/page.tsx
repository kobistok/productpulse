import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { AgentForm } from "./agent-form";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AgentConfigPage({ params }: Props) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    include: { agent: true },
  });

  if (!productLine) notFound();

  const isAdmin = user.memberships[0]?.role === "ADMIN";
  const canEdit = !productLine.agent || productLine.agent.ownerId === user.id || isAdmin;

  return (
    <AgentForm
      productLineId={id}
      productLineName={productLine.name}
      agent={productLine.agent}
      canEdit={canEdit}
    />
  );
}
