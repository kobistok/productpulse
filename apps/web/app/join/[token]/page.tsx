import { prisma } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { JoinClient } from "./join-client";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function JoinPage({ params }: Props) {
  const { token } = await params;

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { org: true },
  });

  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    notFound();
  }

  const session = await getSession();

  // Already signed in — process invite and redirect
  if (session) {
    const existing = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: session.id, orgId: invite.orgId } },
    });
    if (!existing) {
      await prisma.$transaction([
        prisma.membership.create({
          data: { userId: session.id, orgId: invite.orgId, role: invite.role },
        }),
        prisma.invite.update({
          where: { id: invite.id },
          data: { usedAt: new Date() },
        }),
      ]);
    }
    redirect("/product-lines");
  }

  return <JoinClient orgName={invite.org.name} token={token} />;
}
