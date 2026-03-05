import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession, getRealSession } from "@/lib/session";
import { isSuperAdmin } from "@/lib/super-admin";
import { Sidebar } from "@/components/backoffice/sidebar";
import { PendoIdentify } from "@/components/pendo-identify";

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, realUser] = await Promise.all([getSession(), getRealSession()]);
  if (!user) redirect("/login");

  const activeOrg = user.memberships[0]?.org ?? null;
  if (!activeOrg) redirect("/onboarding");

  const membership = user.memberships[0];

  const cookieStore = await cookies();
  const impersonateUid = cookieStore.get("__impersonate_uid")?.value;
  const isImpersonating = !!impersonateUid;
  const superAdmin = realUser ? isSuperAdmin(realUser.email) : false;

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
      <Sidebar
        user={user}
        org={activeOrg}
        isSuperAdmin={superAdmin}
        isImpersonating={isImpersonating}
        realUserName={isImpersonating ? (realUser?.name ?? realUser?.email ?? null) : null}
      />
      <main className="flex-1 ml-56">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
