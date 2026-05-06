"use server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateProfileCore } from "./actions-core";

export async function updateProfileAction(formData: FormData) {
  const user = await requireAuth();
  const result = await updateProfileCore(
    user.id,
    {
      displayName: String(formData.get("displayName") ?? ""),
      color: String(formData.get("color") ?? ""),
    },
    prisma
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/", "layout"); // 刷新 layout 中的欢迎语
  return { ok: true };
}
