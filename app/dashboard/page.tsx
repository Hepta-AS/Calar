import { and, eq } from "drizzle-orm";
import { ArrowRight, FileText, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenantUsers } from "@/lib/db/schema";
import { DashboardHeader } from "@/components/DashboardHeader";

/** TEMP: set false to require session + real data again. */
const DASHBOARD_DEV_BYPASS = true;
const FAKE_DISPLAY_NAME = "Jordan";
const FAKE_MONTH_LEADS = 12;

type OverviewLead = {
  created_at: string;
};

type OverviewResponse = {
  leads: OverviewLead[];
};

function isThisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

function greetingNameFromEmail(email: string): string {
  const local = email.split("@")[0]?.trim() || email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) {
    return "there";
  }
  return parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export default async function DashboardPage() {
  if (DASHBOARD_DEV_BYPASS) {
    const devEmail = cookies().get("dev_email")?.value;
    const displayName = devEmail
      ? greetingNameFromEmail(devEmail)
      : FAKE_DISPLAY_NAME;
    const monthLeadCount = FAKE_MONTH_LEADS;
    return (
      <DashboardShell displayName={displayName} monthLeadCount={monthLeadCount} />
    );
  }

  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySignedSession(token) : null;
  if (!session) {
    redirect("/login");
  }

  const [userRow] = await db
    .select({
      email: tenantUsers.email,
      displayName: tenantUsers.displayName,
    })
    .from(tenantUsers)
    .where(
      and(
        eq(tenantUsers.id, session.userId),
        eq(tenantUsers.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!userRow) {
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

  let monthLeadCount = 0;
  if (res.ok) {
    const data = (await res.json()) as OverviewResponse;
    const leads = data.leads ?? [];
    monthLeadCount = leads.filter((l) => isThisMonth(l.created_at)).length;
  }

  const trimmedProfileName = userRow.displayName?.trim();
  const displayName =
    trimmedProfileName && trimmedProfileName.length > 0
      ? trimmedProfileName
      : greetingNameFromEmail(userRow.email);

  return (
    <DashboardShell displayName={displayName} monthLeadCount={monthLeadCount} />
  );
}

function DashboardShell({
  displayName,
  monthLeadCount,
}: {
  displayName: string;
  monthLeadCount: number;
}) {
  const DASH_BG_CLASS = "bg-[#F6F6F6]";
  const CARD_BG_CLASS = "bg-[#EFEFEF]";
  const CARD_TEXT_CLASS = "text-[#3E3E3E]";
  const HERO_TEXT_CLASS = "text-[#363636]";
  const ICON_CLASS = "text-black";
  const ARROW_SIZE_CLASS = "h-8 w-8";

  return (
    <div className={`min-h-screen ${DASH_BG_CLASS} font-sans antialiased`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-8 pb-4 pt-14">
        <DashboardHeader />

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex w-full shrink-0 flex-col justify-center min-h-[calc(100vh-8rem)]">
            <div className="w-full">
              <div className="space-y-3">
              <p
                className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
              >
                Hello {displayName}.
              </p>
              <p
                className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}
              >
                You have {monthLeadCount} new{" "}
                {monthLeadCount === 1 ? "lead" : "leads"} this month.
              </p>
            </div>

            <div className="mt-16 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-[10px]">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-[10px]">
                <Link
                  href="/dashboard/overview"
                  className={`flex h-[430px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[350px] ${CARD_BG_CLASS}`}
                >
                  <span
                    className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}
                  >
                    Overview
                  </span>
                  <span className="flex-1" />
                  <div className="flex items-end">
                    <ArrowRight
                      className={`${ARROW_SIZE_CLASS} ${ICON_CLASS}`}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                </Link>
                <Link
                  href="/dashboard/campaigns"
                  className={`flex h-[430px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[350px] ${CARD_BG_CLASS}`}
                >
                  <span
                    className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}
                  >
                    Campaigns
                  </span>
                  <span className="flex-1" />
                  <div className="flex items-end">
                    <TrendingUp
                      className={`${ARROW_SIZE_CLASS} ${ICON_CLASS}`}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                </Link>
              </div>

              <div className="grid gap-6 lg:h-[430px] lg:grid-rows-2 lg:gap-[10px]">
                <Link
                  href="/dashboard/leads"
                  className={`flex h-[210px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[290px] ${CARD_BG_CLASS}`}
                >
                  <span
                    className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}
                  >
                    Leads
                  </span>
                  <span className="flex-1" />
                  <div className="flex items-end">
                    <Users
                      className={`h-7 w-7 ${ICON_CLASS}`}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                </Link>
                <Link
                  href="/dashboard/reports"
                  className={`flex h-[210px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[290px] ${CARD_BG_CLASS}`}
                >
                  <span
                    className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}
                  >
                    Reports
                  </span>
                  <span className="flex-1" />
                  <div className="flex items-end">
                    <FileText
                      className={`h-7 w-7 ${ICON_CLASS}`}
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  </div>
                </Link>
              </div>
            </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

