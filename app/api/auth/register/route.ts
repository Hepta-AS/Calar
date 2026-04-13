import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
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

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const e = error as { code?: string; cause?: unknown };
  if (e.code === "23505") {
    return true;
  }
  return isUniqueViolation(e.cause);
}

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
  const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "default";
  const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? "Calar";

  const apiKey = randomBytes(32).toString("base64url");
  const passwordHash = hashPassword(password);

  let tenantId: string;
  let userId: string;

  try {
    const [existingTenant] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, DEFAULT_TENANT_SLUG))
      .limit(1);

    if (existingTenant) {
      tenantId = existingTenant.id;
    } else {
      const [tenantRow] = await db
        .insert(tenants)
        .values({
          name: DEFAULT_TENANT_NAME,
          slug: DEFAULT_TENANT_SLUG,
          apiKey,
        })
        .returning({ id: tenants.id });

      if (!tenantRow) {
        return NextResponse.json({ error: "Create failed" }, { status: 500 });
      }

      tenantId = tenantRow.id;
    }

    const [existingUser] = await db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(eq(tenantUsers.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    const [userRow] = await db
      .insert(tenantUsers)
      .values({
        tenantId,
        email,
        passwordHash,
      })
      .returning({ id: tenantUsers.id });

    if (!userRow) {
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    userId = userRow.id;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }
    throw error;
  }

  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = { userId, tenantId, exp };
  const token = await createSignedSession(payload);

  const res = NextResponse.json({ userId, tenantId }, { status: 201 });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...baseSessionCookieOptions(),
    maxAge: sessionCookieMaxAge(payload),
  });

  return res;
}
