import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { hashPassword } from "../lib/auth/password";
import * as schema from "../lib/db/schema";
import { tenantUsers, tenants } from "../lib/db/schema";

function loadEnvFile(fileName: string) {
  const envPath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) {
    return;
  }
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const password = process.env.SEED_DEV_PASSWORD ?? "11223344";
const DEFAULT_TENANT_SLUG = process.env.DEFAULT_TENANT_SLUG ?? "default";
const DEFAULT_TENANT_NAME = process.env.DEFAULT_TENANT_NAME ?? "Calar";

const emails = [
  (process.env.SEED_DEV_EMAIL ?? "admin@dev.xyz").trim().toLowerCase(),
  (process.env.SEED_CLIENT_EMAIL ?? "client@dev.xyz").trim().toLowerCase(),
].filter((e, i, a) => e && a.indexOf(e) === i);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Add it to .env.local in calar-os.");
    process.exit(1);
  }

  const db = drizzle(neon(databaseUrl), { schema });

  let [tenantRow] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, DEFAULT_TENANT_SLUG))
    .limit(1);

  if (!tenantRow) {
    const apiKey = randomBytes(32).toString("base64url");
    const [inserted] = await db
      .insert(tenants)
      .values({
        name: DEFAULT_TENANT_NAME,
        slug: DEFAULT_TENANT_SLUG,
        apiKey,
      })
      .returning({ id: tenants.id });
    tenantRow = inserted;
  }

  if (!tenantRow) {
    throw new Error("Failed to resolve tenant");
  }

  const tenantId = tenantRow.id;
  const passwordHash = hashPassword(password);

  for (const email of emails) {
    const [existing] = await db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .where(eq(tenantUsers.email, email))
      .limit(1);

    if (existing) {
      await db
        .update(tenantUsers)
        .set({ passwordHash })
        .where(eq(tenantUsers.id, existing.id));
      console.log(`Updated password for ${email}`);
    } else {
      await db.insert(tenantUsers).values({ tenantId, email, passwordHash });
      console.log(`Created user ${email}`);
    }
  }

  console.log(
    `Done. Sign in at /login (password for all seeded users: ${password}).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
