"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  createCategoryCore, renameCategoryCore, deleteCategoryCore,
  addEmojiCore, removeEmojiCore,
} from "./actions-core";

export async function createCategoryAction(name: string) {
  const user = await requireAuth();
  const result = await createCategoryCore(user.id, name, prisma);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/settings/emojis");
  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function renameCategoryAction(categoryId: number, newName: string) {
  const user = await requireAuth();
  const result = await renameCategoryCore(user.id, categoryId, newName, prisma);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/settings/emojis");
  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function deleteCategoryAction(categoryId: number) {
  const user = await requireAuth();
  const result = await deleteCategoryCore(user.id, categoryId, prisma);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/settings/emojis");
  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function addEmojiAction(categoryId: number, emoji: string) {
  const user = await requireAuth();
  const result = await addEmojiCore(user.id, categoryId, emoji, prisma);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/settings/emojis");
  revalidatePath("/tasks");
  return { ok: true as const };
}

export async function removeEmojiAction(customEmojiId: number) {
  const user = await requireAuth();
  const result = await removeEmojiCore(user.id, customEmojiId, prisma);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/settings/emojis");
  revalidatePath("/tasks");
  return { ok: true as const };
}
