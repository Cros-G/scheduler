import path from "node:path";
import fs from "node:fs/promises";
import { requireAuthApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  validateImageMeta, validateDateKey,
  NOTE_IMAGES_MAX, NOTE_IMAGE_BYTES_MAX,
} from "@/lib/note-validation";
import { buildUploadPath, saveUpload, getUploadsRoot } from "@/lib/storage";

function bad(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  const userOrRes = await requireAuthApi();
  if (userOrRes instanceof Response) return userOrRes;
  const user = userOrRes;

  const form = await req.formData().catch(() => null);
  if (!form) return bad("请求格式错误");

  const date = String(form.get("date") ?? "");
  const dv = validateDateKey(date);
  if (!dv.ok) return bad(dv.error);

  const file = form.get("file");
  if (!(file instanceof File)) return bad("缺少文件");

  const mv = validateImageMeta({ mimeType: file.type, sizeBytes: file.size });
  if (!mv.ok) return bad(mv.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return bad("文件为空");
  if (buffer.length > NOTE_IMAGE_BYTES_MAX) return bad("单张图片不能超过 5MB");

  // First write to disk (no DB state yet, safe to bail on error)
  const { relPath, absPath } = buildUploadPath(user.id, date, file.type);
  try {
    await saveUpload(absPath, buffer);
  } catch (e) {
    console.error("upload write failed", e);
    return bad("文件保存失败", 500);
  }

  // Transaction: upsert note + check count + insert image. On error, rollback DB + delete disk file.
  try {
    const created = await prisma.$transaction(async (tx) => {
      const note = await tx.dailyNote.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: {},
        create: { userId: user.id, date, content: "" },
        include: { images: true },
      });
      if (note.images.length >= NOTE_IMAGES_MAX) {
        throw Object.assign(new Error("OVER_LIMIT"), { __reason: "OVER_LIMIT" });
      }
      const maxOrder = note.images.reduce((m, i) => Math.max(m, i.sortOrder), -1);
      return tx.noteImage.create({
        data: {
          noteId: note.id,
          filePath: relPath,
          originalName: file.name || "image",
          sizeBytes: buffer.length,
          mimeType: file.type,
          sortOrder: maxOrder + 1,
        },
      });
    });

    return Response.json({
      ok: true,
      image: { id: created.id, sortOrder: created.sortOrder },
    });
  } catch (e) {
    // Rollback disk
    fs.unlink(path.join(getUploadsRoot(), relPath)).catch((err) =>
      console.error("upload rollback unlink failed", relPath, err)
    );
    if (e && (e as { __reason?: string }).__reason === "OVER_LIMIT") {
      return bad(`每条心声最多 ${NOTE_IMAGES_MAX} 张图`);
    }
    console.error("upload tx failed", e);
    return bad("写入失败", 500);
  }
}
