import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductLineNav } from "./product-line-nav";
import { DeleteProductLineButton } from "./delete-button";

interface Props {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export default async function ProductLineLayout({ children, params }: Props) {
  const { id } = await params;
  const user = await requireSession();
  const orgId = user.memberships[0]?.orgId;

  const productLine = await prisma.productLine.findFirst({
    where: { id, orgId },
  });

  if (!productLine) notFound();

  const isAdmin = user.memberships[0]?.role === "ADMIN";
  const canDelete = productLine.createdBy === user.id || isAdmin;

  return (
    <div>
      <Link
        href="/product-lines"
        className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Product Lines
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">{productLine.name}</h1>
          {productLine.description && (
            <p className="text-sm text-zinc-500 mt-1">{productLine.description}</p>
          )}
        </div>
        {canDelete && <DeleteProductLineButton productLineId={id} productLineName={productLine.name} />}
      </div>

      <ProductLineNav id={id} />

      <div className="mt-6">{children}</div>
    </div>
  );
}
