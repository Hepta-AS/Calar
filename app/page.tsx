import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  SESSION_COOKIE_NAME,
  verifySignedSession,
} from "@/lib/auth/session";

export default async function Home() {
  const raw = cookies().get(SESSION_COOKIE_NAME)?.value;
  const session = raw ? await verifySignedSession(raw) : null;
  if (session) {
    redirect("/dashboard");
  }
  redirect("/login");
}
