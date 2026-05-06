import { describe, it, expect } from "vitest";
import {
  validateNoteContent, validateDateKey, validateImageMeta,
  NOTE_CONTENT_MAX, NOTE_IMAGES_MAX, NOTE_IMAGE_BYTES_MAX, ALLOWED_MIME,
} from "@/lib/note-validation";

describe("validateNoteContent", () => {
  it("空字符串通过", () => {
    expect(validateNoteContent("")).toEqual({ ok: true });
  });
  it("非字符串失败", () => {
    expect(validateNoteContent(null as unknown as string).ok).toBe(false);
  });
  it(`超 ${NOTE_CONTENT_MAX} 字失败`, () => {
    expect(validateNoteContent("a".repeat(NOTE_CONTENT_MAX + 1)).ok).toBe(false);
  });
  it(`恰好 ${NOTE_CONTENT_MAX} 字通过`, () => {
    expect(validateNoteContent("a".repeat(NOTE_CONTENT_MAX)).ok).toBe(true);
  });
});

describe("validateDateKey", () => {
  it("通过 YYYY-MM-DD", () => { expect(validateDateKey("2026-05-06").ok).toBe(true); });
  it("拒绝 5/6/2026", () => { expect(validateDateKey("5/6/2026").ok).toBe(false); });
  it("拒绝空", () => { expect(validateDateKey("").ok).toBe(false); });
});

describe("validateImageMeta", () => {
  it("png 1KB 通过", () => {
    expect(validateImageMeta({ mimeType: "image/png", sizeBytes: 1024 }).ok).toBe(true);
  });
  it("jpeg 5MB 通过", () => {
    expect(validateImageMeta({ mimeType: "image/jpeg", sizeBytes: NOTE_IMAGE_BYTES_MAX }).ok).toBe(true);
  });
  it("超 5MB 失败", () => {
    expect(validateImageMeta({ mimeType: "image/jpeg", sizeBytes: NOTE_IMAGE_BYTES_MAX + 1 }).ok).toBe(false);
  });
  it("0 bytes 失败", () => {
    expect(validateImageMeta({ mimeType: "image/png", sizeBytes: 0 }).ok).toBe(false);
  });
  it("不支持的 mime 失败", () => {
    expect(validateImageMeta({ mimeType: "image/svg+xml", sizeBytes: 100 }).ok).toBe(false);
  });
});

describe("constants", () => {
  it("NOTE_IMAGES_MAX = 6", () => { expect(NOTE_IMAGES_MAX).toBe(6); });
  it("ALLOWED_MIME 含 4 种", () => { expect(ALLOWED_MIME).toHaveLength(4); });
});
