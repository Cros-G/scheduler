import { requireAuthApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readUpload } from "@/lib/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAuthApi();
  if (userOrRes instanceof Response) return userOrRes;

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) return new Response("Bad request", { status: 400 });

  const img = await prisma.noteImage.findUnique({ where: { id } });
  if (!img) return new Response("Not found", { status: 404 });

  // MVP: 心声圈内可见。Plan 5 加 isPrivate 时再加过滤。
  const buf = await readUpload(img.filePath);
  if (!buf) return new Response("Not found on disk", { status: 404 });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(img.sizeBytes),
    },
  });
}
