import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createSession,
  validateSession,
  destroySession,
  SESSION_DURATION_MS,
} from "@/lib/session";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

async function makeUser() {
  return prisma.user.create({
    data: {
      username: "alice",
      passwordHash: "x",
      displayName: "Alice",
      color: "#FF8888",
    },
  });
}

describe("session", () => {
  it("createSession 返回 32 字节 hex token 且写入 DB", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const row = await prisma.session.findUnique({ where: { id: token } });
    expect(row?.userId).toBe(user.id);
  });

  it("validateSession 返回 user 当 token 有效", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    const result = await validateSession(token, prisma);
    expect(result?.id).toBe(user.id);
  });

  it("validateSession 返回 null 当 token 无效", async () => {
    const result = await validateSession("nonexistent", prisma);
    expect(result).toBeNull();
  });

  it("validateSession 返回 null 当 token 过期", async () => {
    const user = await makeUser();
    const token = "abc".repeat(22).slice(0, 64);
    await prisma.session.create({
      data: {
        id: token,
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const result = await validateSession(token, prisma);
    expect(result).toBeNull();
  });

  it("validateSession 在过期前会滑动续期", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    const before = await prisma.session.findUnique({ where: { id: token } });
    await new Promise((r) => setTimeout(r, 10));
    await validateSession(token, prisma);
    const after = await prisma.session.findUnique({ where: { id: token } });
    expect(after!.expiresAt.getTime()).toBeGreaterThan(before!.expiresAt.getTime());
  });

  it("destroySession 删除 token", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    await destroySession(token, prisma);
    const row = await prisma.session.findUnique({ where: { id: token } });
    expect(row).toBeNull();
  });

  it("SESSION_DURATION_MS = 30 天", () => {
    expect(SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
