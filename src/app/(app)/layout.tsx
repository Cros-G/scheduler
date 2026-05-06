import { requireAuth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return (
    <div style={{ minHeight: "100dvh", background: "oklch(97% 0.012 62)" }}>
      <style>{`
        .app-header {
          background: oklch(99% 0.008 62);
          border-bottom: 1px solid oklch(88% 0.014 58);
          padding: 0 24px;
          height: 52px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .app-logo {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.0625rem;
          font-weight: 400;
          color: oklch(34% 0.025 58);
          letter-spacing: 0.08em;
          text-decoration: none;
        }
        .app-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.875rem;
          color: oklch(46% 0.022 58);
        }
        .app-logout-btn {
          padding: 4px 12px;
          background: transparent;
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.8125rem;
          color: oklch(46% 0.022 58);
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: border-color 0.12s, color 0.12s;
        }
        .app-logout-btn:hover {
          border-color: oklch(62% 0.022 58);
          color: oklch(32% 0.025 58);
        }
      `}</style>

      <header className="app-header">
        <a href="/" className="app-logo">日历记账</a>
        <div className="app-header-right">
          <span>
            你好，
            <span style={{ color: user.color, fontWeight: 500 }}>
              {user.displayName}
            </span>
          </span>
          <form action="/api/logout" method="POST">
            <button type="submit" className="app-logout-btn">登出</button>
          </form>
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
