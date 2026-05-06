export const NOTE_CONTENT_MAX = 10000;
export const NOTE_IMAGES_MAX = 6;
export const NOTE_IMAGE_BYTES_MAX = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ALLOWED_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateNoteContent(content: string) {
  if (typeof content !== "string") return { ok: false, error: "内容必须是字符串" } as const;
  if (content.length > NOTE_CONTENT_MAX) return { ok: false, error: `内容不能超过 ${NOTE_CONTENT_MAX} 字` } as const;
  return { ok: true } as const;
}

export function validateDateKey(date: string) {
  if (!DATE_RE.test(date)) return { ok: false, error: "日期格式错误" } as const;
  return { ok: true } as const;
}

export function validateImageMeta(meta: { mimeType: string; sizeBytes: number }) {
  if (!(ALLOWED_MIME as readonly string[]).includes(meta.mimeType)) {
    return { ok: false, error: "不支持的图片格式（仅 jpg/png/webp/gif）" } as const;
  }
  if (meta.sizeBytes <= 0) return { ok: false, error: "文件为空" } as const;
  if (meta.sizeBytes > NOTE_IMAGE_BYTES_MAX) {
    return { ok: false, error: "单张图片不能超过 5MB" } as const;
  }
  return { ok: true } as const;
}
