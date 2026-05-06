import type { PrismaClient, DailyNote } from "@prisma/client";
import { validateDateKey, validateNoteContent } from "@/lib/note-validation";

export type ActionResult<T = void> =
  | { ok: true; note: T }
  | { ok: false; error: string };

export async function upsertNoteCore(
  userId: number,
  date: string,
  content: string,
  prisma: PrismaClient
): Promise<ActionResult<DailyNote>> {
  const dv = validateDateKey(date);
  if (!dv.ok) return dv;
  const cv = validateNoteContent(content);
  if (!cv.ok) return cv;

  const note = await prisma.dailyNote.upsert({
    where: { userId_date: { userId, date } },
    update: { content },
    create: { userId, date, content },
  });
  return { ok: true, note };
}

export async function deleteNoteImageCore(
  userId: number,
  imageId: number,
  prisma: PrismaClient
): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const img = await prisma.noteImage.findUnique({
    where: { id: imageId },
    include: { note: true },
  });
  if (!img) return { ok: false, error: "图片不存在" };
  if (img.note.userId !== userId) return { ok: false, error: "无权操作" };
  await prisma.noteImage.delete({ where: { id: imageId } });
  return { ok: true, filePath: img.filePath };
}

export async function reorderNoteImagesCore(
  userId: number,
  noteId: number,
  imageIds: number[],
  prisma: PrismaClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const note = await prisma.dailyNote.findUnique({
    where: { id: noteId },
    include: { images: true },
  });
  if (!note) return { ok: false, error: "心声不存在" };
  if (note.userId !== userId) return { ok: false, error: "无权操作" };
  const existingIds = new Set(note.images.map((i) => i.id));
  if (imageIds.length !== existingIds.size || imageIds.some((id) => !existingIds.has(id))) {
    return { ok: false, error: "图片列表不一致" };
  }
  await prisma.$transaction(
    imageIds.map((id, idx) =>
      prisma.noteImage.update({ where: { id }, data: { sortOrder: idx } })
    )
  );
  return { ok: true };
}
