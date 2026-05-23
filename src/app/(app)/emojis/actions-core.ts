import type { PrismaClient, EmojiCategory, CustomEmoji } from "@prisma/client";
import {
  validateCategoryName, validateEmoji,
  CATEGORIES_PER_USER_MAX, EMOJIS_PER_CATEGORY_MAX,
} from "@/lib/emoji-validation";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export interface CategoryWithEmojis extends EmojiCategory {
  emojis: CustomEmoji[];
}

export async function createCategoryCore(
  userId: number,
  name: string,
  prisma: PrismaClient
): Promise<Result<{ category: EmojiCategory }>> {
  const v = validateCategoryName(name);
  if (!v.ok) return v;

  const count = await prisma.emojiCategory.count({ where: { userId } });
  if (count >= CATEGORIES_PER_USER_MAX) {
    return { ok: false, error: `分类数已达上限 (${CATEGORIES_PER_USER_MAX})` };
  }

  const max = await prisma.emojiCategory.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  const category = await prisma.emojiCategory.create({
    data: { userId, name: name.trim(), sortOrder },
  });
  return { ok: true, category };
}

export async function renameCategoryCore(
  userId: number,
  categoryId: number,
  newName: string,
  prisma: PrismaClient
): Promise<Result<{ category: EmojiCategory }>> {
  const v = validateCategoryName(newName);
  if (!v.ok) return v;

  const existing = await prisma.emojiCategory.findUnique({ where: { id: categoryId } });
  if (!existing) return { ok: false, error: "分类不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };

  const category = await prisma.emojiCategory.update({
    where: { id: categoryId },
    data: { name: newName.trim() },
  });
  return { ok: true, category };
}

export async function deleteCategoryCore(
  userId: number,
  categoryId: number,
  prisma: PrismaClient
): Promise<Result<{ deletedId: number }>> {
  const existing = await prisma.emojiCategory.findUnique({ where: { id: categoryId } });
  if (!existing) return { ok: false, error: "分类不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };

  await prisma.emojiCategory.delete({ where: { id: categoryId } });
  return { ok: true, deletedId: categoryId };
}

export async function addEmojiCore(
  userId: number,
  categoryId: number,
  emoji: string,
  prisma: PrismaClient
): Promise<Result<{ customEmoji: CustomEmoji }>> {
  const v = validateEmoji(emoji);
  if (!v.ok) return v;

  const category = await prisma.emojiCategory.findUnique({ where: { id: categoryId } });
  if (!category) return { ok: false, error: "分类不存在" };
  if (category.userId !== userId) return { ok: false, error: "无权操作" };

  const count = await prisma.customEmoji.count({ where: { categoryId } });
  if (count >= EMOJIS_PER_CATEGORY_MAX) {
    return { ok: false, error: `该分类 emoji 数已达上限 (${EMOJIS_PER_CATEGORY_MAX})` };
  }

  const dup = await prisma.customEmoji.findUnique({
    where: { categoryId_emoji: { categoryId, emoji } },
  });
  if (dup) return { ok: false, error: "该 emoji 已在此分类" };

  const max = await prisma.customEmoji.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  const customEmoji = await prisma.customEmoji.create({
    data: { categoryId, emoji, sortOrder },
  });
  return { ok: true, customEmoji };
}

export async function removeEmojiCore(
  userId: number,
  customEmojiId: number,
  prisma: PrismaClient
): Promise<Result<{ deletedId: number }>> {
  const existing = await prisma.customEmoji.findUnique({
    where: { id: customEmojiId },
    include: { category: true },
  });
  if (!existing) return { ok: false, error: "emoji 不存在" };
  if (existing.category.userId !== userId) return { ok: false, error: "无权操作" };

  await prisma.customEmoji.delete({ where: { id: customEmojiId } });
  return { ok: true, deletedId: customEmojiId };
}

export async function listCategoriesCore(
  userId: number,
  prisma: PrismaClient
): Promise<CategoryWithEmojis[]> {
  return prisma.emojiCategory.findMany({
    where: { userId },
    include: { emojis: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });
}
