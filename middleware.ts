import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  SESSION_COOKIE_NAME,
  verifySignedSession,
} from "@/lib/auth/session";

/** TEMP: set false to require auth on /dashboard again. */
const DASHBOARD_DEV_BYPASS = true;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isLogin = pathname === "/login" || pathname === "/login/";
  const isRegister = pathname === "/register" || pathname === "/register/";

  if (!isDashboard && !isLogin && !isRegister) {
    return NextResponse.next();
  }

  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await verifySignedSession(raw) : null;

  if (isDashboard) {
    if (!session && !DASHBOARD_DEV_BYPASS) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (isLogin || isRegister) {
    if (session) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

/** Never run middleware on static assets or API routes (avoids broken CSS/JS). */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
