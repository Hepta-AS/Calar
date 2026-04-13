import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { leads, tenants } from "@/lib/db/schema";

export const runtime = "nodejs";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function optionalString(v: unknown): string | null {
  if (v === undefined || v === null) {
    return null;
  }
  if (typeof v !== "string") {
    return null;
  }
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function requiredString(v: unknown): string | null {
  if (typeof v !== "string") {
    return null;
  }
  const t = v.trim();
  return t.length === 0 ? null : t;
}

function parseBody(data: unknown): {
  apiKey: string;
  visitorId: string;
  email: string;
  name: string | null;
  company: string | null;
} | null {
  if (data === null || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  const apiKey = requiredString(o.api_key);
  const visitorId = requiredString(o.visitor_id);
  const emailRaw = requiredString(o.email);
  if (!apiKey || !visitorId || !emailRaw) {
    return null;
  }
  if (!emailRaw.includes("@")) {
    return null;
  }
  const email = emailRaw.toLowerCase();
  return {
    apiKey,
    visitorId,
    email,
    name: optionalString(o.name),
    company: optionalString(o.company),
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders },
    );
  }

  const parsed = parseBody(body);
  if (!parsed) {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400, headers: corsHeaders },
    );
  }

  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.apiKey, parsed.apiKey))
    .limit(1);

  if (!tenant) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: corsHeaders },
    );
  }

  await db.insert(leads).values({
    tenantId: tenant.id,
    visitorId: parsed.visitorId,
    email: parsed.email,
    name: parsed.name,
    company: parsed.company,
  });

  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
