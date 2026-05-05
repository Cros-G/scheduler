import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, SESSION_DURATION_MS } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/auth";

const Body = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

function redirectTo(path: string, headers: Headers = new Headers()) {
  headers.set("Location", path);
  return new Response(null, { status: 302, headers });
}

function loginFailed() {
  return redirectTo("/login?error=invalid");
}

export async function POST(req: Request) {
  let parsed;
  try {
    const form = await req.formData();
    parsed = Body.safeParse({
      username: form.get("username"),
      password: form.get("password"),
    });
  } catch {
    return loginFailed();
  }
  if (!parsed.success) return loginFailed();

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return loginFailed();

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return loginFailed();

  const token = await createSession(user.id);
  const headers = new Headers();
  const cookieParts = [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${SESSION_DURATION_MS / 1000}`,
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") cookieParts.push("Secure");
  headers.append("Set-Cookie", cookieParts.join("; "));
  return redirectTo("/", headers);
}
