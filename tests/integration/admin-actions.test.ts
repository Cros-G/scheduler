import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createUserCore, updateUserCore, resetPasswordCore, deleteUserCore,
} from "@/app/(app)/admin/actions-core";
import { hashPassword, verifyPassword } from "@/lib/password";
import { COLOR_PALETTE } from "@/lib/task-validation";

const prisma = getTestPrisma();
beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await closeTestDb(); });

async function makeAdmin(username = "admin1") {
  return prisma.user.create({
    data: {
      username, passwordHash: await hashPassword("x"),
      displayName: username, color: COLOR_PALETTE[0], isAdmin: true,
    },
  });
}
async function makeRegular(username = "alice") {
  return prisma.user.create({
    data: {
      username, passwordHash: await hashPassword("x"),
      displayName: username, color: COLOR_PALETTE[0], isAdmin: false,
    },
  });
}

describe("createUserCore", () => {
  it("admin 创建普通用户", async () => {
    const a = await makeAdmin();
    const out = await createUserCore(a.id, {
      username: "newuser", displayName: "New", password: "secret123",
      color: COLOR_PALETTE[1], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.user.username).toBe("newuser");
      expect(out.user.isAdmin).toBe(false);
      expect(await verifyPassword("secret123", out.user.passwordHash)).toBe(true);
    }
  });

  it("admin 创建另一个 admin", async () => {
    const a = await makeAdmin();
    const out = await createUserCore(a.id, {
      username: "admin2", displayName: "A2", password: "secret123",
      color: COLOR_PALETTE[2], isAdmin: true,
    }, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.user.isAdmin).toBe(true);
  });

  it("非 admin 调 createUserCore → 失败", async () => {
    const r = await makeRegular();
    const out = await createUserCore(r.id, {
      username: "hacker", displayName: "X", password: "secret123",
      color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("用户名重复 → 失败", async () => {
    const a = await makeAdmin();
    await makeRegular("dup");
    const out = await createUserCore(a.id, {
      username: "dup", displayName: "X", password: "secret123",
      color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("校验失败 (短 username)", async () => {
    const a = await makeAdmin();
    const out = await createUserCore(a.id, {
      username: "ab", displayName: "X", password: "secret123",
      color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("校验失败 (短 password)", async () => {
    const a = await makeAdmin();
    const out = await createUserCore(a.id, {
      username: "okname", displayName: "X", password: "12345",
      color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("校验失败 (color 不在色板)", async () => {
    const a = await makeAdmin();
    const out = await createUserCore(a.id, {
      username: "okname", displayName: "X", password: "secret123",
      color: "#000000", isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("调用者不存在 → 失败", async () => {
    const out = await createUserCore(99999, {
      username: "okname", displayName: "X", password: "secret123",
      color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("updateUserCore", () => {
  it("admin 改昵称 + 颜色 + admin 标记 OK", async () => {
    const a = await makeAdmin();
    const r = await makeRegular();
    const out = await updateUserCore(a.id, r.id, {
      displayName: "Alicia", color: COLOR_PALETTE[3], isAdmin: true,
    }, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.user.displayName).toBe("Alicia");
      expect(out.user.isAdmin).toBe(true);
    }
  });

  it("非 admin 调 → 失败", async () => {
    const r1 = await makeRegular("r1");
    const r2 = await makeRegular("r2");
    const out = await updateUserCore(r1.id, r2.id, {
      displayName: "X", color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("admin 不能取消自己的 admin 标记", async () => {
    const a = await makeAdmin();
    const out = await updateUserCore(a.id, a.id, {
      displayName: a.displayName, color: a.color, isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("不能取消最后一个 admin（其他 admin 取消自己也拒绝 — 同样路径）", async () => {
    const a = await makeAdmin();
    // a 是唯一 admin，自己取消自己的 admin 标记 → 失败
    const out = await updateUserCore(a.id, a.id, {
      displayName: a.displayName, color: a.color, isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("两个 admin 时取消一个 OK（剩 1 个）", async () => {
    const a1 = await makeAdmin("a1");
    const a2 = await makeAdmin("a2");
    const out = await updateUserCore(a1.id, a2.id, {
      displayName: a2.displayName, color: a2.color, isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(true);
  });

  it("不存在的 user → 失败", async () => {
    const a = await makeAdmin();
    const out = await updateUserCore(a.id, 99999, {
      displayName: "X", color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });

  it("校验失败 (空 displayName)", async () => {
    const a = await makeAdmin();
    const r = await makeRegular();
    const out = await updateUserCore(a.id, r.id, {
      displayName: "", color: COLOR_PALETTE[0], isAdmin: false,
    }, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("resetPasswordCore", () => {
  it("admin 重置 + 清 session", async () => {
    const a = await makeAdmin();
    const r = await makeRegular();
    await prisma.session.create({
      data: {
        id: "abc".repeat(22).slice(0, 64),
        userId: r.id,
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    const out = await resetPasswordCore(a.id, r.id, "newpw123", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(await verifyPassword("newpw123", out.user.passwordHash)).toBe(true);
    expect(await prisma.session.count({ where: { userId: r.id } })).toBe(0);
  });

  it("非 admin 调 → 失败", async () => {
    const r1 = await makeRegular("r1");
    const r2 = await makeRegular("r2");
    const out = await resetPasswordCore(r1.id, r2.id, "secret123", prisma);
    expect(out.ok).toBe(false);
  });

  it("校验失败 (短密码)", async () => {
    const a = await makeAdmin();
    const r = await makeRegular();
    const out = await resetPasswordCore(a.id, r.id, "12345", prisma);
    expect(out.ok).toBe(false);
  });

  it("不存在的 user → 失败", async () => {
    const a = await makeAdmin();
    const out = await resetPasswordCore(a.id, 99999, "secret123", prisma);
    expect(out.ok).toBe(false);
  });
});

describe("deleteUserCore", () => {
  it("admin 删普通用户 → 级联删任务/事件/心声/图片", async () => {
    const a = await makeAdmin();
    const r = await makeRegular();
    const t = await prisma.task.create({
      data: {
        userId: r.id, name: "x", icon: "🍎", color: COLOR_PALETTE[0],
        type: "COUNTED", targetCount: 1, targetPeriod: "DAY", isPrivate: false,
      },
    });
    await prisma.occurrence.create({
      data: { taskId: t.id, userId: r.id, date: "2026-05-06", count: 1 },
    });
    const note = await prisma.dailyNote.create({
      data: { userId: r.id, date: "2026-05-06", content: "test" },
    });
    await prisma.noteImage.create({
      data: {
        noteId: note.id, filePath: "x", originalName: "x",
        sizeBytes: 1, mimeType: "image/png",
      },
    });

    const out = await deleteUserCore(a.id, r.id, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.deletedUserId).toBe(r.id);

    expect(await prisma.user.findUnique({ where: { id: r.id } })).toBeNull();
    expect(await prisma.task.count({ where: { userId: r.id } })).toBe(0);
    expect(await prisma.dailyNote.count({ where: { userId: r.id } })).toBe(0);
  });

  it("admin 不能删自己", async () => {
    const a = await makeAdmin();
    const out = await deleteUserCore(a.id, a.id, prisma);
    expect(out.ok).toBe(false);
    expect(await prisma.user.findUnique({ where: { id: a.id } })).not.toBeNull();
  });

  it("两个 admin 删一个（剩 1 个）→ 成功", async () => {
    const a1 = await makeAdmin("a1");
    const a2 = await makeAdmin("a2");
    const out = await deleteUserCore(a1.id, a2.id, prisma);
    expect(out.ok).toBe(true);
    expect(await prisma.user.count({ where: { isAdmin: true } })).toBe(1);
  });

  it("非 admin 调 → 失败", async () => {
    const r1 = await makeRegular("r1");
    const r2 = await makeRegular("r2");
    const out = await deleteUserCore(r1.id, r2.id, prisma);
    expect(out.ok).toBe(false);
  });

  it("不存在的 user → 失败", async () => {
    const a = await makeAdmin();
    const out = await deleteUserCore(a.id, 99999, prisma);
    expect(out.ok).toBe(false);
  });
});
