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
  console.log("[LOGIN] ========== Login request started ==========");
  console.log("[LOGIN] Timestamp:", new Date().toISOString());

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
    console.log("[LOGIN] Invalid body format - parsed result is null");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { email, password } = parsed;
  console.log("[LOGIN] Attempting login for:", email);
  console.log("[LOGIN] Password length:", password.length);

  let row;
  try {
    console.log("[LOGIN] Querying database for user...");
    const result = await db
      .select({
        userId: tenantUsers.id,
        passwordHash: tenantUsers.passwordHash,
        tenantId: tenants.id,
        tenantName: tenants.name,
      })
      .from(tenantUsers)
      .innerJoin(tenants, eq(tenantUsers.tenantId, tenants.id))
      .where(eq(tenantUsers.email, email))
      .limit(1);

    row = result[0];
    console.log("[LOGIN] Database query completed. Found:", row ? "yes" : "no");
    if (row) {
      console.log("[LOGIN] User details - userId:", row.userId, "tenantId:", row.tenantId, "tenant:", row.tenantName);
    }
  } catch (dbError) {
    console.error("[LOGIN] Database error:", dbError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!row) {
    console.log("[LOGIN] User not found in database:", email);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("[LOGIN] User found, verifying password...");
  console.log("[LOGIN] Stored hash length:", row.passwordHash?.length ?? 0);

  const passwordValid = verifyPassword(password, row.passwordHash);
  console.log("[LOGIN] Password verification result:", passwordValid);

  if (!passwordValid) {
    console.log("[LOGIN] Password verification failed for:", email);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  console.log("[LOGIN] Password verified, creating session...");

  const userId = row.userId;
  const tenantId = row.tenantId;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = { userId, tenantId, exp };

  console.log("[LOGIN] Session payload:", { userId, tenantId, exp, expiresAt: new Date(exp * 1000).toISOString() });

  const token = await createSignedSession(payload);
  console.log("[LOGIN] Session token created, length:", token.length);

  const res = NextResponse.json({ userId, tenantId }, { status: 200 });
  const cookieOptions = {
    name: SESSION_COOKIE_NAME,
    value: token,
    ...baseSessionCookieOptions(),
    maxAge: sessionCookieMaxAge(payload),
  };
  console.log("[LOGIN] Setting cookie:", { name: cookieOptions.name, maxAge: cookieOptions.maxAge });
  res.cookies.set(cookieOptions);

  console.log("[LOGIN] ========== Login successful ==========");

  return res;
}
