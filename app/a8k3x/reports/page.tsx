import { DashboardHeader } from "@/components/DashboardHeader";

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";

const CLIENTS = ["Mowi", "Telenor", "Tine", "Artec Aqua"];
const MONTHS = ["April 2026", "February 2026"];

const ROWS = MONTHS.flatMap((month) =>
  CLIENTS.map((client) => ({ month, client })),
);

export default function AdminReportsPage() {
  return (
    <div className={`min-h-screen ${DASH_BG_CLASS} font-sans antialiased`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-8 pb-4 pt-14">
        <DashboardHeader showHome homeHref="/a8k3x" />

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex w-full shrink-0 flex-col justify-center min-h-[calc(100vh-8rem)]">
            <div className="w-full">
              <div className="space-y-3">
                <p className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}>
                  Hello Admin.
                </p>
                <p className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}>
                  Track and check sent out reports.
                </p>
              </div>

              <section className="mt-16 w-full">
                <ul className="flex flex-col gap-[10px]">
                  {ROWS.map((r, idx) => (
                    <li key={`${r.month}-${r.client}-${idx}`}>
                      <div
                        className={`flex items-center justify-between rounded-2xl px-8 py-5 shadow-sm ${CARD_BG_CLASS}`}
                      >
                        <span className={`text-[15px] font-normal ${HERO_TEXT_CLASS}`}>
                          {r.month}
                        </span>
                        <span className={`text-[15px] font-normal ${HERO_TEXT_CLASS}`}>
                          {r.client}
                        </span>
                        <button
                          type="button"
                          className="text-[13px] font-medium text-neutral-500 transition hover:text-neutral-800"
                        >
                          Preview
                        </button>
                      </div>
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
