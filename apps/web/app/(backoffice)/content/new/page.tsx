import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { ContentAgentForm } from "../content-agent-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function NewContentAgentPage() {
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLines = await prisma.productLine.findMany({
    where: { orgId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="max-w-lg">
      <Link
        href="/content"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
      >
        <ArrowLeft size={14} /> Back
      </Link>
      <h1 className="text-2xl font-semibold text-zinc-900 mb-1">New Content Agent</h1>
      <p className="text-sm text-zinc-500 mb-8">
        Configure an agent to transform product updates into customer-facing content.
      </p>
      <ContentAgentForm productLines={productLines} />
    </div>
  );
}
