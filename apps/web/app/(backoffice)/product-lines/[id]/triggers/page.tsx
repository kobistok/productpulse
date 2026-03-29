import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { TriggersClient } from "./triggers-client";
import type { TriggerEvent, GitTrigger } from "@productpulse/db";

export type TriggerEventWithTrigger = TriggerEvent & {
  trigger: Pick<GitTrigger, "repoUrl" | "provider"> | null;
  agentDecision?: string | null;
  workerDetail?: string | null;
  updateContent?: string | null;
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TriggersPage({ params }: Props) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    include: {
      gitTriggers: { orderBy: { createdAt: "asc" } },
      agent: { select: { id: true } },
      jiraConfig: { select: { atlassianDomain: true, baseUrl: true } },
      triggerEvents: {
        where: { status: { not: "skipped" } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { trigger: { select: { repoUrl: true, provider: true } } },
      },
    },
  });

  if (!productLine) notFound();

  // Derive app base URL from request headers for webhook URL display
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const appUrl = `${protocol}://${host}`;

  const jiraCfg = productLine.jiraConfig;
  const jiraBaseUrl = jiraCfg
    ? jiraCfg.atlassianDomain
      ? `https://${jiraCfg.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : jiraCfg.baseUrl.replace(/\/+$/, "")
    : null;

  return (
    <TriggersClient
      productLineId={id}
      triggers={productLine.gitTriggers}
      appUrl={appUrl}
      hasAgent={!!productLine.agent}
      initialEvents={productLine.triggerEvents as TriggerEventWithTrigger[]}
      jiraBaseUrl={jiraBaseUrl}
    />
  );
}
