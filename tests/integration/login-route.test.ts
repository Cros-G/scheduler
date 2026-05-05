import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

async function makeUser(username = "alice", password = "hunter2") {
  return prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      displayName: username,
      color: "#FF8888",
    },
  });
}

async function callLogin(body: Record<string, string>) {
  const { POST } = await import("@/app/api/login/route");
  const form = new URLSearchParams(body);
  const req = new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return POST(req);
}

describe("POST /api/login", () => {
  it("正确凭据 → 302 到 /，并设置 cookie", async () => {
    await makeUser();
    const res = await callLogin({ username: "alice", password: "hunter2" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toMatch(/scheduler_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it("错误密码 → 302 到 /login?error=invalid", async () => {
    await makeUser();
    const res = await callLogin({ username: "alice", password: "wrong" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });

  it("用户不存在 → 302 到 /login?error=invalid", async () => {
    const res = await callLogin({ username: "bob", password: "x" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });

  it("缺少字段 → 302 到 /login?error=invalid", async () => {
    const res = await callLogin({ username: "alice" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });
});
