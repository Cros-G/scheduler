import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  upsertNoteCore, deleteNoteImageCore, reorderNoteImagesCore,
} from "@/app/(app)/notes/actions-core";
import { hashPassword } from "@/lib/password";
import { COLOR_PALETTE } from "@/lib/task-validation";

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

describe("upsertNoteCore", () => {
  it("create new note", async () => {
    const u = await makeUser();
    const out = await upsertNoteCore(u.id, "2026-05-06", "今天很好", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.note.content).toBe("今天很好");
  });

  it("update existing note (same user, same date)", async () => {
    const u = await makeUser();
    await upsertNoteCore(u.id, "2026-05-06", "v1", prisma);
    const out = await upsertNoteCore(u.id, "2026-05-06", "v2", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.note.content).toBe("v2");
    const all = await prisma.dailyNote.findMany({ where: { userId: u.id } });
    expect(all).toHaveLength(1);
  });

  it("rejects bad date", async () => {
    const u = await makeUser();
    expect((await upsertNoteCore(u.id, "5/6/2026", "x", prisma)).ok).toBe(false);
  });

  it("rejects content > 10000", async () => {
    const u = await makeUser();
    expect((await upsertNoteCore(u.id, "2026-05-06", "a".repeat(10001), prisma)).ok).toBe(false);
  });

  it("two users, same date, separate notes", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await upsertNoteCore(a.id, "2026-05-06", "A note", prisma);
    await upsertNoteCore(b.id, "2026-05-06", "B note", prisma);
    const aNote = await prisma.dailyNote.findUnique({ where: { userId_date: { userId: a.id, date: "2026-05-06" } } });
    const bNote = await prisma.dailyNote.findUnique({ where: { userId_date: { userId: b.id, date: "2026-05-06" } } });
    expect(aNote!.content).toBe("A note");
    expect(bNote!.content).toBe("B note");
  });
});

describe("deleteNoteImageCore", () => {
  it("deletes own image, returns filePath", async () => {
    const u = await makeUser();
    const note = await prisma.dailyNote.create({ data: { userId: u.id, date: "2026-05-06", content: "" } });
    const img = await prisma.noteImage.create({
      data: { noteId: note.id, filePath: "uploads/x.jpg", originalName: "x.jpg", sizeBytes: 100, mimeType: "image/jpeg" },
    });
    const out = await deleteNoteImageCore(u.id, img.id, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.filePath).toBe("uploads/x.jpg");
    expect(await prisma.noteImage.findUnique({ where: { id: img.id } })).toBeNull();
  });

  it("rejects another user's image", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const note = await prisma.dailyNote.create({ data: { userId: a.id, date: "2026-05-06", content: "" } });
    const img = await prisma.noteImage.create({
      data: { noteId: note.id, filePath: "p", originalName: "p", sizeBytes: 1, mimeType: "image/png" },
    });
    expect((await deleteNoteImageCore(b.id, img.id, prisma)).ok).toBe(false);
  });

  it("missing image fails", async () => {
    const u = await makeUser();
    expect((await deleteNoteImageCore(u.id, 99999, prisma)).ok).toBe(false);
  });
});

describe("reorderNoteImagesCore", () => {
  it("reorders images", async () => {
    const u = await makeUser();
    const note = await prisma.dailyNote.create({ data: { userId: u.id, date: "2026-05-06", content: "" } });
    const i1 = await prisma.noteImage.create({ data: { noteId: note.id, filePath: "1", originalName: "1", sizeBytes: 1, mimeType: "image/png", sortOrder: 0 } });
    const i2 = await prisma.noteImage.create({ data: { noteId: note.id, filePath: "2", originalName: "2", sizeBytes: 1, mimeType: "image/png", sortOrder: 1 } });
    const out = await reorderNoteImagesCore(u.id, note.id, [i2.id, i1.id], prisma);
    expect(out.ok).toBe(true);
    const after = await prisma.noteImage.findMany({ where: { noteId: note.id }, orderBy: { sortOrder: "asc" } });
    expect(after.map((x) => x.id)).toEqual([i2.id, i1.id]);
  });

  it("rejects another user's note", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const note = await prisma.dailyNote.create({ data: { userId: a.id, date: "2026-05-06", content: "" } });
    expect((await reorderNoteImagesCore(b.id, note.id, [], prisma)).ok).toBe(false);
  });

  it("rejects mismatched id list", async () => {
    const u = await makeUser();
    const note = await prisma.dailyNote.create({ data: { userId: u.id, date: "2026-05-06", content: "" } });
    expect((await reorderNoteImagesCore(u.id, note.id, [1, 2], prisma)).ok).toBe(false);
  });
});
