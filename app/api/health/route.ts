import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const info = {
    status: "ok",
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
    vercel: process.env.VERCEL === "1",
    region: process.env.VERCEL_REGION || "unknown",
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "unknown",
  };

  console.log("[HEALTH] Health check:", JSON.stringify(info));

  return NextResponse.json(info);
}
