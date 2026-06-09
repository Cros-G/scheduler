import { cookies } from "next/headers";
import { destroySession } from "@/lib/session";
import { SESSION_COOKIE, shouldSetSecureCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await destroySession(token);
  }
  const headers = new Headers();
  headers.set("Location", "/login");
  const secureFlag = shouldSetSecureCookie(req) ? "; Secure" : "";
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secureFlag}`
  );
  return new Response(null, { status: 302, headers });
}
