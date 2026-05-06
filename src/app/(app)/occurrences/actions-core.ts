import type { PrismaClient, Occurrence } from "@prisma/client";

export type ActionResult<T = void> =
  | { ok: true; occurrence: T }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addOccurrenceCore(
  userId: number,
  taskId: number,
  date: string,
  delta: number,
  prisma: PrismaClient
): Promise<ActionResult<Occurrence>> {
  if (!DATE_RE.test(date)) return { ok: false, error: "日期格式错误" };
  if (!Number.isInteger(delta) || delta <= 0) return { ok: false, error: "次数必须为正整数" };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.userId !== userId) return { ok: false, error: "无权操作" };
  if (task.type !== "COUNTED") return { ok: false, error: "次数型任务才能用 addOccurrence" };

  const occurrence = await prisma.occurrence.create({
    data: { taskId, userId: task.userId, date, count: delta },
  });
  return { ok: true, occurrence };
}

export async function removeOccurrenceCore(
  userId: number,
  occurrenceId: number,
  prisma: PrismaClient
): Promise<ActionResult<Occurrence>> {
  const existing = await prisma.occurrence.findUnique({ where: { id: occurrenceId } });
  if (!existing) return { ok: false, error: "事件不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  const occurrence = await prisma.occurrence.delete({ where: { id: occurrenceId } });
  return { ok: true, occurrence };
}

export async function setCheckCore(
  userId: number,
  taskId: number,
  date: string,
  on: boolean,
  prisma: PrismaClient
): Promise<ActionResult<Occurrence | null>> {
  if (!DATE_RE.test(date)) return { ok: false, error: "日期格式错误" };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.userId !== userId) return { ok: false, error: "无权操作" };
  if (task.type !== "CHECK") return { ok: false, error: "打卡型任务才能用 setCheck" };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.occurrence.findFirst({ where: { taskId, date } });
    if (on) {
      if (existing) return { ok: true as const, occurrence: existing };
      const created = await tx.occurrence.create({
        data: { taskId, userId: task.userId, date, count: 1 },
      });
      return { ok: true as const, occurrence: created };
    } else {
      await tx.occurrence.deleteMany({ where: { taskId, date } });
      return { ok: true as const, occurrence: null };
    }
  });
}
