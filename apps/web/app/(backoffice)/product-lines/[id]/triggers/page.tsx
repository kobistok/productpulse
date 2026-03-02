import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notFound, headers } from "next/navigation";
import { TriggersClient } from "./triggers-client";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TriggersPage({ params }: Props) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    include: { gitTriggers: { orderBy: { createdAt: "asc" } } },
  });

  if (!productLine) notFound();

  // Derive app base URL from request headers for webhook URL display
  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const appUrl = `${protocol}://${host}`;

  return (
    <TriggersClient
      productLineId={id}
      triggers={productLine.gitTriggers}
      appUrl={appUrl}
    />
  );
}
