import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/DashboardHeader";

/** TEMP: set false to require session + real data again. Must match app/dashboard/page.tsx. */
const DASHBOARD_DEV_BYPASS = true;

/** Mirrors `DashboardShell` tokens in app/dashboard/page.tsx */
const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const CARD_TEXT_CLASS = "text-[#3E3E3E]";
const HERO_TEXT_CLASS = "text-[#363636]";
const PLACEHOLDER_IMG_CLASS = "bg-[#D4D4D4]";

const INSIGHT_CARD_W_CLASS = "w-full max-w-[1010px]";
const INSIGHT_CARD_H_CLASS = "h-[430px]";

const STATIC_CAMPAIGNS = [
  {
    name: "Shoe Campaign",
    lines: [
      "120 out of 600 people who clicked this ad submitted a form.",
      "This is your best performing campaign this month.",
    ],
  },
  {
    name: "Golf Campaign",
    lines: [
      "14 out of 340 people who clicked this ad submitted a form.",
      "Consider reviewing the landing page.",
    ],
  },
  {
    name: "Basketball Campaign",
    lines: [
      "3 out of 280 people who clicked this ad submitted a form.",
      "This campaign is underperforming.",
    ],
  },
] as const;

type OverviewLead = {
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
};

type OverviewResponse = {
  leads: OverviewLead[];
  by_channel: { utm_source: string; count: number }[];
};

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

function formatChannelLabel(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s) {
    return "Unknown";
  }
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

