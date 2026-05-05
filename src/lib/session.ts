import crypto from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(
  userId: number,
  prisma: PrismaClient = defaultPrisma
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      id: token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return token;
}

export async function validateSession(
  token: string,
  prisma: PrismaClient = defaultPrisma
): Promise<User | null> {
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  // Sliding renewal
  await prisma.session.update({
    where: { id: token },
    data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
  });
  return session.user;
}

export async function destroySession(
  token: string,
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => {});
}
