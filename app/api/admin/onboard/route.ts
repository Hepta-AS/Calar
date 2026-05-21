import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { verifySignedSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { tenants, tenantUsers } from "@/lib/db/schema";

export const runtime = "nodejs";

function generateApiKey(): string {
  const bytes = randomBytes(27);
  return "ht_" + bytes.toString("base64").replace(/[+/=]/g, "");
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32);
}

interface OnboardBody {
  tenant_name: string;
  user_email: string;
  user_password: string;
  user_name?: string;
}

function parseBody(data: unknown): OnboardBody | null {
  if (data === null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;

  const tenantName = typeof o.tenant_name === "string" ? o.tenant_name.trim() : "";
  const userEmail = typeof o.user_email === "string" ? o.user_email.trim().toLowerCase() : "";
  const userPassword = typeof o.user_password === "string" ? o.user_password : "";
  const userName = typeof o.user_name === "string" ? o.user_name.trim() : undefined;

  if (!tenantName || !userEmail || !userPassword) return null;
  if (!userEmail.includes("@")) return null;
  if (userPassword.length < 8) return null;

  return {
    tenant_name: tenantName,
    user_email: userEmail,
    user_password: userPassword,
    user_name: userName,
  };
}

export async function POST(request: Request) {
  // Authenticate - must be logged in as admin
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await verifySignedSession(sessionCookie.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const [currentUser] = await db
    .select({ isAdmin: tenantUsers.isAdmin })
    .from(tenantUsers)
    .where(eq(tenantUsers.id, session.userId))
    .limit(1);

  if (!currentUser?.isAdmin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid body. Required: tenant_name, user_email, user_password (min 8 chars)" },
      { status: 400 }
    );
  }

  // Check if tenant slug already exists
  const baseSlug = generateSlug(parsed.tenant_name);
  let slug = baseSlug;
  let suffix = 1;

  while (true) {
    const [existing] = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, slug))
      .limit(1);

    if (!existing) break;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  // Check if email already exists
  const [existingUser] = await db
    .select({ id: tenantUsers.id })
    .from(tenantUsers)
    .where(eq(tenantUsers.email, parsed.user_email))
    .limit(1);

  if (existingUser) {
    return NextResponse.json(
      { error: "User with this email already exists" },
      { status: 409 }
    );
  }

  // Generate API key
  const apiKey = generateApiKey();

  // Create tenant
  const [newTenant] = await db
    .insert(tenants)
    .values({
      name: parsed.tenant_name,
      slug,
      apiKey,
      isActive: true,
    })
    .returning({ id: tenants.id });

  // Create user
  const passwordHash = hashPassword(parsed.user_password);

  const [newUser] = await db
    .insert(tenantUsers)
    .values({
      tenantId: newTenant.id,
      email: parsed.user_email,
      displayName: parsed.user_name || null,
      passwordHash,
      isAdmin: true,
    })
    .returning({ id: tenantUsers.id });

  // Generate script snippet
  const endpoint = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://calar.vercel.app";

  const scriptSnippet = `<script
  data-api-key="${apiKey}"
  data-endpoint="${endpoint}"
  src="${endpoint}/tracker.js">
</script>`;

  return NextResponse.json({
    success: true,
    tenant: {
      id: newTenant.id,
      name: parsed.tenant_name,
      slug,
    },
    user: {
      id: newUser.id,
      email: parsed.user_email,
    },
    api_key: apiKey,
    script_snippet: scriptSnippet,
  }, { status: 201 });
}
