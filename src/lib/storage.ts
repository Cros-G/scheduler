import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { ALLOWED_EXT } from "./note-validation";

export function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve(process.cwd(), "data");
}

export function getUploadsRoot(): string {
  return path.join(getDataDir(), "uploads");
}

export function buildUploadPath(userId: number, dateKey: string, mimeType: string): {
  relPath: string;
  absPath: string;
} {
  const ext = ALLOWED_EXT[mimeType] || "bin";
  const yyyymm = dateKey.slice(0, 7);
  const id = crypto.randomBytes(16).toString("hex");
  const relPath = `${userId}/${yyyymm}/${id}.${ext}`;
  const absPath = path.join(getUploadsRoot(), relPath);
  return { relPath, absPath };
}

export async function saveUpload(absPath: string, buffer: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buffer);
}

export async function readUpload(relPath: string): Promise<Buffer | null> {
  const abs = path.join(getUploadsRoot(), relPath);
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

export async function deleteNoteImageFromDisk(relPath: string): Promise<void> {
  const abs = path.join(getUploadsRoot(), relPath);
  await fs.unlink(abs).catch((err) => {
    console.error("delete upload failed", relPath, err);
  });
}

export async function deleteUserUploadsDir(userId: number): Promise<void> {
  const dir = path.join(getUploadsRoot(), String(userId));
  await fs.rm(dir, { recursive: true, force: true }).catch((err) => {
    console.error("delete user uploads dir failed", userId, err);
  });
}
