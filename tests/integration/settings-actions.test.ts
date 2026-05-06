import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import { updateProfileCore } from "@/app/(app)/settings/actions-core";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();
beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await closeTestDb(); });

async function makeUser() {
  return prisma.user.create({
    data: {
      username: "alice",
      passwordHash: await hashPassword("x"),
      displayName: "Alice",
      color: COLOR_PALETTE[0],
    },
  });
}

describe("updateProfileCore", () => {
  it("更新昵称 + 颜色", async () => {
    const u = await makeUser();
    const out = await updateProfileCore(
      u.id,
      { displayName: "Alicia", color: COLOR_PALETTE[5] },
      prisma
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.user.displayName).toBe("Alicia");
      expect(out.user.color).toBe(COLOR_PALETTE[5]);
    }
  });

  it("空昵称（只有空格） → 失败", async () => {
    const u = await makeUser();
    const out = await updateProfileCore(
      u.id,
      { displayName: "  ", color: COLOR_PALETTE[0] },
      prisma
    );
    expect(out.ok).toBe(false);
  });

  it("超长昵称 → 失败", async () => {
    const u = await makeUser();
    const out = await updateProfileCore(
      u.id,
      { displayName: "a".repeat(31), color: COLOR_PALETTE[0] },
      prisma
    );
    expect(out.ok).toBe(false);
  });

  it("非白名单颜色 → 失败", async () => {
    const u = await makeUser();
    const out = await updateProfileCore(
      u.id,
      { displayName: "X", color: "#000000" },
      prisma
    );
    expect(out.ok).toBe(false);
  });
});
