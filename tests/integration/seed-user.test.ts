import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createUser, parseArgs } from "../../scripts/seed-user";
import { verifyPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

describe("seed-user createUser", () => {
  it("创建新用户：哈希密码、写入字段", async () => {
    await createUser(
      { username: "alice", display: "Alice", password: "hunter2", color: "#FF8888", admin: false },
      prisma
    );
    const u = await prisma.user.findUnique({ where: { username: "alice" } });
    expect(u).toBeTruthy();
    expect(u!.displayName).toBe("Alice");
    expect(u!.color).toBe("#FF8888");
    expect(u!.isAdmin).toBe(false);
    expect(await verifyPassword("hunter2", u!.passwordHash)).toBe(true);
  });

  it("用户已存在 → 更新密码 + 字段（upsert）", async () => {
    await createUser(
      { username: "alice", display: "Alice", password: "old", color: "#FF8888", admin: false },
      prisma
    );
    await createUser(
      { username: "alice", display: "Alice 2", password: "new", color: "#00FF00", admin: true },
      prisma
    );
    const u = await prisma.user.findUnique({ where: { username: "alice" } });
    expect(u!.displayName).toBe("Alice 2");
    expect(u!.color).toBe("#00FF00");
    expect(u!.isAdmin).toBe(true);
    expect(await verifyPassword("new", u!.passwordHash)).toBe(true);
  });
});

describe("parseArgs", () => {
  it("解析全部参数", () => {
    const result = parseArgs([
      "--username", "alice",
      "--display", "Alice",
      "--password", "hunter2",
      "--color", "#FF8888",
      "--admin",
    ]);
    expect(result).toEqual({
      username: "alice",
      display: "Alice",
      password: "hunter2",
      color: "#FF8888",
      admin: true,
    });
  });

  it("admin 默认 false", () => {
    const result = parseArgs([
      "--username", "alice",
      "--display", "Alice",
      "--password", "hunter2",
      "--color", "#FF8888",
    ]);
    expect(result.admin).toBe(false);
  });

  it("缺必填 → 抛错", () => {
    expect(() => parseArgs(["--username", "alice"])).toThrow();
  });
});
