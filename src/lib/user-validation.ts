export const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
export const DISPLAY_NAME_MAX = 30;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 100;

export function validateUsername(s: string) {
  if (!s) return { ok: false, error: "用户名不能为空" } as const;
  if (!USERNAME_RE.test(s)) return { ok: false, error: "用户名只能含字母数字下划线，长度 3-30" } as const;
  return { ok: true } as const;
}

export function validateDisplayName(s: string) {
  const t = (s ?? "").trim();
  if (t.length === 0) return { ok: false, error: "昵称不能为空" } as const;
  if (t.length > DISPLAY_NAME_MAX) return { ok: false, error: `昵称不能超过 ${DISPLAY_NAME_MAX} 字` } as const;
  return { ok: true } as const;
}

export function validatePassword(s: string) {
  if (!s || s.length < PASSWORD_MIN) return { ok: false, error: `密码至少 ${PASSWORD_MIN} 字符` } as const;
  if (s.length > PASSWORD_MAX) return { ok: false, error: `密码最多 ${PASSWORD_MAX} 字符` } as const;
  return { ok: true } as const;
}
