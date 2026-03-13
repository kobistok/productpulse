import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { getISOWeek, getISOWeekYear } from "date-fns";
import { UpdateContent } from "@/components/update-content";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ week?: string }>;
}

export default async function PublicDashboardPage({ params, searchParams }: Props) {
  const { token } = await params;
  const { week: weekParam } = await searchParams;

  const dashboardInvite = await prisma.dashboardInvite.findUnique({
    where: { token },
    include: { org: true },
  });

  if (!dashboardInvite) notFound();
  if (dashboardInvite.expiresAt && dashboardInvite.expiresAt < new Date()) notFound();

  const productLines = await prisma.productLine.findMany({
    where: { orgId: dashboardInvite.orgId },
    include: {
      updates: {
        orderBy: [{ year: "desc" }, { isoWeek: "desc" }],
        take: 52, // up to a year of weekly updates
      },
    },
    orderBy: { name: "asc" },
  });

  // Collect all unique year-week combinations across all product lines
  const weekSet = new Set<string>();
  for (const pl of productLines) {
    for (const u of pl.updates) {
      weekSet.add(`${u.year}-${String(u.isoWeek).padStart(2, "0")}`);
    }
  }
  const weeks = [...weekSet].sort().reverse();

  const currentWeek = `${getISOWeekYear(new Date())}-${String(getISOWeek(new Date())).padStart(2, "0")}`;
  const selectedWeek = (weekParam && weeks.includes(weekParam)) ? weekParam : (weeks[0] ?? currentWeek);
  const [selYear, selWeekNum] = selectedWeek.split("-").map(Number);

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-8 py-5">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Product Pulse</p>
        <h1 className="text-xl font-semibold text-zinc-900 mt-0.5">{dashboardInvite.org.name}</h1>
      </header>

      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Week selector */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {weeks.map((w) => {
            const [wy, wn] = w.split("-").map(Number);
            const isCurrent = w === currentWeek;
            const isSelected = w === selectedWeek;
            return (
              <a
                key={w}
                href={`?week=${w}`}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isSelected
                    ? "bg-zinc-900 text-white"
                    : "bg-white border border-zinc-200 text-zinc-600 hover:border-zinc-300"
                }`}
              >
                W{wn} {wy}
                {isCurrent && " (current)"}
              </a>
            );
          })}
        </div>

        {/* Updates grid */}
        {productLines.length === 0 ? (
          <p className="text-sm text-zinc-500 text-center py-20">No product lines yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {productLines.map((pl) => {
              const update = pl.updates.find(
                (u) => u.year === selYear && u.isoWeek === selWeekNum
              );
              return (
                <div
                  key={pl.id}
                  className="bg-white border border-zinc-200 rounded-xl p-5"
                >
                  <h2 className="text-base font-semibold text-zinc-900">{pl.name}</h2>
                  {pl.description && (
                    <p className="text-sm text-zinc-400 mt-0.5 mb-3">{pl.description}</p>
                  )}
                  <div className={pl.description ? "" : "mt-3"}>
                    {update ? (
                      <UpdateContent content={update.content} />
                    ) : (
                      <p className="text-sm text-zinc-400 italic">No update this week</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
