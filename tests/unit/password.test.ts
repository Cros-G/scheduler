import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashPassword 返回非空字符串且不等于明文", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).toBeTypeOf("string");
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe("hunter2");
  });

  it("verifyPassword 对正确密码返回 true", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("hunter2", hash)).resolves.toBe(true);
  });

  it("verifyPassword 对错误密码返回 false", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("两次 hash 同一密码结果不同（盐随机）", async () => {
    const a = await hashPassword("hunter2");
    const b = await hashPassword("hunter2");
    expect(a).not.toBe(b);
  });
});
