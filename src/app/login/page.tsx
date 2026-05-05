import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const errorMessage =
    error === "invalid"
      ? "用户名或密码错误"
      : error !== undefined
      ? "登录失败，请重试"
      : null;

  // ── Dynamic mini-calendar (server-time, TZ=Asia/Shanghai) ──
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const today = now.getDate();
  // firstDay: 0=Sun … 6=Sat. Convert to Mon-based offset (0=Mon … 6=Sun).
  const firstDayRaw = new Date(year, month, 1).getDay(); // 0=Sun
  const firstDay = (firstDayRaw + 6) % 7; // 0=Mon … 6=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const chineseMonths = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"];
  const monthLabel = chineseMonths[month];

  // Decorative emoji days: today-2 and today-5 (clamped to valid range)
  const emojiDay1 = today - 2 >= 1 ? today - 2 : today + 3; // 🍎
  const emojiDay2 = today - 5 >= 1 ? today - 5 : today + 6 <= daysInMonth ? today + 6 : 1; // 🏃
  // Dot days: today-1, today-4
  const dotDay1 = today - 1 >= 1 ? today - 1 : null;
  const dotDay2 = today - 4 >= 1 ? today - 4 : null;

  // Build flat cell array: leading empties + day cells
  type CalCell = { type: "empty" } | { type: "day"; day: number };
  const cells: CalCell[] = [];
  for (let i = 0; i < firstDay; i++) cells.push({ type: "empty" });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ type: "day", day: d });
  // Pad to a multiple of 7
  while (cells.length % 7 !== 0) cells.push({ type: "empty" });

  return (
    <>
      <style>{`
        :root {
          --bg: oklch(97% 0.012 62);
          --bg-left: oklch(93% 0.018 58);
          --ink: oklch(22% 0.025 58);
          --ink-soft: oklch(46% 0.022 58);
          --ink-faint: oklch(68% 0.016 58);
          --accent: oklch(52% 0.12 38);
          --accent-hover: oklch(46% 0.14 38);
          --accent-active: oklch(41% 0.14 38);
          --accent-ring: oklch(62% 0.10 38 / 0.35);
          --border: oklch(82% 0.016 58);
          --border-focus: oklch(52% 0.12 38);
          --input-bg: oklch(99% 0.006 62);
          --error-bg: oklch(96% 0.025 28);
          --error-text: oklch(38% 0.14 28);
          --error-border: oklch(72% 0.08 28);
          --rule-color: oklch(88% 0.014 58);
        }

        * { box-sizing: border-box; }

        .login-root {
          min-height: 100dvh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: var(--bg);
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: var(--ink);
        }

        /* ─── LEFT PANEL ─── */
        .login-left {
          background: var(--bg-left);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 64px 48px;
          position: relative;
          overflow: hidden;
        }

        /* Ruled-paper lines behind the journal art */
        .login-left::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 35px,
            var(--rule-color) 35px,
            var(--rule-color) 36px
          );
          opacity: 0.6;
        }

        .journal-art {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          max-width: 320px;
        }

        /* Mini calendar grid made entirely in CSS */
        .cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 32px);
          gap: 4px;
          padding: 20px;
          background: oklch(99% 0.008 62);
          border-radius: 3px;
          box-shadow: 0 2px 8px oklch(22% 0.02 58 / 0.08), 0 0 0 1px var(--border);
        }

        .cal-header-cell {
          font-size: 0.625rem;
          font-weight: 600;
          color: var(--ink-soft);
          text-align: center;
          letter-spacing: 0.04em;
          padding: 2px 0;
        }

        .cal-cell {
          width: 32px;
          height: 32px;
          border-radius: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: var(--ink-soft);
          position: relative;
          font-variant-numeric: tabular-nums;
        }

        .cal-cell.today {
          background: var(--accent);
          color: oklch(99% 0.006 62);
          font-weight: 600;
          border-radius: 50%;
        }

        .cal-cell.has-dot::after {
          content: "";
          position: absolute;
          bottom: 3px;
          left: 50%;
          transform: translateX(-50%);
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--accent);
          opacity: 0.55;
        }

        .cal-cell.today::after { display: none; }

        .cal-cell.emoji-cell {
          font-size: 1rem;
          color: inherit;
        }

        .journal-tagline {
          text-align: center;
        }

        .journal-tagline h2 {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.375rem;
          font-weight: 400;
          color: var(--ink);
          line-height: 1.6;
          margin: 0 0 8px;
          letter-spacing: 0.05em;
        }

        .journal-tagline p {
          font-size: 0.8125rem;
          color: var(--ink-faint);
          line-height: 1.7;
          margin: 0;
          letter-spacing: 0.03em;
        }

        /* ─── RIGHT PANEL ─── */
        .login-right {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 64px 56px;
          max-width: 480px;
          width: 100%;
          margin: 0 auto;
        }

        .login-heading {
          margin: 0 0 6px;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 2rem;
          font-weight: 400;
          letter-spacing: 0.08em;
          color: var(--ink);
          line-height: 1.2;
        }

        .login-subheading {
          margin: 0 0 40px;
          font-size: 0.875rem;
          color: var(--ink-soft);
          line-height: 1.6;
          letter-spacing: 0.02em;
        }

        /* Error banner */
        .error-banner {
          margin-bottom: 24px;
          padding: 12px 16px;
          background: var(--error-bg);
          border: 1px solid var(--error-border);
          border-radius: 4px;
          color: var(--error-text);
          font-size: 0.875rem;
          line-height: 1.5;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .error-icon {
          flex-shrink: 0;
          width: 16px;
          height: 16px;
          opacity: 0.75;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .field label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--ink-soft);
          letter-spacing: 0.03em;
        }

        .field input {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          padding: 10px 14px;
          background: var(--input-bg);
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 0.9375rem;
          color: var(--ink);
          font-family: inherit;
          line-height: 1.5;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
        }

        .field input::placeholder {
          color: var(--ink-faint);
        }

        .field input:hover {
          border-color: oklch(70% 0.02 58);
        }

        .field input:focus-visible {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 3px var(--accent-ring);
        }

        .field input:-webkit-autofill,
        .field input:-webkit-autofill:hover,
        .field input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 40px var(--input-bg) inset;
          -webkit-text-fill-color: var(--ink);
        }

        /* Submit button */
        .submit-btn {
          margin-top: 8px;
          padding: 11px 20px;
          background: var(--accent);
          color: oklch(99% 0.006 62);
          border: none;
          border-radius: 4px;
          font-size: 0.9375rem;
          font-weight: 500;
          font-family: inherit;
          letter-spacing: 0.06em;
          cursor: pointer;
          transition:
            background-color 0.12s ease,
            transform 0.1s ease,
            box-shadow 0.12s ease;
          outline: none;
          width: 100%;
        }

        .submit-btn:hover {
          background: var(--accent-hover);
          box-shadow: 0 2px 8px oklch(52% 0.12 38 / 0.25);
        }

        .submit-btn:focus-visible {
          box-shadow: 0 0 0 3px var(--accent-ring);
        }

        .submit-btn:active {
          background: var(--accent-active);
          transform: translateY(1px);
          box-shadow: none;
        }

        /* Footer note */
        .login-footer {
          margin-top: 32px;
          font-size: 0.75rem;
          color: var(--ink-faint);
          letter-spacing: 0.02em;
        }

        /* ─── RESPONSIVE ─── */
        @media (max-width: 720px) {
          .login-root {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
          }

          .login-left {
            padding: 40px 32px 32px;
          }

          .cal-grid {
            display: none;
          }

          .journal-tagline h2 {
            font-size: 1.125rem;
          }

          .login-right {
            padding: 40px 32px 56px;
          }

          .login-heading {
            font-size: 1.625rem;
          }
        }

        @media (max-width: 400px) {
          .login-left { padding: 28px 20px; }
          .login-right { padding: 28px 20px 48px; }
        }
      `}</style>

      <div className="login-root">
        {/* ── Left decorative panel ── */}
        <aside className="login-left" aria-hidden="true">
          <div className="journal-art">
            <div className="cal-grid" role="presentation">
              {/* Month caption spanning full row */}
              <div style={{ gridColumn: "1 / -1", textAlign: "center", fontSize: "0.6875rem", fontWeight: 600, color: "var(--ink-soft)", letterSpacing: "0.06em", paddingBottom: "4px" }}>
                {monthLabel}
              </div>
              {/* Day-of-week headers: Mon … Sun */}
              {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                <div key={d} className="cal-header-cell">{d}</div>
              ))}
              {/* Day cells */}
              {cells.map((cell, idx) => {
                if (cell.type === "empty") {
                  return <div key={`e-${idx}`} className="cal-cell" />;
                }
                const d = cell.day;
                const isToday = d === today;
                const isEmoji1 = d === emojiDay1;
                const isEmoji2 = d === emojiDay2;
                const hasDot = !isToday && (d === dotDay1 || d === dotDay2);
                const classes = [
                  "cal-cell",
                  isToday ? "today" : "",
                  hasDot ? "has-dot" : "",
                  (isEmoji1 || isEmoji2) && !isToday ? "emoji-cell" : "",
                ].filter(Boolean).join(" ");
                return (
                  <div key={d} className={classes}>
                    {isEmoji1 && !isToday ? "🍎" : isEmoji2 && !isToday ? "🏃" : d}
                  </div>
                );
              })}
            </div>

            <div className="journal-tagline">
              <h2>把每一天，轻轻记下来</h2>
              <p>
                苹果一颗、跑步一圈、心声一行
                <br />
                小圈子里，日子有了形状
              </p>
            </div>
          </div>
        </aside>

        {/* ── Right form panel ── */}
        <main className="login-right">
          <h1 className="login-heading">登录</h1>
          <p className="login-subheading">欢迎回来，继续记录今天</p>

          {errorMessage && (
            <div className="error-banner" role="alert">
              <svg
                className="error-icon"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
              </svg>
              {errorMessage}
            </div>
          )}

          <form action="/api/login" method="POST" className="login-form">
            <div className="field">
              <label htmlFor="username">用户名</label>
              <input
                id="username"
                name="username"
                type="text"
                required
                autoComplete="username"
                placeholder="输入用户名"
              />
            </div>

            <div className="field">
              <label htmlFor="password">密码</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="输入密码"
              />
            </div>

            <button type="submit" className="submit-btn">
              登录
            </button>
          </form>

          <p className="login-footer">
            账号由管理员创建，如需帮助请联系圈主
          </p>
        </main>
      </div>
    </>
  );
}
