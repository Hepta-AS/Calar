"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DashboardHeader } from "@/components/DashboardHeader";

const DASH_BG_CLASS = "bg-[#F6F6F6]";
const CARD_BG_CLASS = "bg-[#EFEFEF]";
const HERO_TEXT_CLASS = "text-[#363636]";

type Campaign = {
  id: string;
  name: string;
  image_url: string | null;
  cover_file_id: string | null;
  utm_link: string | null;
  spending_per_month: string | null;
};

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const campaignId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<string | null>(null);
  const [coverFileId, setCoverFileId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [spending, setSpending] = useState("");
  const [utmLink, setUtmLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCampaign = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/campaigns", {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { campaigns: Campaign[] };
      const c = data.campaigns.find((x) => x.id === campaignId);
      if (c) {
        setName(c.name);
        setUtmLink(c.utm_link ?? "");
        setSpending(c.spending_per_month ?? "");
        setCoverFileId(c.cover_file_id);

        // If there's a cover file, get the signed URL
        if (c.cover_file_id) {
          const urlRes = await fetch(`/api/v1/files/${c.cover_file_id}/url`, {
            credentials: "include",
          });
          if (urlRes.ok) {
            const urlData = (await urlRes.json()) as { url: string };
            setPreview(urlData.url);
          }
        } else if (c.image_url) {
          // Fallback to legacy image_url
          setPreview(c.image_url);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    loadCampaign();
  }, [loadCampaign]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    // Upload to R2
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", "campaign-cover");
      formData.append("campaign_id", campaignId);

      const res = await fetch("/api/v1/files/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Upload failed");
        return;
      }

      const data = (await res.json()) as { file: { id: string } };
      setCoverFileId(data.file.id);
    } catch {
      setError("Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (uploading) {
      setError("Please wait for image upload to complete");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: campaignId,
          name: name.trim(),
          utm_link: utmLink.trim() || null,
          spending_per_month: spending.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Save failed");
        return;
      }
      router.push("/dashboard/campaigns");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Er du sikker på at du vil slette denne kampanjen?")) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/campaigns", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: campaignId }),
      });
      if (!res.ok && res.status !== 204) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Delete failed");
        return;
      }
      router.push("/dashboard/campaigns");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div
        className={`flex min-h-screen items-center justify-center ${DASH_BG_CLASS} font-sans text-neutral-500 antialiased`}
      >
        Loading...
      </div>
    );
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
                  Edit your campaign here.
                </p>
              </div>

              <section className="mt-16 w-full">
                <div
                  className={`flex flex-col gap-8 rounded-2xl p-8 shadow-sm sm:flex-row sm:gap-12 ${CARD_BG_CLASS}`}
                >
                  <div className="flex shrink-0 flex-col gap-2 sm:w-[360px]">
                    <span
                      className={`text-[13px] font-medium ${HERO_TEXT_CLASS}`}
                    >
                      Preview
                    </span>
                    <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-neutral-300/50 bg-white">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="h-full w-full"
                          style={{
                            backgroundImage:
                              "repeating-conic-gradient(#e5e5e5 0% 25%, transparent 0% 50%)",
                            backgroundSize: "20px 20px",
                          }}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-col gap-6">
                    <div>
                      <span
                        className={`text-[13px] font-medium ${HERO_TEXT_CLASS}`}
                      >
                        Upload Image {uploading && <span className="text-neutral-500">(laster opp...)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="mt-1 flex h-10 w-16 items-center justify-center rounded-lg bg-neutral-200/80 text-neutral-600 transition hover:bg-neutral-300/80 disabled:opacity-50"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFile}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className={`text-[13px] font-medium ${HERO_TEXT_CLASS}`}
                      >
                        Name of Campaign
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter name here"
                        className="border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className={`text-[13px] font-medium ${HERO_TEXT_CLASS}`}
                      >
                        Spending each month
                      </label>
                      <input
                        type="text"
                        value={spending}
                        onChange={(e) => setSpending(e.target.value)}
                        placeholder="Enter spending here"
                        className="border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label
                        className={`text-[13px] font-medium ${HERO_TEXT_CLASS}`}
                      >
                        Utm link
                      </label>
                      <input
                        type="text"
                        value={utmLink}
                        onChange={(e) => setUtmLink(e.target.value)}
                        placeholder="Paste link here"
                        className="border-b border-neutral-300 bg-transparent py-1.5 text-[14px] text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-neutral-500"
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-red-600">{error}</p>
                    )}

                    <div className="mt-2 flex gap-3">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || deleting || uploading}
                        className="w-max rounded-md bg-neutral-900 px-5 py-2 text-[13px] font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={saving || deleting || uploading}
                        className="w-max rounded-md bg-red-600 px-5 py-2 text-[13px] font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                      >
                        {deleting ? "Sletter..." : "Slett"}
                      </button>
                    </div>
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
