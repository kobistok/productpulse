import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/backoffice/sidebar";
import { PendoIdentify } from "@/components/pendo-identify";

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const activeOrg = user.memberships[0]?.org ?? null;
  if (!activeOrg) redirect("/onboarding");

  const membership = user.memberships[0];

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <PendoIdentify
        visitor={{
          id: user.id,
          email: user.email,
          full_name: user.name,
          avatarUrl: user.avatarUrl,
          createdAt: user.createdAt.toISOString(),
          role: membership?.role ?? "MEMBER",
          orgId: membership?.orgId ?? "",
        }}
        account={{
          id: activeOrg.id,
          name: activeOrg.name,
          slug: activeOrg.slug,
          createdAt: activeOrg.createdAt.toISOString(),
        }}
      />
      <Sidebar user={user} org={activeOrg} />
      <main className="flex-1 ml-56">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
