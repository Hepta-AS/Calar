"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";

export default function AdminSettingsPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [reportEmail, setReportEmail] = useState("");
  const [smtpEmail, setSmtpEmail] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as {
          email: string;
          smtp_email: string | null;
          report_notify_email: string | null;
        };
        setEmail(data.email);
        setSmtpEmail(data.smtp_email ?? "");
        setReportEmail(data.report_notify_email ?? "");
      }
    } catch { /* bypass mode */ }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(fields: Record<string, string>, section: string) {
    setSaving(section);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        setMsg(`${section} saved`);
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(data.error ?? "Save failed");
      }
    } catch {
      setMsg("Something went wrong");
    } finally {
      setSaving(null);
    }
  }

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
                  Edit your own profile here
                </p>
              </div>

              {msg && (
                <p className="mt-4 text-sm text-neutral-600">{msg}</p>
              )}

              <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3 lg:gap-[10px]">
                <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
                  <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>Login</span>
                  <span className="flex-1" />
                  <div className="mt-4 flex flex-col gap-4">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email"
                      className="border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      className="border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={() => save({ email, ...(password ? { password } : {}) }, "Login")}
                      disabled={saving === "Login"}
                      className="mt-2 w-max rounded-md bg-neutral-900 px-5 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {saving === "Login" ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
                  <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>reports email</span>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Which email gets notified when something breaks or a report fails to send
                  </p>
                  <span className="flex-1" />
                  <div className="mt-4 flex flex-col gap-4">
                    <input
                      type="email"
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="Email"
                      className="border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={() => save({ report_notify_email: reportEmail }, "Report")}
                      disabled={saving === "Report"}
                      className="mt-2 w-max rounded-md bg-neutral-900 px-5 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {saving === "Report" ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>

                <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
                  <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>SMTP</span>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    The email address reports are sent from
                  </p>
                  <div className="mt-4 flex flex-col gap-4">
                    <input
                      type="email"
                      value={smtpEmail}
                      onChange={(e) => setSmtpEmail(e.target.value)}
                      placeholder="Email"
                      className="border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                    />
                    <button
                      type="button"
                      onClick={() => save({ smtp_email: smtpEmail }, "SMTP")}
                      disabled={saving === "SMTP"}
                      className="mt-2 w-max rounded-md bg-neutral-900 px-5 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {saving === "SMTP" ? "Saving..." : "Save"}
                    </button>
                  </div>
                  <div className="mt-6 aspect-[4/3] w-full overflow-hidden rounded-lg bg-neutral-300">
                    <div className="flex h-full w-full items-center justify-center text-[40px] font-bold text-neutral-500/50">
                      A
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
