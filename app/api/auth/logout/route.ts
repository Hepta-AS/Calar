import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  baseSessionCookieOptions,
} from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const loginUrl = new URL("/login", request.url);
  const res = NextResponse.redirect(loginUrl, 303);
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...baseSessionCookieOptions(),
    maxAge: 0,
  });
  return res;
}
