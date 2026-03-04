import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { CircleCISection } from "./circleci-section";

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
    include: { circleCIConfig: true },
  });

  if (!productLine) notFound();

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-base font-semibold text-zinc-900">Integrations</h2>
        <p className="text-sm text-zinc-500 mt-0.5">
          Connect external services to give the agent more context when generating updates.
        </p>
      </div>

      <CircleCISection
        productLineId={id}
        existing={
          productLine.circleCIConfig
            ? {
                projectSlug: productLine.circleCIConfig.projectSlug,
                branch: productLine.circleCIConfig.branch,
              }
            : null
        }
      />
    </div>
  );
}
