import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { DashboardHeader } from "@/components/DashboardHeader";

/** TEMP: set false to require session + real data again. Must match app/dashboard/page.tsx. */
const DASHBOARD_DEV_BYPASS = true;

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";
const PLACEHOLDER_IMG_CLASS = "bg-[#D4D4D4]";
const MUTED_CLASS = "text-neutral-500";

const STATIC_CAMPAIGNS = [
  "Shoe Campaign",
  "Basketball Campaign",
  "Golf Campaign",
  "Women Tennis Campaign",
  "Image Campaign",
  "Tennis Campaign",
].map((name, i) => ({ id: `static-${i}`, name, imageUrl: null as string | null }));

type ApiCampaign = {
  id: string;
  name: string;
  image_url: string | null;
};

type CampaignsApiResponse = {
  campaigns: ApiCampaign[];
};

function CampaignCard({
  id,
  name,
  imageUrl,
}: {
  id: string;
  name: string;
  imageUrl?: string | null;
}) {
  return (
    <article
      className={`flex h-[210px] w-[330px] max-w-full flex-col overflow-hidden rounded-2xl p-3 shadow-sm ${CARD_BG_CLASS}`}
    >
      {imageUrl ? (
        <div className="min-h-0 w-full flex-1 overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        </div>
      ) : (
        <div
          className={`min-h-0 w-full flex-1 rounded-lg ${PLACEHOLDER_IMG_CLASS}`}
          aria-hidden
        />
      )}
      <div className="mt-2 flex shrink-0 items-end justify-between gap-2 text-[13px] font-normal">
        <span className={`min-w-0 truncate ${HERO_TEXT_CLASS}`}>{name}</span>
        <Link
          href={`/dashboard/campaigns/${id}`}
          className={`shrink-0 ${MUTED_CLASS} transition hover:opacity-80`}
        >
          Edit &rarr;
        </Link>
      </div>
    </article>
  );
}

export default async function CampaignsPage() {
  let list = STATIC_CAMPAIGNS;

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

    const res = await fetch(`${proto}://${host}/api/dashboard/campaigns`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });

    if (res.status === 401) {
      redirect("/login");
    }

    if (res.ok) {
      const data = (await res.json()) as CampaignsApiResponse;
      const campaigns = data.campaigns ?? [];
      list = campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        imageUrl: c.image_url,
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

              <section aria-label="Campaign grid" className="mt-16 w-full">
                <ul className="m-0 grid list-none grid-cols-1 place-items-center justify-items-center gap-y-2 gap-x-0 p-0 sm:grid-cols-2 sm:gap-x-6 sm:gap-y-2 lg:grid-cols-3 lg:gap-x-[10px] lg:gap-y-[10px]">
                  <li className="col-span-full grid w-full max-w-none grid-cols-1 justify-self-stretch sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3 lg:gap-x-[10px]">
                    <div className="col-span-1 flex w-full justify-center sm:col-start-2 lg:col-start-3">
                      <div className="flex w-[330px] max-w-full justify-end">
                        <Link
                          href="/dashboard/campaigns/new"
                          className="rounded-none bg-neutral-200/90 px-4 py-1.5 text-[13px] font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-200"
                        >
                          Add Campaign +
                        </Link>
                      </div>
                    </div>
                  </li>
                  {list.map((c) => (
                    <li key={c.id}>
                      <CampaignCard
                        id={c.id}
                        name={c.name}
                        imageUrl={c.imageUrl}
                      />
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
