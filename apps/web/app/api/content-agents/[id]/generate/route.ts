import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { runContentAgent } from "@productpulse/agent";
import { getISOWeek, getISOWeekYear, subWeeks } from "date-fns";

type ZendeskArticle = { id: number; title: string; url: string };

async function searchZendeskArticles(
  config: { subdomain: string; email: string; apiToken: string },
  productLineUpdates: Array<{ content: string }>
): Promise<ZendeskArticle[]> {
  try {
    const query = productLineUpdates
      .map((u) => u.content.slice(0, 150))
      .join(" ")
      .slice(0, 300);

    const auth = Buffer.from(`${config.email}/token:${config.apiToken}`).toString("base64");
    const url = `https://${config.subdomain}.zendesk.com/api/v2/help_center/search?query=${encodeURIComponent(query)}&per_page=5`;

    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    });

    if (!res.ok) return [];

    const data = (await res.json()) as { results?: Array<{ id: number; title: string; html_url: string }> };
    return (data.results ?? []).map((r) => ({ id: r.id, title: r.title, url: r.html_url }));
  } catch {
    return [];
  }
}

type Timeframe = "today" | "this_week" | "last_week" | "last_2_weeks" | "last_4_weeks";

function getWeeksForTimeframe(timeframe: Timeframe): Array<{ isoWeek: number; year: number }> {
  const now = new Date();
  const currentWeek = getISOWeek(now);
  const currentYear = getISOWeekYear(now);

  if (timeframe === "today" || timeframe === "this_week") {
    return [{ isoWeek: currentWeek, year: currentYear }];
  }

  if (timeframe === "last_week") {
    const lastWeekDate = subWeeks(now, 1);
    return [{ isoWeek: getISOWeek(lastWeekDate), year: getISOWeekYear(lastWeekDate) }];
  }

  if (timeframe === "last_2_weeks") {
    return [0, 1].map((offset) => {
      const d = subWeeks(now, offset);
      return { isoWeek: getISOWeek(d), year: getISOWeekYear(d) };
    });
  }

  // last_4_weeks
  return [0, 1, 2, 3].map((offset) => {
    const d = subWeeks(now, offset);
    return { isoWeek: getISOWeek(d), year: getISOWeekYear(d) };
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSession();
  const { id } = await params;
  const orgId = user.memberships[0]?.orgId;
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const agent = await prisma.contentAgent.findFirst({ where: { id, orgId } });
  if (!agent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { timeframe = "this_week" } = (await request.json()) as { timeframe?: Timeframe };

  const weeks = getWeeksForTimeframe(timeframe);

  // Fetch org skills
  const orgSkills = await prisma.orgSkill.findMany({
    where: { orgId },
    select: { name: true, content: true },
  });

  // Fetch updates from source product lines
  const updates = await prisma.update.findMany({
    where: {
      productLineId: { in: agent.productLineIds },
      OR: weeks.map((w) => ({ isoWeek: w.isoWeek, year: w.year })),
    },
    include: { productLine: { select: { name: true } } },
    orderBy: [{ year: "desc" }, { isoWeek: "desc" }],
  });

  const productLineUpdates = updates.map((u) => ({
    productLineName: u.productLine.name,
    content: u.content,
    isoWeek: u.isoWeek,
    year: u.year,
  }));

  if (productLineUpdates.length === 0) {
    return NextResponse.json(
      { error: "No updates found for the selected timeframe. Try a broader timeframe like 'Last 4 weeks'." },
      { status: 422 }
    );
  }

  // Fetch Zendesk articles if configured
  const zendeskConfig = await prisma.zendeskConfig.findUnique({ where: { orgId } });
  const zendeskArticles = zendeskConfig
    ? await searchZendeskArticles(zendeskConfig, productLineUpdates)
    : [];
  const zendeskArticlesJson = zendeskArticles.length > 0 ? JSON.stringify(zendeskArticles) : null;

  const results = await runContentAgent({
    name: agent.name,
    specificContext: agent.specificContext,
    outputTypes: agent.outputTypes,
    orgSkills,
    productLineUpdates,
  });

  if (results.length === 0) {
    return NextResponse.json({ error: "Agent produced no outputs. Try a broader timeframe." }, { status: 422 });
  }

  const now = new Date();
  const isoWeek = getISOWeek(now);
  const year = getISOWeekYear(now);

  const created = await Promise.all(
    results.map((r) =>
      prisma.contentOutput.create({
        data: {
          contentAgentId: id,
          outputType: r.outputType,
          title: r.title,
          content: r.content,
          status: "draft",
          isoWeek,
          year,
          zendeskArticles: zendeskArticlesJson,
        },
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}
