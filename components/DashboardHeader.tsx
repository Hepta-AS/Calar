"use client";

import Link from "next/link";
import { useState } from "react";

export function DashboardHeader({
  showHome,
  homeHref = "/dashboard",
}: {
  showHome?: boolean;
  homeHref?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative">
      {showHome && (
        <Link
          href={homeHref}
          className="absolute -left-10 top-1/2 -translate-y-1/2 flex items-center text-neutral-400 transition hover:text-neutral-700"
          aria-label="Back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </Link>
      )}
      <div className="inline-flex items-center">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Account menu"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-neutral-500 transition hover:text-neutral-800"
          >
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>
        <div
          style={{
            maxWidth: open ? 120 : 0,
            opacity: open ? 1 : 0,
            transition: "max-width 400ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease",
          }}
          className="overflow-hidden"
        >
          <form action="/api/auth/logout" method="post" className="ml-3">
            <button
              type="submit"
              className="whitespace-nowrap text-[13px] font-medium text-neutral-500 transition-colors duration-200 hover:text-neutral-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
