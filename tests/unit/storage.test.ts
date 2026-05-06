import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildUploadPath, saveUpload, readUpload, deleteNoteImageFromDisk, getUploadsRoot } from "@/lib/storage";
import path from "node:path";
import fs from "node:fs/promises";

const TEST_DATA = path.resolve(process.cwd(), "test-data/storage-test");
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;

beforeEach(() => {
  process.env.DATA_DIR = TEST_DATA;
});

afterEach(async () => {
  process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  await fs.rm(TEST_DATA, { recursive: true, force: true });
});

describe("buildUploadPath", () => {
  it("produces userId/YYYY-MM/uuid.ext", () => {
    const p = buildUploadPath(7, "2026-05-06", "image/png");
    expect(p.relPath).toMatch(/^7\/2026-05\/[0-9a-f]{32}\.png$/);
    expect(p.absPath).toContain(p.relPath);
  });

  it("falls back to bin for unknown mime", () => {
    const p = buildUploadPath(1, "2026-05-06", "image/svg+xml");
    expect(p.relPath).toMatch(/\.bin$/);
  });

  it("uses correct extension for each MIME", () => {
    expect(buildUploadPath(1, "2026-05-06", "image/jpeg").relPath).toMatch(/\.jpg$/);
    expect(buildUploadPath(1, "2026-05-06", "image/webp").relPath).toMatch(/\.webp$/);
    expect(buildUploadPath(1, "2026-05-06", "image/gif").relPath).toMatch(/\.gif$/);
  });
});

describe("save / read / delete roundtrip", () => {
  it("saves and reads a buffer; deletes it", async () => {
    const buf = Buffer.from("hello");
    const { relPath, absPath } = buildUploadPath(1, "2026-05-06", "image/png");
    await saveUpload(absPath, buf);
    const back = await readUpload(relPath);
    expect(back?.equals(buf)).toBe(true);
    await deleteNoteImageFromDisk(relPath);
    expect(await readUpload(relPath)).toBeNull();
  });

  it("readUpload returns null for missing file", async () => {
    expect(await readUpload("nonexistent/path.png")).toBeNull();
  });

  it("deleteNoteImageFromDisk on missing file does not throw", async () => {
    await expect(deleteNoteImageFromDisk("nonexistent/x.png")).resolves.toBeUndefined();
  });
});
