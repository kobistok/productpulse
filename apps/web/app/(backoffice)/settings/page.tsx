import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { InviteSection } from "./invite-section";
import { DashboardInviteSection } from "./dashboard-invite-section";
import { OrgNameSection } from "./org-name-section";
import { ZendeskSection } from "./zendesk-section";
import { GoogleDriveSection } from "./google-drive-section";

export default async function SettingsPage() {
  const user = await requireSession();
  const membership = user.memberships[0];
  const org = membership?.org;

  if (!org) return null;

  const [invites, dashboardInvites, members, zendeskConfig, googleDriveConfig] = await Promise.all([
    prisma.invite.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.dashboardInvite.findMany({ where: { orgId: org.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.membership.findMany({ where: { orgId: org.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.zendeskConfig.findUnique({ where: { orgId: org.id } }),
    prisma.googleDriveConfig.findUnique({ where: { orgId: org.id } }),
  ]);

  const isAdmin = membership.role === "ADMIN";

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">{org.name}</p>
      </div>

      {/* Members */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Members</h2>
        <div className="bg-white border border-zinc-200 rounded-xl divide-y divide-zinc-100">
          {members.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                {m.user.avatarUrl ? (
                  <img src={m.user.avatarUrl} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-zinc-200 flex items-center justify-center text-xs font-medium text-zinc-600">
                    {(m.user.name ?? m.user.email)[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-zinc-900">{m.user.name ?? m.user.email}</p>
                  <p className="text-xs text-zinc-400">{m.user.email}</p>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 font-medium capitalize">
                {m.role.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Company name */}
      {isAdmin && <OrgNameSection currentName={org.name} />}

      {/* Team Invites */}
      {isAdmin && <InviteSection orgId={org.id} invites={invites} />}

      {/* Dashboard Invites */}
      <DashboardInviteSection orgId={org.id} invites={dashboardInvites} />

      {/* Integrations */}
      <section>
        <h2 className="text-sm font-semibold text-zinc-900 mb-3">Integrations</h2>
        <div className="space-y-3">
          <ZendeskSection config={zendeskConfig ? { subdomain: zendeskConfig.subdomain, email: zendeskConfig.email } : null} />
          <GoogleDriveSection
            connected={!!googleDriveConfig}
            email={googleDriveConfig?.email ?? null}
          />
        </div>
      </section>
    </div>
  );
}
