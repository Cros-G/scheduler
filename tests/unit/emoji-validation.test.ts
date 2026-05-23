import { describe, it, expect } from "vitest";
import {
  validateCategoryName, validateEmoji,
  CATEGORY_NAME_MAX, EMOJI_MAX_LENGTH,
  CATEGORIES_PER_USER_MAX, EMOJIS_PER_CATEGORY_MAX,
} from "@/lib/emoji-validation";

describe("validateCategoryName", () => {
  it("正常分类名 → ok", () => { expect(validateCategoryName("我的最爱").ok).toBe(true); });
  it("英文 ok", () => { expect(validateCategoryName("Favorites").ok).toBe(true); });
  it("空 → 失败", () => { expect(validateCategoryName("").ok).toBe(false); });
  it("trim 空白 → 失败", () => { expect(validateCategoryName("   ").ok).toBe(false); });
  it(`> ${CATEGORY_NAME_MAX} 字 → 失败`, () => {
    expect(validateCategoryName("a".repeat(CATEGORY_NAME_MAX + 1)).ok).toBe(false);
  });
  it(`恰好 ${CATEGORY_NAME_MAX} 字 → ok`, () => {
    expect(validateCategoryName("a".repeat(CATEGORY_NAME_MAX)).ok).toBe(true);
  });
});

describe("validateEmoji", () => {
  it("单字符 emoji ok", () => { expect(validateEmoji("🍎").ok).toBe(true); });
  it("组合 emoji (ZWJ) ok", () => { expect(validateEmoji("🧘‍♀️").ok).toBe(true); });
  it("空 → 失败", () => { expect(validateEmoji("").ok).toBe(false); });
  it(`> ${EMOJI_MAX_LENGTH} 字符 → 失败`, () => {
    expect(validateEmoji("a".repeat(EMOJI_MAX_LENGTH + 1)).ok).toBe(false);
  });
  // 允许任何 ≤8 字符的字符串作为 emoji（不做严格 Unicode emoji 检查）
  it("普通字母 'A' 也接受（不强校验）", () => { expect(validateEmoji("A").ok).toBe(true); });
});

describe("constants", () => {
  it("CATEGORY_NAME_MAX", () => { expect(CATEGORY_NAME_MAX).toBe(20); });
  it("EMOJI_MAX_LENGTH", () => { expect(EMOJI_MAX_LENGTH).toBe(8); });
  it("CATEGORIES_PER_USER_MAX", () => { expect(CATEGORIES_PER_USER_MAX).toBe(20); });
  it("EMOJIS_PER_CATEGORY_MAX", () => { expect(EMOJIS_PER_CATEGORY_MAX).toBe(200); });
});
