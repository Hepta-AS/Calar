export const SESSION_COOKIE_NAME = "session";

/** Session lifetime in seconds (used when issuing cookies). */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  tenantId: string;
  /** Unix timestamp (seconds) when the session expires. */
  exp: number;
};

function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return new Uint8Array(buf);
}

function timingSafeEqualUint8(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

/**
 * HMAC-SHA256 over the base64url-encoded JSON payload.
 * Format: `<payloadBase64url>.<sigBase64url>` where sig is raw HMAC digest, base64url-encoded.
 * Uses Web Crypto so the same logic runs in Node (Route Handlers) and Edge (middleware).
 */
export async function createSignedSession(
  payload: SessionPayload,
): Promise<string> {
  const secret = requireSessionSecret();
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");
  const sigBytes = await hmacSha256(secret, payloadB64);
  const sigB64 = Buffer.from(sigBytes).toString("base64url");
  return `${payloadB64}.${sigB64}`;
}

function isPayload(v: unknown): v is SessionPayload {
  if (v === null || typeof v !== "object") {
    return false;
  }
  const o = v as Record<string, unknown>;
  return (
    typeof o.userId === "string" &&
    typeof o.tenantId === "string" &&
    typeof o.exp === "number" &&
    Number.isFinite(o.exp)
  );
}

export async function verifySignedSession(
  token: string,
): Promise<SessionPayload | null> {
  let secret: string;
  try {
    secret = requireSessionSecret();
  } catch {
    return null;
  }

  const dot = token.indexOf(".");
  if (dot === -1) {
    return null;
  }
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);
  if (!payloadB64 || !sigB64) {
    return null;
  }

  let sigBuf: Uint8Array;
  try {
    sigBuf = new Uint8Array(Buffer.from(sigB64, "base64url"));
  } catch {
    return null;
  }

  const expectedSig = await hmacSha256(secret, payloadB64);
  if (sigBuf.length !== expectedSig.length) {
    return null;
  }
  if (!timingSafeEqualUint8(sigBuf, expectedSig)) {
    return null;
  }

  let parsed: unknown;
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    parsed = JSON.parse(json) as unknown;
  } catch {
    return null;
  }

  if (!isPayload(parsed)) {
    return null;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (parsed.exp <= nowSec) {
    return null;
  }

  return parsed;
}

export function sessionCookieMaxAge(payload: SessionPayload): number {
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.max(0, payload.exp - nowSec);
}

export function baseSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}
