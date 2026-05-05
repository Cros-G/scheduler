import { requireAuth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white px-6 py-3 flex justify-between items-center">
        <span className="font-semibold">日历记账</span>
        <div className="flex items-center gap-3 text-sm">
          <span>
            欢迎，<span style={{ color: user.color }}>{user.displayName}</span>
          </span>
          <form action="/api/logout" method="POST">
            <button type="submit" className="text-neutral-600 hover:underline">
              登出
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
