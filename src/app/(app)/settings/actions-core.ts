import type { PrismaClient, User } from "@prisma/client";
import { COLOR_PALETTE } from "@/lib/task-validation";

export type Result<T> = { ok: true; user: T } | { ok: false; error: string };

const NAME_MAX = 30;

export async function updateProfileCore(
  userId: number,
  input: { displayName: string; color: string },
  prisma: PrismaClient
): Promise<Result<User>> {
  const name = (input.displayName ?? "").trim();
  if (name.length === 0) return { ok: false, error: "昵称不能为空" };
  if (name.length > NAME_MAX) return { ok: false, error: `昵称不能超过 ${NAME_MAX} 字` };
  if (!(COLOR_PALETTE as readonly string[]).includes(input.color)) {
    return { ok: false, error: "颜色必须从预设色板选择" };
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { displayName: name, color: input.color },
  });
  return { ok: true, user };
}
