import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  baseSessionCookieOptions,
  createSignedSession,
  sessionCookieMaxAge,
} from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenantUsers, tenants } from "@/lib/db/schema";

export const runtime = "nodejs";

function parseBody(data: unknown): {
  email: string;
  password: string;
} | null {
  if (data === null || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (
    typeof o.email !== "string" ||
    typeof o.password !== "string"
  ) {
    return null;
  }
  const email = o.email.trim().toLowerCase();
  const password = o.password;
  if (!email || !password) {
    return null;
  }
  if (!email.includes("@")) {
    return null;
  }
  return { email, password };
}

export async function POST(request: Request) {
  console.log("[LOGIN] Request received");

  let body: unknown;
  try {
    body = await request.json();
    console.log("[LOGIN] Body parsed:", { email: (body as Record<string, unknown>)?.email });
  } catch (e) {
    console.log("[LOGIN] Invalid JSON:", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    console.log("[LOGIN] Invalid body format");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { email, password } = parsed;
  console.log("[LOGIN] Attempting login for:", email);

  const [row] = await db
    .select({
      userId: tenantUsers.id,
      passwordHash: tenantUsers.passwordHash,
      tenantId: tenants.id,
    })
    .from(tenantUsers)
    .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
    .where(eq(tenantUsers.email, email))
    .limit(1);

  if (!row) {
    console.log("[LOGIN] User not found:", email);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("[LOGIN] User found, verifying password...");

  if (!verifyPassword(password, row.passwordHash)) {
    console.log("[LOGIN] Password verification failed for:", email);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("[LOGIN] Password verified, creating session...");

  const userId = row.userId;
  const tenantId = row.tenantId;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = { userId, tenantId, exp };
  const token = await createSignedSession(payload);

  console.log("[LOGIN] Session created for user:", userId, "tenant:", tenantId);

  const res = NextResponse.json({ userId, tenantId }, { status: 200 });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...baseSessionCookieOptions(),
    maxAge: sessionCookieMaxAge(payload),
  });

  console.log("[LOGIN] Success! Cookie set, returning response");

  return res;
}
