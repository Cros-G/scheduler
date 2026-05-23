import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listCategoriesCore } from "@/app/(app)/emojis/actions-core";
import { EmojiManageView } from "./emoji-manage-view";
import { BUILT_IN_EMOJI_CATEGORIES } from "@/lib/emoji-constants";

export default async function EmojisPage() {
  const user = await requireAuth();
  const customCategories = await listCategoriesCore(user.id, prisma);

  return (
    <EmojiManageView
      customCategories={customCategories.map((c) => ({
        id: c.id,
        name: c.name,
        emojis: c.emojis.map((e) => ({ id: e.id, emoji: e.emoji })),
      }))}
      builtInCategories={BUILT_IN_EMOJI_CATEGORIES}
    />
  );
}
