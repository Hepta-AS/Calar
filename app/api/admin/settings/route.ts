import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { hashPassword } from "@/lib/auth/password";
import { SESSION_COOKIE_NAME, verifySignedSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { tenantUsers } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function GET() {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySignedSession(token) : null;
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [user] = await db
    .select({
      email: tenantUsers.email,
      smtpEmail: tenantUsers.smtpEmail,
      reportNotifyEmail: tenantUsers.reportNotifyEmail,
    })
    .from(tenantUsers)
    .where(
      and(
        eq(tenantUsers.id, session.userId),
        eq(tenantUsers.tenantId, session.tenantId),
      ),
    )
    .limit(1);

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    email: user.email,
    smtp_email: user.smtpEmail,
    report_notify_email: user.reportNotifyEmail,
  });
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

  const o = body as Record<string, unknown>;
  const updates: Record<string, unknown> = {};

  if (typeof o.email === "string" && o.email.trim() && o.email.includes("@")) {
    updates.email = o.email.trim().toLowerCase();
  }
  if (typeof o.password === "string" && o.password.length >= 6) {
    updates.passwordHash = hashPassword(o.password);
  }
  if ("smtp_email" in o) {
    updates.smtpEmail =
      typeof o.smtp_email === "string" && o.smtp_email.trim()
        ? o.smtp_email.trim()
        : null;
  }
  if ("report_notify_email" in o) {
    updates.reportNotifyEmail =
      typeof o.report_notify_email === "string" && o.report_notify_email.trim()
        ? o.report_notify_email.trim()
        : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  await db
    .update(tenantUsers)
    .set(updates)
    .where(
      and(
        eq(tenantUsers.id, session.userId),
        eq(tenantUsers.tenantId, session.tenantId),
      ),
    );

  return NextResponse.json({ ok: true });
}
