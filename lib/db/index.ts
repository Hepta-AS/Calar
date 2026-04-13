import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

type Db = NeonHttpDatabase<typeof schema>;

let _db: Db | undefined;

function getDb(): Db {
  if (!_db) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    _db = drizzle(neon(databaseUrl), { schema });
  }
  return _db;
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    if (typeof value === "function") {
      return value.bind(real);
    }
    return value;
  },
});
