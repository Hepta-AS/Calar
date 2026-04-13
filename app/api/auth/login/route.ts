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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { email, password } = parsed;

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

  if (!row || !verifyPassword(password, row.passwordHash)) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const userId = row.userId;
  const tenantId = row.tenantId;
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = { userId, tenantId, exp };
  const token = await createSignedSession(payload);

  const res = NextResponse.json({ userId, tenantId }, { status: 200 });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...baseSessionCookieOptions(),
    maxAge: sessionCookieMaxAge(payload),
  });

  return res;
}
