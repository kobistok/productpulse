import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Sidebar } from "@/components/backoffice/sidebar";

export default async function BackofficeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  const activeOrg = user.memberships[0]?.org ?? null;
  if (!activeOrg) redirect("/onboarding");

  return (
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar user={user} org={activeOrg} />
      <main className="flex-1 ml-56">
        <div className="max-w-5xl mx-auto px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
