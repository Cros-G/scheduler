"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  addOccurrenceCore,
  removeOccurrenceCore,
  setCheckCore,
} from "./actions-core";

export async function addOccurrenceAction(taskId: number, date: string, delta: number = 1) {
  const user = await requireAuth();
  const result = await addOccurrenceCore(user.id, taskId, date, delta, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}

export async function removeOccurrenceAction(occurrenceId: number) {
  const user = await requireAuth();
  const result = await removeOccurrenceCore(user.id, occurrenceId, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}

export async function setCheckAction(taskId: number, date: string, on: boolean) {
  const user = await requireAuth();
  const result = await setCheckCore(user.id, taskId, date, on, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}
