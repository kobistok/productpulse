import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { UpdateContent } from "@/components/update-content";
import { LocalTime } from "@/components/local-time";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ pl?: string }>;
}

function formatLastUpdate(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function PublicDashboardPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { pl: plParam } = await searchParams;

  const dashboardInvite = await prisma.dashboardInvite.findUnique({
    where: { token },
    include: { org: true },
  });

  if (!dashboardInvite) notFound();
  if (dashboardInvite.expiresAt && dashboardInvite.expiresAt < new Date()) notFound();

  const productLines = await prisma.productLine.findMany({
    where: { orgId: dashboardInvite.orgId },
    include: {
      jiraConfig: { select: { atlassianDomain: true, baseUrl: true } },
      updates: {
        orderBy: [{ year: "desc" }, { isoWeek: "desc" }],
        take: 52,
      },
      _count: { select: { triggerEvents: true } },
    },
    orderBy: { name: "asc" },
  });

  const selectedPl = productLines.find((pl) => pl.id === plParam) ?? productLines[0];

  const jiraBaseUrl = selectedPl?.jiraConfig
    ? selectedPl.jiraConfig.atlassianDomain
      ? `https://${selectedPl.jiraConfig.atlassianDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`
      : selectedPl.jiraConfig.baseUrl.replace(/\/+$/, "")
    : undefined;

  return (
    <div className="h-screen flex flex-col bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-6 py-4 flex-shrink-0">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Syncop</p>
        <h1 className="text-lg font-semibold text-zinc-900 mt-0.5">{dashboardInvite.org.name}</h1>
      </header>

      {productLines.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-zinc-500">No product lines yet.</p>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          <aside className="w-64 border-r border-zinc-200 bg-white flex-shrink-0 overflow-y-auto">
            <div className="px-4 py-3 border-b border-zinc-100">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Product Lines
              </p>
            </div>
            {productLines.map((pl) => {
              const isSelected = pl.id === selectedPl?.id;
              const lastUpdate = pl.updates[0];
              return (
                <a
                  key={pl.id}
                  href={`?pl=${pl.id}`}
                  className={`block px-4 py-3 border-b border-zinc-100 border-l-2 transition-colors ${
                    isSelected
                      ? "bg-zinc-50 border-l-zinc-900"
                      : "border-l-transparent hover:bg-zinc-50"
                  }`}
                >
                  <p className={`text-sm font-medium truncate ${isSelected ? "text-zinc-900" : "text-zinc-700"}`}>
                    {pl.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-400">
                    <span>{pl._count.triggerEvents} runs</span>
                    <span>·</span>
                    <span>{pl.updates.length} updates</span>
                  </div>
                  {lastUpdate ? (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Last update: {formatLastUpdate(lastUpdate.updatedAt)}
                    </p>
                  ) : (
                    <p className="text-xs text-zinc-300 mt-0.5 italic">No updates yet</p>
                  )}
                </a>
              );
            })}
          </aside>

          {/* Right panel */}
          <main className="flex-1 overflow-y-auto">
            {selectedPl ? (
              <div className="max-w-2xl mx-auto px-8 py-8">
                <div className="mb-8">
                  <h2 className="text-xl font-semibold text-zinc-900">{selectedPl.name}</h2>
                  {selectedPl.description && (
                    <p className="text-sm text-zinc-500 mt-1">{selectedPl.description}</p>
                  )}
                </div>

                {selectedPl.updates.length === 0 ? (
                  <p className="text-sm text-zinc-400 italic">No updates yet.</p>
                ) : (
                  <div className="space-y-10">
                    {selectedPl.updates.map((update) => (
                      <div key={update.id}>
                        <div className="flex items-center gap-2 mb-3">
                          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                            Week {update.isoWeek}, {update.year}
                          </p>
                          <span className="text-xs text-zinc-300">·</span>
                          <LocalTime iso={update.updatedAt.toISOString()} className="text-xs text-zinc-400" />
                        </div>
                        <UpdateContent content={update.content} jiraBaseUrl={jiraBaseUrl} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-zinc-400">Select a product line to view updates.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
