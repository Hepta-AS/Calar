import { FileText, Settings, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/DashboardHeader";

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const CARD_TEXT_CLASS = "text-[#3E3E3E]";
const HERO_TEXT_CLASS = "text-[#363636]";
const ICON_CLASS = "text-black";

export default function AdminHomePage() {
  return (
    <div className={`min-h-screen ${DASH_BG_CLASS} font-sans antialiased`}>
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-8 pb-4 pt-14">
        <DashboardHeader />

        <main className="flex min-h-0 flex-1 flex-col">
          <div className="flex w-full shrink-0 flex-col justify-center min-h-[calc(100vh-8rem)]">
            <div className="w-full">
              <div className="space-y-3">
                <p className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}>
                  Hello Admin.
                </p>
                <p className={`text-4xl font-light tracking-tight ${HERO_TEXT_CLASS}`}>
                  Welcome to the dashboard.
                </p>
              </div>

              <div className="mt-16 flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-[10px]">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-[10px]">
                  <Link
                    href="/a8k3x/clients"
                    className={`flex h-[430px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[350px] ${CARD_BG_CLASS}`}
                  >
                    <span className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}>
                      Clients
                    </span>
                    <span className="flex-1" />
                    <div className="flex items-end">
                      <Users className="h-8 w-8 text-black" strokeWidth={1.5} aria-hidden />
                    </div>
                  </Link>
                  <Link
                    href="/a8k3x/clients/new"
                    className={`flex h-[430px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[350px] ${CARD_BG_CLASS}`}
                  >
                    <span className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}>
                      Add Client
                    </span>
                    <span className="flex-1" />
                    <div className="flex items-end">
                      <UserPlus className="h-8 w-8 text-black" strokeWidth={1.5} aria-hidden />
                    </div>
                  </Link>
                </div>

                <div className="grid gap-6 lg:h-[430px] lg:grid-rows-2 lg:gap-[10px]">
                  <Link
                    href="/a8k3x/reports"
                    className={`flex h-[210px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[290px] ${CARD_BG_CLASS}`}
                  >
                    <span className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}>
                      Reports
                    </span>
                    <span className="flex-1" />
                    <div className="flex items-end">
                      <FileText className={`h-7 w-7 ${ICON_CLASS}`} strokeWidth={1.5} aria-hidden />
                    </div>
                  </Link>
                  <Link
                    href="/a8k3x/settings"
                    className={`flex h-[210px] w-full flex-col rounded-2xl p-8 shadow-sm transition-shadow hover:shadow-md lg:w-[290px] ${CARD_BG_CLASS}`}
                  >
                    <span className={`text-[30px] font-normal leading-tight ${CARD_TEXT_CLASS}`}>
                      Settings
                    </span>
                    <span className="flex-1" />
                    <div className="flex items-end">
                      <Settings className={`h-7 w-7 ${ICON_CLASS}`} strokeWidth={1.5} aria-hidden />
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
