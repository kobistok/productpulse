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
    // Check email restriction
    if (invite.email && session.email.toLowerCase() !== invite.email.toLowerCase()) {
      return (
        <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
          <div className="bg-white rounded-xl border border-zinc-200 p-10 w-full max-w-sm shadow-sm text-center">
            <h1 className="text-xl font-semibold text-zinc-900">Wrong account</h1>
            <p className="text-sm text-zinc-500 mt-2">
              This invite is for <span className="font-medium text-zinc-800">{invite.email}</span>.
              You&apos;re signed in as <span className="font-medium text-zinc-800">{session.email}</span>.
            </p>
            <p className="text-xs text-zinc-400 mt-4">Sign in with the correct Google account and try again.</p>
          </div>
        </div>
      );
    }

    const existing = await prisma.membership.findUnique({
      where: { userId_orgId: { userId: session.id, orgId: invite.orgId } },
    });
    if (!existing) {
      await prisma.$transaction([
        prisma.membership.create({
          data: { userId: session.id, orgId: invite.orgId, role: invite.role },
        }),
        prisma.invite.delete({ where: { id: invite.id } }),
      ]);
    }
    redirect("/product-lines");
  }

  return <JoinClient orgName={invite.org.name} token={token} />;
}
