import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/DashboardHeader";

/** TEMP: set false to require session + real data again. Must match app/dashboard/page.tsx. */
const DASHBOARD_DEV_BYPASS = true;

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";

const STATIC_METRICS: { label: string; value: string }[] = [
  { label: "Total leads", value: "287" },
  { label: "Best channel", value: "Linkedin" },
  { label: "Conversion rate", value: "4.3%" },
  { label: "Avg lead score", value: "64" },
];

const STATIC_LEADS_ROWS = [
  { name: "Alfred Basten", company: "Schibsted", channel: "Meta", campaign: "B2B SaaS Q2 EMEA", score: 78 },
  { name: "Sara Nilsen", company: "Aker ASA", channel: "Linkedin", campaign: "CTO retargeting", score: 56 },
  { name: "Espen Eik", company: "Telenor", channel: "Google ads", campaign: "Product launch", score: 88 },
  { name: "Hakon Kleve", company: "DNB", channel: "Organic", campaign: "-", score: 54 },
  { name: "Bernard Tangen", company: "Mowi", channel: "Linkedin", campaign: "CTO retargeting", score: 61 },
];

type OverviewLead = {
  email: string;
  name: string | null;
  company: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  created_at: string;
};

type OverviewResponse = {
  leads: OverviewLead[];
  by_channel: { utm_source: string; count: number }[];
};

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function formatChannel(raw: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "Organic";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const CHANNEL_STYLES: Record<string, string> = {
  Linkedin: "bg-sky-200 text-sky-900",
  Meta: "bg-indigo-800 text-white",
  Google: "bg-amber-100 text-amber-900",
  "Google ads": "bg-amber-100 text-amber-900",
  Facebook: "bg-blue-600 text-white",
  Instagram: "bg-pink-500 text-white",
  Tiktok: "bg-neutral-900 text-white",
  Twitter: "bg-sky-500 text-white",
  X: "bg-neutral-900 text-white",
  Youtube: "bg-red-600 text-white",
  Email: "bg-violet-200 text-violet-900",
  Organic: "bg-amber-50 text-amber-800",
  Unknown: "bg-neutral-200 text-neutral-700",
};

function ChannelPill({ channel }: { channel: string }) {
  const style = CHANNEL_STYLES[channel] ?? "bg-neutral-200 text-neutral-800";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${style}`}>
      {channel}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={`rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
      <p className="text-[13px] font-normal text-neutral-600">{label}</p>
      <p className={`mt-2 text-[28px] font-normal tracking-tight ${HERO_TEXT_CLASS}`}>{value}</p>
    </div>
  );
}

export default async function LeadsPage() {
  let metrics = STATIC_METRICS.map((m) => ({ label: m.label, value: m.value }));
  let rows = STATIC_LEADS_ROWS.map((r) => ({
    name: r.name,
    company: r.company,
    channel: r.channel,
    campaign: r.campaign,
    score: r.score,
  }));

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
      const monthly = leads.filter((l) => isThisMonth(l.created_at));
      const byChannel = data.by_channel ?? [];
      const bestChannel = byChannel.length > 0 ? byChannel[0]!.utm_source : "-";

      metrics = [
        { label: "Total leads", value: String(monthly.length) },
        { label: "Best channel", value: formatChannel(bestChannel) },
        { label: "Conversion rate", value: monthly.length > 0 ? `${((monthly.length / Math.max(leads.length, 1)) * 100).toFixed(1)}%` : "-" },
        { label: "Avg lead score", value: "-" },
      ];

      rows = monthly.slice(0, 50).map((l) => ({
        name: l.name ?? l.email.split("@")[0] ?? "",
        company: l.company ?? "-",
        channel: formatChannel(l.utm_source),
        campaign: l.utm_campaign ?? "-",
        score: 0,
      }));
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
                <p className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}>
                  Leads.
                </p>
                <p className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}>
                  These are your campaign numbers this month.
                </p>
              </div>

              <section
                aria-label="Lead metrics"
                className="mt-16 w-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[10px]"
              >
                {metrics.map((m) => (
                  <MetricCard key={m.label} label={m.label} value={m.value} />
                ))}
              </section>

              <section aria-label="Leads table" className="mt-2 w-full">
                <div className={`overflow-hidden rounded-2xl shadow-sm ${CARD_BG_CLASS}`}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-neutral-300/60">
                          <th scope="col" className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}>Name</th>
                          <th scope="col" className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}>Company</th>
                          <th scope="col" className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}>Channel</th>
                          <th scope="col" className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}>Campaign</th>
                          <th scope="col" className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => (
                          <tr
                            key={`${row.name}-${row.company}-${i}`}
                            className={i % 2 === 0 ? "bg-white/80" : "bg-white/40"}
                          >
                            <td className="px-5 py-3 font-normal text-neutral-800">{row.name}</td>
                            <td className="px-5 py-3 font-normal text-neutral-800">{row.company}</td>
                            <td className="px-5 py-3">
                              <ChannelPill channel={row.channel} />
                            </td>
                            <td className="px-5 py-3 font-normal text-neutral-800">{row.campaign}</td>
                            <td className="px-5 py-3 font-normal tabular-nums text-neutral-800">{row.score || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
