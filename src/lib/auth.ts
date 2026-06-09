import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { validateSession } from "./session";

export const SESSION_COOKIE = "scheduler_session";

/**
 * Decide whether to set the `Secure` flag on the session cookie.
 *
 * Priority:
 *   1. Explicit env override: COOKIE_SECURE=true|false
 *   2. Auto-detect from the request: X-Forwarded-Proto (reverse proxy) or req.url protocol
 *
 * This decouples cookie-Secure behavior from NODE_ENV, so a plain HTTP deployment
 * (e.g. self-host on IP:port without HTTPS) won't have its login cookie silently
 * dropped by the browser, while an HTTPS deployment behind a proxy still gets Secure.
 */
export function shouldSetSecureCookie(req: Request): boolean {
  const override = process.env.COOKIE_SECURE;
  if (override === "true") return true;
  if (override === "false") return false;
  const xfproto = req.headers.get("x-forwarded-proto");
  if (xfproto) return xfproto.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(token);
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (!user.isAdmin) redirect("/");
  return user;
}

export async function requireAuthApi(): Promise<User | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, error: "未登录" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return user;
}
