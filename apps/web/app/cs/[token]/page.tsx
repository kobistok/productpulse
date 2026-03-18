import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function ContentSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const agent = await prisma.contentAgent.findUnique({
    where: { shareToken: token },
    include: {
      outputs: {
        where: { status: "published" },
        orderBy: [{ year: "desc" }, { isoWeek: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!agent) notFound();

  // Group outputs by week
  const grouped = groupByWeek(agent.outputs);

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="w-5 h-5 shrink-0">
              <rect width="32" height="32" rx="7" fill="#18181b"/>
              <polyline points="2,16 7,16 9.5,9 13,23 16,7 19,23 22.5,9 25,16 30,16" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Product Pulse</span>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">{agent.name}</h1>
        </div>

        {grouped.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-zinc-400">No published content yet.</p>
          </div>
        ) : (
          <div className="space-y-10">
            {grouped.map(({ week, year, outputs }) => (
              <div key={`${year}-${week}`}>
                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-4">
                  Week {week} · {year}
                </p>
                <div className="space-y-6">
                  {outputs.map((output) => (
                    <article key={output.id} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                      <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                            output.outputType === "kb"
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : "bg-orange-50 text-orange-700 border-orange-100"
                          }`}
                        >
                          {output.outputType === "kb" ? "KB Article" : "Customer Update"}
                        </span>
                      </div>
                      <div className="px-6 py-5">
                        <h2 className="text-base font-semibold text-zinc-900 mb-3">{output.title}</h2>
                        <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                          {output.content}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function groupByWeek(outputs: Array<{ id: string; outputType: string; title: string; content: string; isoWeek: number; year: number; status: string; createdAt: Date; updatedAt: Date; contentAgentId: string }>) {
  const map = new Map<string, { week: number; year: number; outputs: typeof outputs }>();
  for (const output of outputs) {
    const key = `${output.year}-${output.isoWeek}`;
    if (!map.has(key)) map.set(key, { week: output.isoWeek, year: output.year, outputs: [] });
    map.get(key)!.outputs.push(output);
  }
  return [...map.values()].sort((a, b) => b.year - a.year || b.week - a.week);
}
