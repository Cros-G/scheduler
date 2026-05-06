import type { PrismaClient, User } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { validateUsername, validateDisplayName, validatePassword } from "@/lib/user-validation";
import { COLOR_PALETTE } from "@/lib/task-validation";

export type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

interface CreateInput {
  username: string;
  displayName: string;
  password: string;
  color: string;
  isAdmin: boolean;
}

interface UpdateInput {
  displayName: string;
  color: string;
  isAdmin: boolean;
}

async function ensureCallerIsAdmin(callerId: number, prisma: PrismaClient) {
  const caller = await prisma.user.findUnique({ where: { id: callerId } });
  if (!caller) return { ok: false as const, error: "调用者不存在" };
  if (!caller.isAdmin) return { ok: false as const, error: "无权限：仅管理员可以执行此操作" };
  return { ok: true as const };
}

function validateColor(color: string) {
  if (!(COLOR_PALETTE as readonly string[]).includes(color)) {
    return { ok: false as const, error: "颜色必须从预设色板选择" };
  }
  return { ok: true as const };
}

export async function createUserCore(
  callerId: number,
  input: CreateInput,
  prisma: PrismaClient
): Promise<Result<{ user: User }>> {
  const auth = await ensureCallerIsAdmin(callerId, prisma);
  if (!auth.ok) return auth;

  const uv = validateUsername(input.username);
  if (!uv.ok) return uv;
  const dv = validateDisplayName(input.displayName);
  if (!dv.ok) return dv;
  const pv = validatePassword(input.password);
  if (!pv.ok) return pv;
  const cv = validateColor(input.color);
  if (!cv.ok) return cv;

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await prisma.user.create({
      data: {
        username: input.username,
        displayName: input.displayName.trim(),
        passwordHash,
        color: input.color,
        isAdmin: input.isAdmin,
      },
    });
    return { ok: true, user };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "用户名已存在" };
    }
    throw e;
  }
}

export async function updateUserCore(
  callerId: number,
  targetId: number,
  input: UpdateInput,
  prisma: PrismaClient
): Promise<Result<{ user: User }>> {
  const auth = await ensureCallerIsAdmin(callerId, prisma);
  if (!auth.ok) return auth;

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false, error: "用户不存在" };

  const dv = validateDisplayName(input.displayName);
  if (!dv.ok) return dv;
  const cv = validateColor(input.color);
  if (!cv.ok) return cv;

  // Self-protection: can't demote self
  if (callerId === targetId && target.isAdmin && !input.isAdmin) {
    return { ok: false, error: "不能取消自己的管理员标记" };
  }

  // Last-admin protection
  if (target.isAdmin && !input.isAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return { ok: false, error: "至少需要一个管理员，无法取消" };
    }
  }

  const user = await prisma.user.update({
    where: { id: targetId },
    data: {
      displayName: input.displayName.trim(),
      color: input.color,
      isAdmin: input.isAdmin,
    },
  });
  return { ok: true, user };
}

export async function resetPasswordCore(
  callerId: number,
  targetId: number,
  newPassword: string,
  prisma: PrismaClient
): Promise<Result<{ user: User }>> {
  const auth = await ensureCallerIsAdmin(callerId, prisma);
  if (!auth.ok) return auth;

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false, error: "用户不存在" };

  const pv = validatePassword(newPassword);
  if (!pv.ok) return pv;

  const passwordHash = await hashPassword(newPassword);
  const result = await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: targetId } });
    return tx.user.update({ where: { id: targetId }, data: { passwordHash } });
  });
  return { ok: true, user: result };
}

export async function deleteUserCore(
  callerId: number,
  targetId: number,
  prisma: PrismaClient
): Promise<Result<{ deletedUserId: number }>> {
  const auth = await ensureCallerIsAdmin(callerId, prisma);
  if (!auth.ok) return auth;

  // Self-protection: can't delete self
  if (callerId === targetId) {
    return { ok: false, error: "不能删除自己的账号" };
  }

  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) return { ok: false, error: "用户不存在" };

  // Last-admin protection
  if (target.isAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return { ok: false, error: "至少需要一个管理员，无法删除最后一个" };
    }
  }

  await prisma.user.delete({ where: { id: targetId } });
  return { ok: true, deletedUserId: targetId };
}
