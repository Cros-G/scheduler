import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createTaskCore,
  updateTaskCore,
  archiveTaskCore,
  unarchiveTaskCore,
  deleteTaskCore,
} from "@/app/(app)/tasks/actions-core";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

async function makeUser(username = "alice") {
  return prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword("x"),
      displayName: username,
      color: COLOR_PALETTE[0],
    },
  });
}

const validCounted = {
  name: "吃苹果",
  icon: "🍎",
  color: COLOR_PALETTE[0],
  type: "COUNTED" as const,
  targetCount: 1,
  targetPeriod: "DAY" as const,
  isPrivate: false,
};
const validCheck = {
  name: "冥想",
  icon: "🧘",
  color: COLOR_PALETTE[1],
  type: "CHECK" as const,
  isPrivate: false,
};

describe("createTaskCore", () => {
  it("创建 COUNTED 任务", async () => {
    const u = await makeUser();
    const out = await createTaskCore(u.id, validCounted, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.name).toBe("吃苹果");
      expect(out.task.userId).toBe(u.id);
      expect(out.task.type).toBe("COUNTED");
      expect(out.task.targetCount).toBe(1);
      expect(out.task.targetPeriod).toBe("DAY");
      expect(out.task.archivedAt).toBeNull();
    }
  });

  it("创建 CHECK 任务", async () => {
    const u = await makeUser();
    const out = await createTaskCore(u.id, validCheck, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.targetCount).toBeNull();
      expect(out.task.targetPeriod).toBeNull();
    }
  });

  it("校验失败（name 空）→ 返回 error", async () => {
    const u = await makeUser();
    const out = await createTaskCore(u.id, { ...validCounted, name: "" }, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("updateTaskCore", () => {
  it("更新允许字段", async () => {
    const u = await makeUser();
    const created = await createTaskCore(u.id, validCounted, prisma);
    if (!created.ok) throw new Error("setup failed");
    const out = await updateTaskCore(
      u.id,
      created.task.id,
      { ...validCounted, name: "吃两个苹果", targetCount: 2 },
      prisma
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.name).toBe("吃两个苹果");
      expect(out.task.targetCount).toBe(2);
    }
  });

  it("尝试改 type → 返回 error", async () => {
    const u = await makeUser();
    const created = await createTaskCore(u.id, validCounted, prisma);
    if (!created.ok) throw new Error("setup failed");
    const out = await updateTaskCore(
      u.id,
      created.task.id,
      { ...validCounted, type: "CHECK" as const, targetCount: undefined, targetPeriod: undefined },
      prisma
    );
    expect(out.ok).toBe(false);
  });

  it("操作别人的任务 → 返回 error", async () => {
    const u1 = await makeUser("alice");
    const u2 = await makeUser("bob");
    const created = await createTaskCore(u1.id, validCounted, prisma);
    if (!created.ok) throw new Error("setup failed");
    const out = await updateTaskCore(u2.id, created.task.id, validCounted, prisma);
    expect(out.ok).toBe(false);
  });

  it("不存在的任务 → 返回 error", async () => {
    const u = await makeUser();
    const out = await updateTaskCore(u.id, 99999, validCounted, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("archiveTaskCore / unarchiveTaskCore", () => {
  it("归档设置 archivedAt", async () => {
    const u = await makeUser();
    const c = await createTaskCore(u.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await archiveTaskCore(u.id, c.task.id, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.archivedAt).toBeInstanceOf(Date);
    }
  });

  it("反归档清空 archivedAt", async () => {
    const u = await makeUser();
    const c = await createTaskCore(u.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    await archiveTaskCore(u.id, c.task.id, prisma);
    const out = await unarchiveTaskCore(u.id, c.task.id, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.archivedAt).toBeNull();
    }
  });

  it("操作别人的任务 → 失败", async () => {
    const u1 = await makeUser("alice");
    const u2 = await makeUser("bob");
    const c = await createTaskCore(u1.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await archiveTaskCore(u2.id, c.task.id, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("deleteTaskCore", () => {
  it("无事件的任务可以删除", async () => {
    const u = await makeUser();
    const c = await createTaskCore(u.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await deleteTaskCore(u.id, c.task.id, prisma);
    expect(out.ok).toBe(true);
    const remaining = await prisma.task.findUnique({ where: { id: c.task.id } });
    expect(remaining).toBeNull();
  });

  it("操作别人的任务 → 失败", async () => {
    const u1 = await makeUser("alice");
    const u2 = await makeUser("bob");
    const c = await createTaskCore(u1.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await deleteTaskCore(u2.id, c.task.id, prisma);
    expect(out.ok).toBe(false);
    const stillThere = await prisma.task.findUnique({ where: { id: c.task.id } });
    expect(stillThere).not.toBeNull();
  });
});
