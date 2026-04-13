const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";

const METRICS = [
  { label: "Total leads", value: "287" },
  { label: "Best channel", value: "Linkedin" },
  { label: "Conversion rate", value: "4.3%" },
  { label: "Avg lead score", value: "64" },
] as const;

type Channel = "Meta" | "Linkedin" | "Google ads" | "Organic";

const LEADS_ROWS: {
  name: string;
  company: string;
  channel: Channel;
  campaign: string;
  score: number;
}[] = [
  {
    name: "Alfred Basten",
    company: "Schibsted",
    channel: "Meta",
    campaign: "B2B SaaS Q2 EMEA",
    score: 78,
  },
  {
    name: "Sara Nilsen",
    company: "Aker ASA",
    channel: "Linkedin",
    campaign: "CTO retargeting",
    score: 56,
  },
  {
    name: "Jonas Berg",
    company: "Equinor",
    channel: "Google ads",
    campaign: "Enterprise pipeline",
    score: 82,
  },
  {
    name: "Maria Santos",
    company: "Telenor",
    channel: "Organic",
    campaign: "Content nurture",
    score: 44,
  },
  {
    name: "Erik Lind",
    company: "DNB",
    channel: "Linkedin",
    campaign: "CFO awareness",
    score: 91,
  },
];

function ChannelPill({ channel }: { channel: Channel }) {
  const styles: Record<Channel, string> = {
    Meta: "bg-blue-800 text-white",
    Linkedin: "bg-sky-200 text-sky-950",
    "Google ads": "bg-amber-100 text-amber-950",
    Organic: "bg-pink-100 text-pink-950",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[12px] font-medium ${styles[channel]}`}
    >
      {channel}
    </span>
  );
}

export default function LeadsPage() {
  return (
    <div className={`min-h-screen ${DASH_BG_CLASS} font-sans antialiased`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-8 pb-4 pt-14">
        <header>
          <div className="inline-flex -translate-x-16 items-center gap-2 rounded-full bg-neutral-200/90 p-1.5 text-[13px] text-neutral-700 shadow-sm sm:-translate-x-24 lg:-translate-x-32">
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full bg-white px-3 py-1.5 font-medium text-neutral-800 shadow-sm marker:content-none [&::-webkit-details-marker]:hidden">
                <span>Portal</span>
                <span className="text-neutral-500" aria-hidden>
                  ▾
                </span>
              </summary>
              <div className="absolute left-0 top-full z-20 mt-2 w-max origin-top-left rounded-2xl border border-white/55 bg-white/55 p-1.5 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-[opacity,transform] duration-300 ease-out will-change-transform opacity-0 translate-y-[-10px] scale-[0.96] pointer-events-none group-open:pointer-events-auto group-open:opacity-100 group-open:translate-y-0 group-open:scale-100">
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-neutral-900 transition active:translate-y-px hover:bg-white/60"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </details>
            <span className="pr-3 text-neutral-800">Leads</span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex w-full shrink-0 flex-col justify-center min-h-[calc(100vh-8rem)]">
            <div className="w-full">
              <div className="-translate-y-4 space-y-3">
                <p
                  className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
                >
                  Leads.
                </p>
                <p
                  className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
                >
                  These are your campaign numbers this month.
                </p>
              </div>

              <section
                aria-label="Lead metrics"
                className="mt-10 w-full grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-[10px]"
              >
                {METRICS.map((m) => (
                  <div
                    key={m.label}
                    className={`rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}
                  >
                    <p className="text-[13px] font-normal text-neutral-600">
                      {m.label}
                    </p>
                    <p
                      className={`mt-2 text-[28px] font-normal tracking-tight ${HERO_TEXT_CLASS}`}
                    >
                      {m.value}
                    </p>
                  </div>
                ))}
              </section>

              <section aria-label="Leads table" className="mt-2 w-full">
                <div
                  className={`overflow-hidden rounded-2xl shadow-sm ${CARD_BG_CLASS}`}
                >
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="border-b border-neutral-300/60">
                          <th
                            scope="col"
                            className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}
                          >
                            Name
                          </th>
                          <th
                            scope="col"
                            className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}
                          >
                            Company
                          </th>
                          <th
                            scope="col"
                            className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}
                          >
                            Channel
                          </th>
                          <th
                            scope="col"
                            className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}
                          >
                            Campaign
                          </th>
                          <th
                            scope="col"
                            className={`px-5 py-3.5 font-medium ${HERO_TEXT_CLASS}`}
                          >
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {LEADS_ROWS.map((row, i) => (
                          <tr
                            key={`${row.name}-${row.company}`}
                            className={
                              i % 2 === 0 ? "bg-white/80" : "bg-white/40"
                            }
                          >
                            <td className="px-5 py-3 font-normal text-neutral-800">
                              {row.name}
                            </td>
                            <td className="px-5 py-3 font-normal text-neutral-800">
                              {row.company}
                            </td>
                            <td className="px-5 py-3">
                              <ChannelPill channel={row.channel} />
                            </td>
                            <td className="px-5 py-3 font-normal text-neutral-800">
                              {row.campaign}
                            </td>
                            <td className="px-5 py-3 font-normal tabular-nums text-neutral-800">
                              {row.score}
                            </td>
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
