import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  SESSION_COOKIE_NAME,
  verifySignedSession,
} from "@/lib/auth/session";

/** TEMP: set false to require auth on /dashboard again. */
const DASHBOARD_DEV_BYPASS = false;

const ADMIN_PREFIX = "/a8k3x";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Extensive logging for debugging
  console.log("[MW] =====================================");
  console.log("[MW] Timestamp:", new Date().toISOString());
  console.log("[MW] Method:", request.method);
  console.log("[MW] URL:", request.url);
  console.log("[MW] Pathname:", pathname);
  console.log("[MW] Headers:", JSON.stringify(Object.fromEntries(request.headers.entries())));
  console.log("[MW] Cookies:", request.cookies.getAll().map(c => c.name).join(", ") || "(none)");

  const isDashboard =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  const isAdmin =
    pathname === ADMIN_PREFIX || pathname.startsWith(ADMIN_PREFIX + "/");
  const isLogin = pathname === "/login" || pathname === "/login/";
  const isRegister = pathname === "/register" || pathname === "/register/";

  console.log("[MW] Route checks:", { isDashboard, isAdmin, isLogin, isRegister });

  if (!isDashboard && !isAdmin && !isLogin && !isRegister) {
    console.log("[MW] Decision: NEXT (not a protected route)");
    return NextResponse.next();
  }

  const raw = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await verifySignedSession(raw) : null;
  console.log("[MW] Session:", session ? `userId=${session.userId}` : "null");

  if (isAdmin) {
    if (!session && !DASHBOARD_DEV_BYPASS) {
      console.log("[MW] Decision: REDIRECT to /login (admin, no session)");
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (isDashboard) {
    if (!session && !DASHBOARD_DEV_BYPASS) {
      console.log("[MW] Decision: REDIRECT to /login (dashboard, no session)");
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (isLogin || isRegister) {
    if (session) {
      console.log("[MW] Decision: REDIRECT to /dashboard (login/register, has session)");
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  console.log("[MW] Decision: NEXT (passed all checks)");
  return NextResponse.next();
}

/** Never run middleware on static assets or API routes (avoids broken CSS/JS). */
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
