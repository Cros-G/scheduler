import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  addOccurrenceCore,
  removeOccurrenceCore,
  setCheckCore,
} from "@/app/(app)/occurrences/actions-core";
import { createTaskCore } from "@/app/(app)/tasks/actions-core";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await closeTestDb(); });

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
  name: "吃苹果", icon: "🍎", color: COLOR_PALETTE[0],
  type: "COUNTED" as const, targetCount: 1, targetPeriod: "DAY" as const,
  isPrivate: false,
};
const validCheck = {
  name: "冥想", icon: "🧘", color: COLOR_PALETTE[1],
  type: "CHECK" as const, isPrivate: false,
};

describe("addOccurrenceCore", () => {
  it("COUNTED 任务加 1 次", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.occurrence.count).toBe(1);
      expect(out.occurrence.userId).toBe(u.id);
      expect(out.occurrence.date).toBe("2026-05-06");
    }
  });

  it("COUNTED 任务一次加 N 次", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 3, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.occurrence.count).toBe(3);
  });

  it("CHECK 任务不能用 addOccurrenceCore", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(false);
  });

  it("delta <= 0 → 失败", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 0, prisma);
    expect(out.ok).toBe(false);
  });

  it("date 格式不对 → 失败", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "5/6/2026", 1, prisma);
    expect(out.ok).toBe(false);
  });

  it("操作别人的任务 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const t = await createTaskCore(a.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(b.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(false);
  });

  it("归档任务也允许加（不强制）", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    await prisma.task.update({ where: { id: t.task.id }, data: { archivedAt: new Date() } });
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(true);
  });
});

describe("removeOccurrenceCore", () => {
  it("删除自己的事件", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const a = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    if (!a.ok) throw new Error();
    const out = await removeOccurrenceCore(u.id, a.occurrence.id, prisma);
    expect(out.ok).toBe(true);
    expect(await prisma.occurrence.findUnique({ where: { id: a.occurrence.id } })).toBeNull();
  });

  it("操作别人的事件 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const t = await createTaskCore(a.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const ev = await addOccurrenceCore(a.id, t.task.id, "2026-05-06", 1, prisma);
    if (!ev.ok) throw new Error();
    const out = await removeOccurrenceCore(b.id, ev.occurrence.id, prisma);
    expect(out.ok).toBe(false);
  });

  it("不存在的事件 → 失败", async () => {
    const u = await makeUser();
    const out = await removeOccurrenceCore(u.id, 99999, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("setCheckCore", () => {
  it("on=true 创建一行 count=1", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    expect(out.ok).toBe(true);
    const rows = await prisma.occurrence.findMany({ where: { taskId: t.task.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(1);
  });

  it("on=true 重复调用 → 仍只 1 行（幂等）", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    const rows = await prisma.occurrence.findMany({ where: { taskId: t.task.id } });
    expect(rows).toHaveLength(1);
  });

  it("on=false 删除当日所有事件", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    await setCheckCore(u.id, t.task.id, "2026-05-06", false, prisma);
    const rows = await prisma.occurrence.findMany({ where: { taskId: t.task.id } });
    expect(rows).toHaveLength(0);
  });

  it("on=false 在没有事件时 → 不报错", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(u.id, t.task.id, "2026-05-06", false, prisma);
    expect(out.ok).toBe(true);
  });

  it("COUNTED 任务用 setCheck → 失败", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    expect(out.ok).toBe(false);
  });

  it("操作别人的任务 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const t = await createTaskCore(a.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(b.id, t.task.id, "2026-05-06", true, prisma);
    expect(out.ok).toBe(false);
  });
});
