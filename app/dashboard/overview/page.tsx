/** Mirrors `DashboardShell` tokens in app/dashboard/page.tsx */
const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const CARD_TEXT_CLASS = "text-[#3E3E3E]";
const HERO_TEXT_CLASS = "text-[#363636]";
const PLACEHOLDER_IMG_CLASS = "bg-[#D4D4D4]";

const INSIGHT_CARD_W_CLASS = "w-full max-w-[1010px]";
const INSIGHT_CARD_H_CLASS = "h-[430px]";

const CAMPAIGNS = [
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

export default function OverviewPage() {
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
            <span className="pr-3 text-neutral-800">Overview</span>
          </div>
        </header>

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
                  Your best conversions are from Linkedin this month.
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
                    Your LinkedIn ads brought 10 people to your contact page this
                    month. 4 submitted the form, which is actually strong.
                    However your Google Ads brought 87 people and only 2 converted.
                    Something is broken there, either the ad is attracting the
                    wrong people or the page isn&apos;t matching what they
                    expected.
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
              {CAMPAIGNS.map((c) => (
                <li key={c.name}>
                  <div
                    className={`flex flex-col gap-6 rounded-2xl p-8 shadow-sm sm:flex-row sm:items-stretch sm:gap-8 ${CARD_BG_CLASS}`}
                  >
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
                        {c.lines.map((line) => (
                          <p key={line} className="m-0">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
}
