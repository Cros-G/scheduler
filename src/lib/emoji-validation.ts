export const CATEGORY_NAME_MAX = 20;
export const EMOJI_MAX_LENGTH = 8;
export const CATEGORIES_PER_USER_MAX = 20;
export const EMOJIS_PER_CATEGORY_MAX = 200;

export function validateCategoryName(s: string) {
  const t = (s ?? "").trim();
  if (t.length === 0) return { ok: false, error: "分类名不能为空" } as const;
  if (t.length > CATEGORY_NAME_MAX) {
    return { ok: false, error: `分类名不能超过 ${CATEGORY_NAME_MAX} 字` } as const;
  }
  return { ok: true } as const;
}

export function validateEmoji(s: string) {
  if (!s || s.length === 0) return { ok: false, error: "Emoji 不能为空" } as const;
  if (s.length > EMOJI_MAX_LENGTH) {
    return { ok: false, error: `Emoji 不能超过 ${EMOJI_MAX_LENGTH} 字符` } as const;
  }
  return { ok: true } as const;
}
