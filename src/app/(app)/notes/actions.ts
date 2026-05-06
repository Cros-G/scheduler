"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteNoteImageFromDisk } from "@/lib/storage";
import {
  upsertNoteCore, deleteNoteImageCore, reorderNoteImagesCore,
} from "./actions-core";

export async function upsertNoteAction(date: string, content: string) {
  const user = await requireAuth();
  const result = await upsertNoteCore(user.id, date, content, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteNoteImageAction(imageId: number) {
  const user = await requireAuth();
  const result = await deleteNoteImageCore(user.id, imageId, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  // 异步清理磁盘，不阻塞响应
  deleteNoteImageFromDisk(result.filePath).catch(() => {});
  revalidatePath("/");
  return { ok: true };
}

export async function reorderNoteImagesAction(noteId: number, imageIds: number[]) {
  const user = await requireAuth();
  const result = await reorderNoteImagesCore(user.id, noteId, imageIds, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}
