import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseBody(data: unknown): { email: string } | null {
  if (data === null || typeof data !== "object") {
    return null;
  }
  const o = data as Record<string, unknown>;
  if (typeof o.email !== "string") {
    return null;
  }
  const email = o.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return null;
  }
  return { email };
}

export async function POST(request: Request) {
  // Only allow this when no DB is configured (frontend-only dev mode).
  if (process.env.DATABASE_URL) {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

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

  const res = NextResponse.json({ ok: true }, { status: 200 });
  // Non-httpOnly so client can set/overwrite too if needed.
  res.cookies.set({
    name: "dev_email",
    value: parsed.email,
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

