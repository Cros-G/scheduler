"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteUserUploadsDir } from "@/lib/storage";
import {
  createUserCore,
  updateUserCore,
  resetPasswordCore,
  deleteUserCore,
} from "./actions-core";

export async function createUserAction(formData: FormData) {
  const user = await requireAdmin();
  const result = await createUserCore(
    user.id,
    {
      username: String(formData.get("username") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      password: String(formData.get("password") ?? ""),
      color: String(formData.get("color") ?? ""),
      isAdmin: formData.get("isAdmin") === "on" || formData.get("isAdmin") === "true",
    },
    prisma
  );
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function updateUserAction(targetId: number, formData: FormData) {
  const user = await requireAdmin();
  const result = await updateUserCore(
    user.id,
    targetId,
    {
      displayName: String(formData.get("displayName") ?? ""),
      color: String(formData.get("color") ?? ""),
      isAdmin: formData.get("isAdmin") === "on" || formData.get("isAdmin") === "true",
    },
    prisma
  );
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/admin");
  revalidatePath("/", "layout"); // displayName/color may show in nav for the target user
  return { ok: true as const };
}

export async function resetPasswordAction(targetId: number, newPassword: string) {
  const user = await requireAdmin();
  const result = await resetPasswordCore(user.id, targetId, newPassword, prisma);
  if (!result.ok) return { ok: false as const, error: result.error };
  revalidatePath("/admin");
  return { ok: true as const };
}

export async function deleteUserAction(targetId: number) {
  const user = await requireAdmin();
  const result = await deleteUserCore(user.id, targetId, prisma);
  if (!result.ok) return { ok: false as const, error: result.error };
  // Async cleanup of disk
  deleteUserUploadsDir(targetId).catch(() => {});
  revalidatePath("/admin");
  return { ok: true as const };
}
