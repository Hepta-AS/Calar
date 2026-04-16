"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value
      .trim()
      .toLowerCase();
    const password = (form.elements.namedItem("password") as HTMLInputElement)
      .value;

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        // If there's no DB configured, allow a frontend-only bypass so you can work
        // on the dashboard UI without provisioning infra.
        const bypass = await fetch("/api/dev/bypass-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email }),
        });
        if (bypass.ok) {
          router.push("/dashboard");
          router.refresh();
          return;
        }

        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Sign in failed");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthSplitLayout
      title={
        <>
          <span className="font-mono text-[0.85em] tracking-[0.08em] whitespace-nowrap">
            Calar Operating System
          </span>
        </>
      }
      subtitle="Your client operating system for lead tracking, attribution, and campaign clarity."
    >
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Sign in
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Use your email and password.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-neutral-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="input-underline"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-neutral-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="input-underline"
          />
        </div>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-water disabled:opacity-50"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