function countBySourceMonthly(leads: OverviewLead[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of leads) {
    if (!isThisMonth(l.created_at)) {
      continue;
    }
    const key = (l.utm_source ?? "").trim() || "unknown";
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return m;
}

function buildHeroSecondLine(leads: OverviewLead[]): string {
  const monthly = leads.filter((l) => isThisMonth(l.created_at));
  if (monthly.length === 0) {
    return "You have no leads this month yet — keep your capture script live and check back soon.";
  }
  const bySource = countBySourceMonthly(leads);
  let bestKey = "";
  let bestCount = -1;
  for (const [k, c] of Array.from(bySource.entries())) {
    if (c > bestCount) {
      bestCount = c;
      bestKey = k;
    }
  }
  return `Your best conversions are from ${formatChannelLabel(bestKey)} this month.`;
}

function buildInsightParagraph(leads: OverviewLead[]): string {
  const monthly = leads.filter((l) => isThisMonth(l.created_at));
  if (monthly.length === 0) {
    return "Once leads start coming in, we will compare channels automatically and highlight where you are strongest and where to improve.";
  }
  const bySource = countBySourceMonthly(leads);
  const entries = Array.from(bySource.entries()).filter(([, c]) => c > 0);
  if (entries.length === 0) {
    return "Lead data is still sparse; keep tracking so we can rank your channels.";
  }
  entries.sort((a, b) => b[1] - a[1]);
  const [bestKey, bestCount] = entries[0]!;
  if (entries.length === 1) {
    return `All ${monthly.length} lead${monthly.length === 1 ? "" : "s"} this month came through ${formatChannelLabel(bestKey)}. Consider scaling what works or testing new channels to diversify.`;
  }
  const [, worstCount] = entries[entries.length - 1]!;
  const worstKey = entries[entries.length - 1]![0];
  return `Your strongest channel is ${formatChannelLabel(bestKey)} with ${bestCount} lead${bestCount === 1 ? "" : "s"} this month. Your weakest channel is ${formatChannelLabel(worstKey)} with ${worstCount} lead${worstCount === 1 ? "" : "s"} — consider reviewing creative, targeting, or landing page alignment.`;
}

function buildHighlightedFromLeads(leads: OverviewLead[]): {
  name: string;
  lines: string[];
}[] {
  const monthly = leads.filter((l) => isThisMonth(l.created_at));
  const byCampaign = new Map<string, { count: number; sources: Map<string, number> }>();
  for (const l of monthly) {
    const name = (l.utm_campaign ?? "").trim() || "Unattributed";
    const src = (l.utm_source ?? "").trim() || "unknown";
    let g = byCampaign.get(name);
    if (!g) {
      g = { count: 0, sources: new Map() };
      byCampaign.set(name, g);
    }
    g.count += 1;
    g.sources.set(src, (g.sources.get(src) ?? 0) + 1);
  }
  const rows = Array.from(byCampaign.entries()).map(([name, { count, sources }]) => {
    const topSource = Array.from(sources.entries()).sort((a, b) => b[1] - a[1])[0];
    const srcLabel = topSource
      ? formatChannelLabel(topSource[0])
      : "Unknown";
    return {
      name,
      lines: [
        `${count} lead${count === 1 ? "" : "s"} this month, mostly from ${srcLabel}.`,
        count >= (monthly.length > 0 ? monthly.length / 2 : 0)
          ? "This campaign is carrying a large share of your volume."
          : "Review this campaign if performance should be higher.",
      ],
    };
  });
  rows.sort((a, b) => {
    const ca = byCampaign.get(a.name)!.count;
    const cb = byCampaign.get(b.name)!.count;
    return cb - ca;
  });
  return rows.slice(0, 6);
}

export default async function OverviewPage() {
  let heroSecondLine =
    "Your best conversions are from Linkedin this month.";
  let insightBody =
    "Your LinkedIn ads brought 10 people to your contact page this month. 4 submitted the form, which is actually strong. However your Google Ads brought 87 people and only 2 converted. Something is broken there, either the ad is attracting the wrong people or the page isn't matching what they expected.";
  let highlighted: { name: string; lines: string[] }[] = STATIC_CAMPAIGNS.map(
    (c) => ({ name: c.name, lines: [...c.lines] }),
  );

  if (!DASHBOARD_DEV_BYPASS) {
    const token = cookies().get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySignedSession(token) : null;
    if (!session) {
      redirect("/login");
    }

    const hdrs = headers();
    const host = hdrs.get("host") ?? "localhost:3000";
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const cookieHeader = cookies()
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");

    const res = await fetch(`${proto}://${host}/api/dashboard/overview`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (res.status === 401) {
      redirect("/login");
    }

    if (res.ok) {
      const data = (await res.json()) as OverviewResponse;
      const leads = data.leads ?? [];
      heroSecondLine = buildHeroSecondLine(leads);
      insightBody = buildInsightParagraph(leads);
      const derived = buildHighlightedFromLeads(leads);
      highlighted = derived.length > 0 ? derived : [{ name: "Campaigns", lines: ["No campaign-tagged leads this month yet.", "Add utm_campaign on your links to see breakdowns here."] }];
    }
  }

  return (
    <div className={`min-h-screen ${DASH_BG_CLASS} font-sans antialiased`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-8 pb-4 pt-14">
        <DashboardHeader showHome />

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex w-full shrink-0 flex-col justify-center min-h-[calc(100vh-8rem)]">
            <div className="w-full">
              <div className="space-y-3">
                <p
                  className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
                >
                  Overview.
                </p>
                <p
                  className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
                >
                  {heroSecondLine}
                </p>
              </div>

              <section aria-labelledby="insight-card-label" className="mt-16">
                <div
                  className={`flex flex-col rounded-2xl p-8 shadow-sm ${INSIGHT_CARD_W_CLASS} ${INSIGHT_CARD_H_CLASS} ${CARD_BG_CLASS}`}
                >
                  <p
                    id="insight-card-label"
                    className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}
                  >
                    Overview
                  </p>
                  <span className="flex-1" aria-hidden />
                  <p
                    className={`max-w-4xl text-[20px] font-normal leading-relaxed ${HERO_TEXT_CLASS}`}
                  >
                    {insightBody}
                  </p>
                </div>
              </section>
            </div>
          </div>

          <section
            aria-labelledby="campaigns-heading"
            className="mt-16 w-full shrink-0 space-y-8"
          >
            <p
              id="campaigns-heading"
              className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
            >
              Highlighted campaigns.
            </p>

            <ul className={`flex flex-col gap-[10px] ${INSIGHT_CARD_W_CLASS}`}>
              {highlighted.map((c, idx) => {
                const isBest = idx === 0;
                const isWorst = highlighted.length > 1 && idx === highlighted.length - 1;
                return (
                  <li key={`${c.name}-${idx}`}>
                    <div
                      className={`relative flex flex-col gap-6 rounded-2xl p-8 shadow-sm sm:flex-row sm:items-stretch sm:gap-8 ${CARD_BG_CLASS}`}
                    >
                      {isBest && (
                        <span className="absolute right-6 top-6 rounded-full bg-green-400 px-3 py-1 text-[12px] font-medium text-green-950">
                          Best campaign
                        </span>
                      )}
                      {isWorst && (
                        <span className="absolute right-6 top-6 rounded-full bg-red-400 px-3 py-1 text-[12px] font-medium text-red-950">
                          Worst campaign
                        </span>
                      )}
                      <div className="flex shrink-0 sm:w-44">
                        <div
                          className={`aspect-[4/3] w-full rounded-lg ${PLACEHOLDER_IMG_CLASS}`}
                          aria-hidden
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <p
                          className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}
                        >
                          {c.name}
                        </p>
                        <span className="flex-1" aria-hidden />
                        <div
                          className={`flex flex-col gap-1 text-base font-normal leading-relaxed ${HERO_TEXT_CLASS}`}
                        >
                          {c.lines.map((line, lineIdx) => (
                            <p key={`${line}-${lineIdx}`} className="m-0">
                              {line}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
