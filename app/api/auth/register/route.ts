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
  console.log("[REGISTER] Request received");

  let body: unknown;
  try {
    body = await request.json();
    console.log("[REGISTER] Body parsed:", { email: (body as Record<string, unknown>)?.email });
  } catch (e) {
    console.log("[REGISTER] Invalid JSON:", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    console.log("[REGISTER] Invalid body format");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { email, password } = parsed;
  console.log("[REGISTER] Attempting registration for:", email);

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
      console.log("[REGISTER] Using existing tenant:", existingTenant.id);
      tenantId = existingTenant.id;
    } else {
      console.log("[REGISTER] Creating new tenant:", DEFAULT_TENANT_SLUG);
      const [tenantRow] = await db
        .insert(tenants)
        .values({
          name: DEFAULT_TENANT_NAME,
          slug: DEFAULT_TENANT_SLUG,
          apiKey,
        })
        .returning({ id: tenants.id });

      if (!tenantRow) {
        console.log("[REGISTER] Failed to create tenant");
        return NextResponse.json({ error: "Create failed" }, { status: 500 });
      }

      console.log("[REGISTER] Tenant created:", tenantRow.id);
      tenantId = tenantRow.id;
    }

    const [existingUser] = await db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(eq(tenantUsers.email, email))
      .limit(1);

    if (existingUser) {
      console.log("[REGISTER] Email already exists:", email);
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }

    console.log("[REGISTER] Creating user...");
    const [userRow] = await db
      .insert(tenantUsers)
      .values({
        tenantId,
        email,
        passwordHash,
      })
      .returning({ id: tenantUsers.id });

    if (!userRow) {
      console.log("[REGISTER] Failed to create user");
      return NextResponse.json({ error: "Create failed" }, { status: 500 });
    }

    console.log("[REGISTER] User created:", userRow.id);
    userId = userRow.id;
  } catch (error) {
    console.log("[REGISTER] Database error:", error);
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 },
      );
    }
    throw error;
  }

  console.log("[REGISTER] Creating session...");
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = { userId, tenantId, exp };
  const token = await createSignedSession(payload);

  console.log("[REGISTER] Success! User:", userId, "Tenant:", tenantId);

  const res = NextResponse.json({ userId, tenantId }, { status: 201 });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...baseSessionCookieOptions(),
    maxAge: sessionCookieMaxAge(payload),
  });

  return res;
}
