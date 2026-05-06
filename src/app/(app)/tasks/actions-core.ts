import type { PrismaClient, Task } from "@prisma/client";
import { validateTaskInput, type TaskInput } from "@/lib/task-validation";

export type ActionResult<T = void> =
  | { ok: true; task: T }
  | { ok: false; error: string };

export async function createTaskCore(
  userId: number,
  input: TaskInput,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const v = validateTaskInput(input);
  if (!v.ok) return v;

  const task = await prisma.task.create({
    data: {
      userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      type: input.type,
      targetCount: input.type === "COUNTED" ? input.targetCount! : null,
      targetPeriod: input.type === "COUNTED" ? input.targetPeriod! : null,
      isPrivate: input.isPrivate,
    },
  });
  return { ok: true, task };
}

export async function updateTaskCore(
  userId: number,
  taskId: number,
  input: TaskInput,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  if (existing.type !== input.type) {
    return { ok: false, error: "任务类型不可修改" };
  }
  const v = validateTaskInput(input);
  if (!v.ok) return v;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      name: input.name,
      icon: input.icon,
      color: input.color,
      targetCount: input.type === "COUNTED" ? input.targetCount! : null,
      targetPeriod: input.type === "COUNTED" ? input.targetPeriod! : null,
      isPrivate: input.isPrivate,
    },
  });
  return { ok: true, task };
}

export async function archiveTaskCore(
  userId: number,
  taskId: number,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });
  return { ok: true, task };
}

export async function unarchiveTaskCore(
  userId: number,
  taskId: number,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: null },
  });
  return { ok: true, task };
}

export async function deleteTaskCore(
  userId: number,
  taskId: number,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };

  const occurrenceCount = await prisma.occurrence.count({ where: { taskId } });
  if (occurrenceCount > 0) {
    return { ok: false, error: "任务已有记录，无法真删，请改为归档" };
  }

  const task = await prisma.task.delete({ where: { id: taskId } });
  return { ok: true, task };
}
