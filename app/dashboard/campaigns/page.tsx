const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";
const PLACEHOLDER_IMG_CLASS = "bg-[#D4D4D4]";
const MUTED_CLASS = "text-neutral-500";

const CAMPAIGNS = [
  "Shoe Campaign",
  "Basketball Campaign",
  "Golf Campaign",
  "Women Tennis Campaign",
  "Image Campaign",
  "Tennis Campaign",
] as const;

function CampaignCard({ name }: { name: string }) {
  return (
    <article
      className={`flex h-[210px] w-[330px] max-w-full flex-col overflow-hidden rounded-2xl p-3 shadow-sm ${CARD_BG_CLASS}`}
    >
      <div
        className={`min-h-0 w-full flex-1 rounded-lg ${PLACEHOLDER_IMG_CLASS}`}
        aria-hidden
      />
      <div className="mt-2 flex shrink-0 items-end justify-between gap-2 text-[13px] font-normal">
        <span className={`min-w-0 truncate ${HERO_TEXT_CLASS}`}>{name}</span>
        <button
          type="button"
          className={`shrink-0 ${MUTED_CLASS} transition hover:opacity-80`}
        >
          Edit →
        </button>
      </div>
    </article>
  );
}

export default function CampaignsPage() {
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
            <span className="pr-3 text-neutral-800">Campaigns</span>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex w-full shrink-0 flex-col justify-center min-h-[calc(100vh-8rem)]">
            <div className="w-full">
              <div className="space-y-3">
                <p
                  className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
                >
                  Campaigns.
                </p>
                <p
                  className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
                >
                  This is your campaign dashboard.
                </p>
              </div>

              <section aria-label="Campaign grid" className="mt-10 w-full">
                <ul className="m-0 grid list-none grid-cols-1 place-items-center justify-items-center gap-y-2 gap-x-0 p-0 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2 lg:grid-cols-3 lg:gap-x-[10px] lg:gap-y-[10px]">
                  <li className="col-span-full grid w-full max-w-none grid-cols-1 justify-self-stretch sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-[10px]">
                    <div className="col-span-1 flex w-full justify-center sm:col-start-2 lg:col-start-3">
                      <div className="flex w-[330px] max-w-full justify-end">
                        <button
                          type="button"
                          className="rounded-none bg-neutral-200/90 px-4 py-1.5 text-[13px] font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-200"
                        >
                          Add Campaign +
                        </button>
                      </div>
                    </div>
                  </li>
                  {CAMPAIGNS.map((name) => (
                    <li key={name}>
                      <CampaignCard name={name} />
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
