"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

import { AuthSplitLayout } from "@/components/AuthSplitLayout";

export default function RegisterPage() {
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
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? "Registration failed");
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
      title="Get started fast."
      subtitle="Create your account in seconds. Start capturing visits and leads right away."
      footer={
        <p>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-neutral-900">
            Sign in
          </Link>
        </p>
      }
    >
      <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
        Create your account
      </h2>
      <p className="mt-2 text-sm text-neutral-600">
        Email and password is all you need.
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
            autoComplete="new-password"
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
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
    </AuthSplitLayout>
  );
}
