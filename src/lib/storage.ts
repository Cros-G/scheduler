import path from "node:path";
import fs from "node:fs/promises";

export function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve(process.cwd(), "data");
}

export function getUploadsRoot(): string {
  return path.join(getDataDir(), "uploads");
}

export async function deleteNoteImageFromDisk(relPath: string): Promise<void> {
  const abs = path.join(getUploadsRoot(), relPath);
  await fs.unlink(abs).catch((err) => {
    console.error("delete upload failed", relPath, err);
  });
}
