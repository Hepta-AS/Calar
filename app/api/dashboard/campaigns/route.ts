import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";

export const runtime = "nodejs";

function optionalText(o: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    if (typeof o[k] === "string" && o[k].trim().length > 0) {
      return (o[k] as string).trim();
    }
  }
  return null;
}

function parsePostBody(data: unknown): {
  name: string;
  imageUrl: string | null;
  utmLink: string | null;
  spendingPerMonth: string | null;
} | null {
  if (data === null || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.name !== "string") {
    return null;
  }
  const name = o.name.trim();
  if (!name) {
    return null;
  }
  return {
    name,
    imageUrl: optionalText(o, "image_url", "imageUrl"),
    utmLink: optionalText(o, "utm_link", "utmLink"),
    spendingPerMonth: optionalText(o, "spending_per_month", "spendingPerMonth"),
  };
}

function parsePatchBody(data: unknown): {
  id: string;
  name?: string;
  imageUrl?: string | null;
  utmLink?: string | null;
  spendingPerMonth?: string | null;
} | null {
  if (data === null || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id.trim()) {
    return null;
  }
  const result: {
    id: string;
    name?: string;
    imageUrl?: string | null;
    utmLink?: string | null;
    spendingPerMonth?: string | null;
  } = { id: o.id.trim() };
  if (typeof o.name === "string" && o.name.trim()) {
    result.name = o.name.trim();
  }
  if ("image_url" in o || "imageUrl" in o) {
    result.imageUrl = optionalText(o, "image_url", "imageUrl");
  }
  if ("utm_link" in o || "utmLink" in o) {
    result.utmLink = optionalText(o, "utm_link", "utmLink");
  }
  if ("spending_per_month" in o || "spendingPerMonth" in o) {
    result.spendingPerMonth = optionalText(o, "spending_per_month", "spendingPerMonth");
  }
  return result;
}

function campaignJson(r: {
  id: string;
  name: string;
  imageUrl: string | null;
  utmLink: string | null;
  spendingPerMonth: string | null;
  createdAt: Date;
}) {
  return {
    id: r.id,
    name: r.name,
    image_url: r.imageUrl,
    utm_link: r.utmLink,
    spending_per_month: r.spendingPerMonth,
    created_at: r.createdAt.toISOString(),
  };
}

const SELECT_FIELDS = {
  id: campaigns.id,
  name: campaigns.name,
  imageUrl: campaigns.imageUrl,
  utmLink: campaigns.utmLink,
  spendingPerMonth: campaigns.spendingPerMonth,
  createdAt: campaigns.createdAt,
} as const;

export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySignedSession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select(SELECT_FIELDS)
    .from(campaigns)
    .where(eq(campaigns.tenantId, session.tenantId))
    .orderBy(campaigns.createdAt);

  return NextResponse.json({
    campaigns: rows.map(campaignJson),
  });
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

  const [row] = await db
    .insert(campaigns)
    .values({
      tenantId: session.tenantId,
      name: parsed.name,
      imageUrl: parsed.imageUrl,
      utmLink: parsed.utmLink,
      spendingPerMonth: parsed.spendingPerMonth,
    })
    .returning(SELECT_FIELDS);

  if (!row) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }

  return NextResponse.json({ campaign: campaignJson(row) }, { status: 201 });
}

export async function PATCH(request: Request) {
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

  const parsed = parsePatchBody(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (parsed.name !== undefined) updates.name = parsed.name;
  if (parsed.imageUrl !== undefined) updates.imageUrl = parsed.imageUrl;
  if (parsed.utmLink !== undefined) updates.utmLink = parsed.utmLink;
  if (parsed.spendingPerMonth !== undefined) updates.spendingPerMonth = parsed.spendingPerMonth;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const [row] = await db
    .update(campaigns)
    .set(updates)
    .where(
      and(
        eq(campaigns.id, parsed.id),
        eq(campaigns.tenantId, session.tenantId),
      ),
    )
    .returning(SELECT_FIELDS);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ campaign: campaignJson(row) });
}
