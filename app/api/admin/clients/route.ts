import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenants, tenantUsers } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySignedSession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      slug: tenants.slug,
      apiKey: tenants.apiKey,
      logoUrl: tenants.logoUrl,
      createdAt: tenants.createdAt,
    })
    .from(tenants)
    .orderBy(tenants.createdAt);

  return NextResponse.json({
    clients: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      api_key: r.apiKey,
      logo_url: r.logoUrl,
      created_at: r.createdAt.toISOString(),
    })),
  });
}

function parsePostBody(data: unknown): {
  name: string;
  email: string;
  password: string;
  logoUrl: string | null;
} | null {
  if (data === null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const email = typeof o.email === "string" ? o.email.trim().toLowerCase() : "";
  const password = typeof o.password === "string" ? o.password : "";
  if (!name || !email || !password || !email.includes("@")) return null;
  const logoUrl =
    typeof o.logo_url === "string" && o.logo_url.trim()
      ? o.logo_url.trim()
      : typeof o.logoUrl === "string" && o.logoUrl.trim()
        ? o.logoUrl.trim()
        : null;
  return { name, email, password, logoUrl };
}

export async function POST(request: Request) {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySignedSession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parsePostBody(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const slug = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const apiKey = randomBytes(32).toString("base64url");
  const passwordHash = hashPassword(parsed.password);

  const [existingUser] = await db
    .select({ id: tenantUsers.id })
    .from(tenantUsers)
    .where(eq(tenantUsers.email, parsed.email))
    .limit(1);

  if (existingUser) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const [tenantRow] = await db
    .insert(tenants)
    .values({ name: parsed.name, slug, apiKey, logoUrl: parsed.logoUrl })
    .returning({ id: tenants.id });

  if (!tenantRow) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }

  await db.insert(tenantUsers).values({
    tenantId: tenantRow.id,
    email: parsed.email,
    passwordHash,
  });

  return NextResponse.json(
    { client: { id: tenantRow.id, name: parsed.name, slug, api_key: apiKey } },
    { status: 201 },
  );
}
