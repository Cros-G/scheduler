import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createCategoryCore, renameCategoryCore, deleteCategoryCore,
  addEmojiCore, removeEmojiCore, listCategoriesCore,
} from "@/app/(app)/emojis/actions-core";
import { hashPassword } from "@/lib/password";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { CATEGORIES_PER_USER_MAX, EMOJIS_PER_CATEGORY_MAX } from "@/lib/emoji-validation";

const prisma = getTestPrisma();
beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await closeTestDb(); });

async function makeUser(username = "alice") {
  return prisma.user.create({
    data: {
      username, passwordHash: await hashPassword("x"),
      displayName: username, color: COLOR_PALETTE[0],
    },
  });
}

describe("createCategoryCore", () => {
  it("创建分类", async () => {
    const u = await makeUser();
    const out = await createCategoryCore(u.id, "我的最爱", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.category.name).toBe("我的最爱");
      expect(out.category.userId).toBe(u.id);
      expect(out.category.sortOrder).toBe(0);
    }
  });

  it("sortOrder 自动递增", async () => {
    const u = await makeUser();
    const a = await createCategoryCore(u.id, "A", prisma);
    const b = await createCategoryCore(u.id, "B", prisma);
    if (a.ok && b.ok) {
      expect(b.category.sortOrder).toBeGreaterThan(a.category.sortOrder);
    }
  });

  it("校验失败 (空名)", async () => {
    const u = await makeUser();
    expect((await createCategoryCore(u.id, "", prisma)).ok).toBe(false);
  });

  it("校验失败 (超长)", async () => {
    const u = await makeUser();
    expect((await createCategoryCore(u.id, "a".repeat(21), prisma)).ok).toBe(false);
  });

  it("超过 user 限额", async () => {
    const u = await makeUser();
    // 创建 MAX 个
    for (let i = 0; i < CATEGORIES_PER_USER_MAX; i++) {
      await createCategoryCore(u.id, `cat${i}`, prisma);
    }
    // 第 MAX+1 个失败
    expect((await createCategoryCore(u.id, "overflow", prisma)).ok).toBe(false);
  });
});

describe("renameCategoryCore", () => {
  it("改名 ok", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "old", prisma);
    if (!c.ok) throw new Error();
    const out = await renameCategoryCore(u.id, c.category.id, "new", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.category.name).toBe("new");
  });

  it("操作别人的分类 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const c = await createCategoryCore(a.id, "old", prisma);
    if (!c.ok) throw new Error();
    expect((await renameCategoryCore(b.id, c.category.id, "x", prisma)).ok).toBe(false);
  });

  it("不存在 → 失败", async () => {
    const u = await makeUser();
    expect((await renameCategoryCore(u.id, 99999, "x", prisma)).ok).toBe(false);
  });

  it("空名 → 失败", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    expect((await renameCategoryCore(u.id, c.category.id, "", prisma)).ok).toBe(false);
  });
});

describe("deleteCategoryCore", () => {
  it("删除分类 + 级联删 emoji", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    await addEmojiCore(u.id, c.category.id, "🍎", prisma);
    await addEmojiCore(u.id, c.category.id, "🍊", prisma);
    const out = await deleteCategoryCore(u.id, c.category.id, prisma);
    expect(out.ok).toBe(true);
    expect(await prisma.emojiCategory.findUnique({ where: { id: c.category.id } })).toBeNull();
    expect(await prisma.customEmoji.count({ where: { categoryId: c.category.id } })).toBe(0);
  });

  it("操作别人的 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const c = await createCategoryCore(a.id, "x", prisma);
    if (!c.ok) throw new Error();
    expect((await deleteCategoryCore(b.id, c.category.id, prisma)).ok).toBe(false);
  });

  it("不存在 → 失败", async () => {
    const u = await makeUser();
    expect((await deleteCategoryCore(u.id, 99999, prisma)).ok).toBe(false);
  });
});

