"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardHeader } from "@/components/DashboardHeader";

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";

type Client = {
  id: string;
  name: string;
  slug: string;
  api_key: string;
  logo_url: string | null;
  created_at: string;
};

const STATIC_CLIENTS: Client[] = [
  { id: "s1", name: "Mowi", slug: "mowi", api_key: "Calaros********************", logo_url: null, created_at: "2026-04-02T00:00:00Z" },
  { id: "s2", name: "Artec Aqua", slug: "artec-aqua", api_key: "Calaros********************", logo_url: null, created_at: "2026-04-02T00:00:00Z" },
  { id: "s3", name: "Tine", slug: "tine", api_key: "Calaros********************", logo_url: null, created_at: "2026-04-02T00:00:00Z" },
  { id: "s4", name: "Telenor", slug: "telenor", api_key: "Calaros********************", logo_url: null, created_at: "2026-04-02T00:00:00Z" },
];

function maskKey(key: string): string {
  if (key.length <= 10) return key;
  return key.slice(0, 7) + "********************";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function ClientCard({
  client,
  onImpersonate,
}: {
  client: Client;
  onImpersonate: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyKey() {
    navigator.clipboard.writeText(client.api_key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className={`relative flex flex-col rounded-2xl p-6 shadow-sm ${CARD_BG_CLASS}`}>
      <button
        type="button"
        className="absolute left-4 top-4 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 text-neutral-400 transition hover:bg-neutral-300 hover:text-neutral-700"
        aria-label="Remove client"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
      <span className="absolute right-4 top-4 rounded-full bg-green-400 px-3 py-0.5 text-[11px] font-medium text-green-950">
        Active
      </span>

      <div className="mt-6 flex items-center gap-3">
        {client.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={client.logo_url} alt="" className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-bold uppercase text-white">
            {client.name.slice(0, 2)}
          </div>
        )}
        <span className={`text-[20px] font-normal ${HERO_TEXT_CLASS}`}>{client.name}</span>
      </div>

      <p className="mt-6 text-[13px] text-neutral-500">
        Date added: {formatDate(client.created_at)}
      </p>

      <p className="mt-4 text-[13px] font-medium text-neutral-700">CalarOS SDK</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-neutral-200 px-3 py-1 text-[12px] font-medium text-neutral-700">
          {maskKey(client.api_key)}
        </span>
        <button
          type="button"
          onClick={copyKey}
          className="text-neutral-400 transition hover:text-neutral-700"
          aria-label="Copy SDK key"
        >
          {copied ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={() => onImpersonate(client.id)}
        className="mt-4 text-left text-[13px] font-medium text-neutral-600 transition hover:text-neutral-900"
      >
        View dashboard
      </button>
    </div>
  );
}

export default function AdminClientsPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>(STATIC_CLIENTS);
  const [, setLoaded] = useState(false);

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/clients", { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { clients: Client[] };
        if (data.clients.length > 0) {
          setClients(data.clients);
        }
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  async function handleImpersonate(tenantId: string) {
    await fetch("/api/admin/impersonate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tenantId }),
    });
    router.push("/dashboard");
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
                  These are your existing clients
                </p>
              </div>

              <section className="mt-16 w-full">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:gap-[10px]">
                  {clients.map((c) => (
                    <ClientCard
                      key={c.id}
                      client={c}
                      onImpersonate={handleImpersonate}
                    />
                  ))}
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
