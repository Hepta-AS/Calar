"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";

export default function AddClientPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogo(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleConfirm() {
    if (!name.trim() || !email.trim() || !password) {
      setError("All fields are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          logo_url: logo,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Create failed");
        return;
      }
      router.push("/a8k3x/clients");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
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
                  Add new clients here.
                </p>
              </div>

              <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-3 lg:gap-[10px]">
                <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
                  <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>Upload photo</span>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-4 flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-200/80 text-neutral-600 transition hover:bg-neutral-300/80"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt="Preview" className="mt-3 h-12 w-12 rounded-full object-cover" />
                  )}
                </div>

                <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
                  <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>Login details</span>
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
                  </div>
                </div>

                <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
                  <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>Create new client</span>
                  <span className="flex-1" />
                  {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={saving}
                    className="mt-4 flex items-center gap-2 text-[15px] font-medium text-neutral-700 transition hover:text-neutral-900 disabled:opacity-50"
                  >
                    {saving ? "Creating..." : "Confirm"}
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" /><polyline points="12 5 19 12 12 19" />
                    </svg>
                  </button>
                </div>

                <div className={`flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
                  <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>Name of client</span>
                  <span className="flex-1" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="mt-4 border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