describe("addEmojiCore", () => {
  it("添加 emoji ok", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    const out = await addEmojiCore(u.id, c.category.id, "🍎", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.customEmoji.emoji).toBe("🍎");
      expect(out.customEmoji.sortOrder).toBe(0);
    }
  });

  it("sortOrder 自动递增", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    const a = await addEmojiCore(u.id, c.category.id, "🍎", prisma);
    const b = await addEmojiCore(u.id, c.category.id, "🍊", prisma);
    if (a.ok && b.ok) {
      expect(b.customEmoji.sortOrder).toBeGreaterThan(a.customEmoji.sortOrder);
    }
  });

  it("同分类重复 emoji → 失败", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    await addEmojiCore(u.id, c.category.id, "🍎", prisma);
    expect((await addEmojiCore(u.id, c.category.id, "🍎", prisma)).ok).toBe(false);
  });

  it("不同分类相同 emoji → 都 ok", async () => {
    const u = await makeUser();
    const c1 = await createCategoryCore(u.id, "x", prisma);
    const c2 = await createCategoryCore(u.id, "y", prisma);
    if (!c1.ok || !c2.ok) throw new Error();
    expect((await addEmojiCore(u.id, c1.category.id, "🍎", prisma)).ok).toBe(true);
    expect((await addEmojiCore(u.id, c2.category.id, "🍎", prisma)).ok).toBe(true);
  });

  it("操作别人的分类 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const c = await createCategoryCore(a.id, "x", prisma);
    if (!c.ok) throw new Error();
    expect((await addEmojiCore(b.id, c.category.id, "🍎", prisma)).ok).toBe(false);
  });

  it("空 emoji → 失败", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    expect((await addEmojiCore(u.id, c.category.id, "", prisma)).ok).toBe(false);
  });

  it("超 emoji 长度 → 失败", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    expect((await addEmojiCore(u.id, c.category.id, "a".repeat(9), prisma)).ok).toBe(false);
  });

  it("超过分类内限额", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    for (let i = 0; i < EMOJIS_PER_CATEGORY_MAX; i++) {
      // 不能用同一个 emoji，得用不同字符
      await addEmojiCore(u.id, c.category.id, `e${i}`, prisma);
    }
    expect((await addEmojiCore(u.id, c.category.id, "overflow", prisma)).ok).toBe(false);
  });
});

describe("removeEmojiCore", () => {
  it("删除 emoji", async () => {
    const u = await makeUser();
    const c = await createCategoryCore(u.id, "x", prisma);
    if (!c.ok) throw new Error();
    const e = await addEmojiCore(u.id, c.category.id, "🍎", prisma);
    if (!e.ok) throw new Error();
    const out = await removeEmojiCore(u.id, e.customEmoji.id, prisma);
    expect(out.ok).toBe(true);
    expect(await prisma.customEmoji.findUnique({ where: { id: e.customEmoji.id } })).toBeNull();
  });

  it("操作别人的 emoji → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const c = await createCategoryCore(a.id, "x", prisma);
    if (!c.ok) throw new Error();
    const e = await addEmojiCore(a.id, c.category.id, "🍎", prisma);
    if (!e.ok) throw new Error();
    expect((await removeEmojiCore(b.id, e.customEmoji.id, prisma)).ok).toBe(false);
  });

  it("不存在 → 失败", async () => {
    const u = await makeUser();
    expect((await removeEmojiCore(u.id, 99999, prisma)).ok).toBe(false);
  });
});

describe("listCategoriesCore", () => {
  it("返回用户所有分类带 emoji，按 sortOrder 排序", async () => {
    const u = await makeUser();
    const c1 = await createCategoryCore(u.id, "A", prisma);
    const c2 = await createCategoryCore(u.id, "B", prisma);
    if (!c1.ok || !c2.ok) throw new Error();
    await addEmojiCore(u.id, c1.category.id, "🍎", prisma);
    await addEmojiCore(u.id, c1.category.id, "🍊", prisma);
    const out = await listCategoriesCore(u.id, prisma);
    expect(out).toHaveLength(2);
    expect(out[0].name).toBe("A");
    expect(out[0].emojis.map((e) => e.emoji)).toEqual(["🍎", "🍊"]);
    expect(out[1].name).toBe("B");
    expect(out[1].emojis).toEqual([]);
  });

  it("空用户 → 空数组", async () => {
    const u = await makeUser();
    const out = await listCategoriesCore(u.id, prisma);
    expect(out).toEqual([]);
  });

  it("只返回自己的", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await createCategoryCore(a.id, "A", prisma);
    await createCategoryCore(b.id, "B", prisma);
    const out = await listCategoriesCore(a.id, prisma);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("A");
  });
});
