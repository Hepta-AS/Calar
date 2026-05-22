import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

import { hashPassword } from "@/lib/auth/password";
import { db } from "@/lib/db";
import { tenants, tenantUsers } from "@/lib/db/schema";

export const runtime = "nodejs";

// Secret key to prevent unauthorized bootstrap - set in env
const BOOTSTRAP_SECRET = process.env.BOOTSTRAP_SECRET || "change-me-in-production";

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

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify bootstrap secret
  const secret = body.secret;
  if (secret !== BOOTSTRAP_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  const tenantName = typeof body.tenant_name === "string" ? body.tenant_name.trim() : "";
  const userEmail = typeof body.user_email === "string" ? body.user_email.trim().toLowerCase() : "";
  const userPassword = typeof body.user_password === "string" ? body.user_password : "";
  const userName = typeof body.user_name === "string" ? body.user_name.trim() : null;

  if (!tenantName || !userEmail || !userPassword) {
    return NextResponse.json(
      { error: "Required: tenant_name, user_email, user_password" },
      { status: 400 }
    );
  }

  if (!userEmail.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  if (userPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  // Check if email already exists
  const [existingUser] = await db
    .select({ id: tenantUsers.id })
    .from(tenantUsers)
    .where(eq(tenantUsers.email, userEmail))
    .limit(1);

  if (existingUser) {
    return NextResponse.json(
      { error: "User with this email already exists" },
      { status: 409 }
    );
  }

  // Generate unique slug
  const baseSlug = generateSlug(tenantName);
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

  // Generate API key
  const apiKey = generateApiKey();

  // Create tenant
  const [newTenant] = await db
    .insert(tenants)
    .values({
      name: tenantName,
      slug,
      apiKey,
      isActive: true,
    })
    .returning({ id: tenants.id });

  // Create admin user
  const passwordHash = hashPassword(userPassword);

  const [newUser] = await db
    .insert(tenantUsers)
    .values({
      tenantId: newTenant.id,
      email: userEmail,
      displayName: userName,
      passwordHash,
      isAdmin: true,
    })
    .returning({ id: tenantUsers.id });

  // Generate script snippet
  const endpoint = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://calar-bjum.vercel.app";

  const scriptSnippet = `<script
  data-api-key="${apiKey}"
  data-endpoint="${endpoint}"
  src="${endpoint}/tracker.js">
</script>`;

  console.log("[BOOTSTRAP] Created tenant:", tenantName, "slug:", slug);
  console.log("[BOOTSTRAP] Created user:", userEmail);

  return NextResponse.json({
    success: true,
    tenant: {
      id: newTenant.id,
      name: tenantName,
      slug,
    },
    user: {
      id: newUser.id,
      email: userEmail,
    },
    api_key: apiKey,
    script_snippet: scriptSnippet,
  }, { status: 201 });
}
