import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NavBar } from "./nav-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await requireAuth();

  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true, color: true },
    orderBy: { displayName: "asc" },
  });

  return (
    <div style={{ minHeight: "100dvh", background: "oklch(97% 0.012 62)" }}>
      <NavBar currentUser={currentUser} allUsers={allUsers} />
      <main>{children}</main>
    </div>
  );
}
