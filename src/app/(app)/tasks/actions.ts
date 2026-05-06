"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseTaskFormData } from "@/lib/task-validation";
import {
  createTaskCore,
  updateTaskCore,
  archiveTaskCore,
  unarchiveTaskCore,
  deleteTaskCore,
} from "./actions-core";

const TASKS_PATH = "/tasks";

export async function createTaskAction(formData: FormData) {
  const user = await requireAuth();
  const input = parseTaskFormData(formData);
  const result = await createTaskCore(user.id, input, prisma);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(TASKS_PATH);
  return { ok: true };
}

export async function updateTaskAction(taskId: number, formData: FormData) {
  const user = await requireAuth();
  const input = parseTaskFormData(formData);
  const result = await updateTaskCore(user.id, taskId, input, prisma);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(TASKS_PATH);
  return { ok: true };
}

export async function archiveTaskAction(taskId: number) {
  const user = await requireAuth();
  const result = await archiveTaskCore(user.id, taskId, prisma);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(TASKS_PATH);
}

export async function unarchiveTaskAction(taskId: number) {
  const user = await requireAuth();
  const result = await unarchiveTaskCore(user.id, taskId, prisma);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(TASKS_PATH);
}

export async function deleteTaskAction(taskId: number) {
  const user = await requireAuth();
  const result = await deleteTaskCore(user.id, taskId, prisma);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(TASKS_PATH);
}
