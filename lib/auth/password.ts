import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH);
  return Buffer.concat([salt, key]).toString("base64");
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const combined = Buffer.from(stored, "base64");
    if (combined.length < SALT_LENGTH + 1) {
      return false;
    }
    const salt = combined.subarray(0, SALT_LENGTH);
    const expected = combined.subarray(SALT_LENGTH);
    const key = scryptSync(password, salt, KEY_LENGTH);
    if (key.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}
