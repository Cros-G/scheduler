"use client";

import { useRouter } from "next/navigation";
import type { TaskStatsRow, StreakRow, HeatmapDay } from "@/lib/stats";
import { colorBucket } from "@/lib/stats";
import { CHINESE_MONTHS } from "@/lib/dates";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StatsViewProps {
  period: "year" | "month" | "week";
  anchorKey: string;   // YYYY-MM-DD
  rangeStart: string;
  rangeEnd: string;
  taskStats: TaskStatsRow[];
  streaks: StreakRow[];
  heatmap: HeatmapDay[];
  todayKey: string;
}

// ── Color buckets ─────────────────────────────────────────────────────────────

const BUCKET_COLORS = [
  "oklch(93% 0.010 62)",   // 0: empty
  "oklch(82% 0.07 38)",    // 1: light
  "oklch(70% 0.11 38)",    // 2: medium-light
  "oklch(57% 0.14 38)",    // 3: medium-dark
  "oklch(44% 0.17 38)",    // 4: dark
] as const;

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(k: string, n: number): string {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return formatK(d);
}

function formatK(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function daysInRange(start: string, end: string): number {
  const s = parseKey(start);
  const e = parseKey(end);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

// ── Period navigation helpers ─────────────────────────────────────────────────

function prevAnchor(period: "year" | "month" | "week", anchorKey: string): string {
  if (period === "year") {
    const y = parseInt(anchorKey.slice(0, 4), 10) - 1;
    return `${y}-01-01`;
  }
  if (period === "month") {
    const [y, m] = anchorKey.split("-").map(Number);
    const total = y * 12 + m - 2; // go back 1
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${String(nm).padStart(2, "0")}-01`;
  }
  // week
  return addDays(anchorKey, -7);
}

function nextAnchor(period: "year" | "month" | "week", anchorKey: string): string {
  if (period === "year") {
    const y = parseInt(anchorKey.slice(0, 4), 10) + 1;
    return `${y}-01-01`;
  }
  if (period === "month") {
    const [y, m] = anchorKey.split("-").map(Number);
    const total = y * 12 + m; // go forward 1 (0-indexed months +1 = next)
    const ny = Math.floor(total / 12);
    const nm = (total % 12) + 1;
    return `${ny}-${String(nm).padStart(2, "0")}-01`;
  }
  // week
  return addDays(anchorKey, 7);
}

function periodLabel(period: "year" | "month" | "week", anchorKey: string, rangeStart: string, rangeEnd: string): string {
  if (period === "year") {
    return `${anchorKey.slice(0, 4)} 年`;
  }
  if (period === "month") {
    const [y, m] = anchorKey.split("-").map(Number);
    return `${y} 年 ${CHINESE_MONTHS[m - 1]}`;
  }
  // week
  const s = parseKey(rangeStart);
  const e = parseKey(rangeEnd);
  return `${s.getMonth() + 1}月${s.getDate()}日 — ${e.getMonth() + 1}月${e.getDate()}日`;
}

function buildUrl(period: "year" | "month" | "week", anchor: string): string {
  return `/stats?period=${period}&d=${anchor}`;
}

// ── Overview card ─────────────────────────────────────────────────────────────

function OverviewCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="sv-card">
      <div className="sv-card-value">{value}</div>
      <div className="sv-card-label">{label}</div>
      {sub && <div className="sv-card-sub">{sub}</div>}
    </div>
  );
}

// ── Task bars ─────────────────────────────────────────────────────────────────

function TaskBars({
  taskStats,
  rangeStart,
  rangeEnd,
}: {
  taskStats: TaskStatsRow[];
  rangeStart: string;
  rangeEnd: string;
}) {
  const totalDays = daysInRange(rangeStart, rangeEnd);
  const active = taskStats.filter((r) => r.totalCount > 0);
  const rows = active.length > 0 ? active : taskStats.slice(0, 1); // show first if all zero

  if (taskStats.length === 0) {
    return (
      <div className="sv-empty">
        <span className="sv-empty-icon">📋</span>
        <p>还没有任务，先去创建几个吧</p>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="sv-empty">
        <span className="sv-empty-icon">🌱</span>
        <p>这个周期内还没有记录</p>
      </div>
    );
  }

  const maxCount = Math.max(...active.map((r) => r.totalCount), 1);

  return (
    <div className="sv-bars">
      {active
        .sort((a, b) => b.totalCount - a.totalCount)
        .map((row) => {
          const pct = row.totalCount / maxCount;
          const isCheck = row.taskType === "CHECK";

          return (
            <div key={row.taskId} className="sv-bar-row">
              <div className="sv-bar-meta">
                <span className="sv-bar-icon">{row.taskIcon}</span>
                <span className="sv-bar-name">{row.taskName}</span>
                <span className="sv-bar-count">
                  {isCheck
                    ? `${row.totalCount} 天`
                    : `${row.totalCount} 次`}
                </span>
              </div>
              <div className="sv-bar-track">
                <svg
                  width="100%"
                  height="12"
                  viewBox="0 0 200 12"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {/* Track */}
                  <rect
                    x="0"
                    y="2"
                    width="200"
                    height="8"
                    fill="oklch(91% 0.012 62)"
                    rx="2"
                  />
                  {/* Fill */}
                  <rect
                    x="0"
                    y="2"
                    width={Math.max(pct * 200, 2)}
                    height="8"
                    fill={row.taskColor}
                    rx="2"
                    opacity="0.85"
                  />
                </svg>
              </div>
              {/* Target hit rate for COUNTED tasks */}
              {!isCheck &&
                row.targetHitRate !== null &&
                row.taskTargetCount !== null && (
                  <div className="sv-bar-hitrate">
                    达成率{" "}
                    <span style={{ color: row.taskColor, fontWeight: 600 }}>
                      {Math.round(row.targetHitRate * 100)}%
                    </span>
                  </div>
                )}
            </div>
          );
        })}
    </div>
  );
}

// ── Streak list ───────────────────────────────────────────────────────────────

function StreakList({ streaks }: { streaks: StreakRow[] }) {
  const checkStreaks = streaks.filter(
    (r) => r.currentStreak > 0 || r.longestStreak > 0
  );

  if (checkStreaks.length === 0) {
    return (
      <div className="sv-empty">
        <span className="sv-empty-icon">🔥</span>
        <p>暂无打卡记录</p>
      </div>
    );
  }

  return (
    <div className="sv-streaks">
      {checkStreaks
        .sort((a, b) =>
          b.currentStreak !== a.currentStreak
            ? b.currentStreak - a.currentStreak
            : b.longestStreak - a.longestStreak
        )
        .map((row) => (
          <div key={row.taskId} className="sv-streak-row">
            <span className="sv-streak-icon">{row.taskIcon}</span>
            <span className="sv-streak-name">{row.taskName}</span>
            <span className="sv-streak-stats">
              <span className="sv-streak-current" style={{ color: row.taskColor }}>
                {row.currentStreak > 0 ? `🔥 ${row.currentStreak} 天` : "未在打"}
              </span>
              <span className="sv-streak-sep">·</span>
              <span className="sv-streak-longest">
                最长 {row.longestStreak} 天
              </span>
            </span>
          </div>
        ))}
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────

function Heatmap({
  heatmap,
  period,
}: {
  heatmap: HeatmapDay[];
  period: "year" | "month" | "week";
  rangeStart?: string;
}) {
  if (period === "week") {
    // For week, show a simple 7-cell row
    return (
      <div className="sv-heatmap-week">
        {heatmap.map((day) => {
          const bucket = colorBucket(day.totalCount);
          const [, mm, dd] = day.date.split("-");
          return (
            <div key={day.date} className="sv-heatmap-week-cell">
              <div
                className="sv-heatmap-cell-square"
                style={{ background: BUCKET_COLORS[bucket] }}
                title={`${parseInt(mm)}月${parseInt(dd)}日: ${day.totalCount} 次`}
              />
              <div className="sv-heatmap-week-label">
                {parseInt(mm)}/{parseInt(dd)}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  if (period === "month") {
    // Month grid: calendar layout (Mon-Sun)
    const firstDate = parseKey(heatmap[0]?.date ?? "2026-01-01");
    // Mon=0..Sun=6
    const firstWeekdayMon = (firstDate.getDay() + 6) % 7;
    const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

    const cells: (HeatmapDay | null)[] = [
      ...Array(firstWeekdayMon).fill(null),
      ...heatmap,
    ];
    // Pad to full weeks
    while (cells.length % 7 !== 0) cells.push(null);

    const cols = cells.length / 7;
    const svgW = cols * 14 + (cols - 1) * 2;
    const svgH = 7 * 14 + 6 * 2;

    return (
      <div className="sv-heatmap-month">
        <div className="sv-heatmap-weekdays">
          {WEEKDAY_LABELS.map((l) => (
            <span key={l} className="sv-heatmap-weekday-label">{l}</span>
          ))}
        </div>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW * 2}
          height={svgH * 2}
          style={{ maxWidth: "100%", height: "auto" }}
        >
          {cells.map((day, i) => {
            const col = Math.floor(i / 7);
            const row = i % 7;
            const x = col * 16;
            const y = row * 16;
            if (!day) {
              return (
                <rect
                  key={`empty-${i}`}
                  x={x}
                  y={y}
                  width="14"
                  height="14"
                  fill="transparent"
                  rx="2"
                />
              );
            }
            const bucket = colorBucket(day.totalCount);
            const [, mm, dd] = day.date.split("-");
            return (
              <rect
                key={day.date}
                x={x}
                y={y}
                width="14"
                height="14"
                fill={BUCKET_COLORS[bucket]}
                rx="2"
              >
                <title>{parseInt(mm)}月{parseInt(dd)}日: {day.totalCount} 次</title>
              </rect>
            );
          })}
        </svg>
      </div>
    );
  }

  // Year: GitHub-style 53 columns × 7 rows
  // Each column = one week (Mon-Sun). First column starts at Jan 1's weekday.
  const firstDate = parseKey(heatmap[0]?.date ?? "2026-01-01");
  const firstWeekdayMon = (firstDate.getDay() + 6) % 7; // 0=Mon..6=Sun

  // Build a grid: prefixed with null cells for alignment
  const grid: (HeatmapDay | null)[] = [
    ...Array(firstWeekdayMon).fill(null),
    ...heatmap,
  ];
  // Pad to multiple of 7
  while (grid.length % 7 !== 0) grid.push(null);

  const numCols = grid.length / 7;
  const CELL = 11;
  const GAP = 2;
  const svgW = numCols * (CELL + GAP) - GAP;
  const svgH = 7 * (CELL + GAP) - GAP;

  // Month labels: find col of each month's first appearance
  const monthCols: { col: number; label: string }[] = [];
  for (let i = firstWeekdayMon; i < grid.length; i++) {
    const day = grid[i];
    if (!day) continue;
    const [, mm, dd] = day.date.split("-");
    if (parseInt(dd) <= 7) {
      const col = Math.floor(i / 7);
      const last = monthCols[monthCols.length - 1];
      if (!last || last.col < col - 1) {
        monthCols.push({ col, label: `${parseInt(mm)}月` });
      }
    }
  }

  return (
    <div className="sv-heatmap-year">
      <svg
        viewBox={`0 0 ${svgW} ${svgH + 16}`}
        width="100%"
        style={{ display: "block" }}
      >
        {/* Month labels */}
        {monthCols.map(({ col, label }) => (
          <text
            key={label}
            x={col * (CELL + GAP)}
            y="10"
            fontSize="7"
            fill="oklch(58% 0.018 58)"
            fontFamily="system-ui, sans-serif"
          >
            {label}
          </text>
        ))}
        {/* Cells */}
        {grid.map((day, i) => {
          const col = Math.floor(i / 7);
          const row = i % 7;
          const x = col * (CELL + GAP);
          const y = 16 + row * (CELL + GAP);
          if (!day) {
            return (
              <rect
                key={`empty-${i}`}
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                fill="transparent"
                rx="1.5"
              />
            );
          }
          const bucket = colorBucket(day.totalCount);
          const [, mm, dd] = day.date.split("-");
          return (
            <rect
              key={day.date}
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              fill={BUCKET_COLORS[bucket]}
              rx="1.5"
            >
              <title>{parseInt(mm)}月{parseInt(dd)}日: {day.totalCount} 次</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

// ── HeatmapLegend ─────────────────────────────────────────────────────────────

function HeatmapLegend() {
  return (
    <div className="sv-heatmap-legend">
      <span className="sv-legend-label">少</span>
      {BUCKET_COLORS.map((color, i) => (
        <div
          key={i}
          className="sv-legend-cell"
          style={{ background: color }}
          title={`等级 ${i}`}
        />
      ))}
      <span className="sv-legend-label">多</span>
    </div>
  );
}

// ── Section heading ───────────────────────────────────────────────────────────

function SectionHead({ title }: { title: string }) {
  return (
    <div className="sv-section-head">
      <h2 className="sv-section-title">{title}</h2>
      <div className="sv-section-rule" aria-hidden="true" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StatsView({
  period,
  anchorKey,
  rangeStart,
  rangeEnd,
  taskStats,
  streaks,
  heatmap,
  todayKey,
}: StatsViewProps) {
  const router = useRouter();

  function navigate(newPeriod: "year" | "month" | "week", anchor: string) {
    router.push(buildUrl(newPeriod, anchor));
  }

  const prev = prevAnchor(period, anchorKey);
  const next = nextAnchor(period, anchorKey);
  const label = periodLabel(period, anchorKey, rangeStart, rangeEnd);

  // Overview calculations
  const totalEvents = taskStats.reduce((s, r) => s + r.totalCount, 0);
  const activeTasks = taskStats.filter((r) => r.totalCount > 0).length;
  const activeDays = heatmap.filter((d) => d.totalCount > 0).length;
  const totalDays = daysInRange(rangeStart, rangeEnd);
  const avgPerDay = totalDays > 0 ? (totalEvents / totalDays).toFixed(1) : "0";

  // Check tasks for streak section
  const hasCheckTasks = streaks.length > 0;

  const PERIODS: { label: string; value: "year" | "month" | "week" }[] = [
    { label: "年", value: "year" },
    { label: "月", value: "month" },
    { label: "周", value: "week" },
  ];

  return (
    <>
      <style>{`
        /* ── Root ───────────────────────────────────────────────────── */
        .sv-root {
          max-width: 780px;
          margin: 0 auto;
          padding: 28px 24px 80px;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(22% 0.025 58);
        }

        /* ── Page header ─────────────────────────────────────────────── */
        .sv-page-header {
          margin-bottom: 28px;
          padding-bottom: 20px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          position: relative;
        }

        .sv-page-header::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 27px,
            oklch(88% 0.014 58 / 0.5) 27px,
            oklch(88% 0.014 58 / 0.5) 28px
          );
          pointer-events: none;
          border-radius: 4px;
        }

        .sv-page-title {
          position: relative;
          z-index: 1;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.75rem;
          font-weight: 400;
          color: oklch(22% 0.025 58);
          letter-spacing: 0.08em;
          margin: 0 0 4px;
          line-height: 1.3;
        }

        .sv-page-subtitle {
          position: relative;
          z-index: 1;
          font-size: 0.875rem;
          color: oklch(56% 0.018 58);
          margin: 0;
          letter-spacing: 0.03em;
        }

        /* ── Top bar ─────────────────────────────────────────────────── */
        .sv-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
          flex-wrap: wrap;
        }

        /* Period toggle */
        .sv-period-toggle {
          display: flex;
          background: oklch(94% 0.010 62);
          border: 1px solid oklch(86% 0.014 58);
          border-radius: 6px;
          overflow: hidden;
          flex-shrink: 0;
        }

        .sv-period-btn {
          padding: 5px 14px;
          font-size: 0.8125rem;
          color: oklch(50% 0.020 58);
          font-family: inherit;
          background: transparent;
          border: none;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: background 0.12s, color 0.12s;
          outline: none;
          line-height: 1.4;
        }

        .sv-period-btn:hover {
          color: oklch(28% 0.025 58);
          background: oklch(90% 0.014 62);
        }

        .sv-period-btn[data-active="true"] {
          background: oklch(52% 0.12 38);
          color: oklch(98% 0.005 62);
          font-weight: 500;
        }

        .sv-period-btn:focus-visible {
          box-shadow: 0 0 0 2px oklch(52% 0.12 38 / 0.4);
        }

        /* Nav buttons */
        .sv-nav {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .sv-nav-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          background: transparent;
          border: 1px solid oklch(86% 0.014 58);
          border-radius: 4px;
          font-size: 0.875rem;
          color: oklch(44% 0.022 58);
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          outline: none;
        }

        .sv-nav-btn:hover {
          border-color: oklch(66% 0.022 58);
          color: oklch(28% 0.025 58);
          background: oklch(95% 0.010 62);
        }

        .sv-nav-btn:focus-visible {
          box-shadow: 0 0 0 2px oklch(52% 0.12 38 / 0.4);
        }

        .sv-nav-today-btn {
          padding: 4px 11px;
          background: transparent;
          border: 1px solid oklch(86% 0.014 58);
          border-radius: 4px;
          font-size: 0.8125rem;
          color: oklch(44% 0.022 58);
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          outline: none;
          white-space: nowrap;
        }

        .sv-nav-today-btn:hover {
          border-color: oklch(52% 0.12 38);
          color: oklch(52% 0.12 38);
          background: oklch(52% 0.12 38 / 0.06);
        }

        .sv-nav-today-btn:focus-visible {
          box-shadow: 0 0 0 2px oklch(52% 0.12 38 / 0.4);
        }

        /* Period label */
        .sv-period-label {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.0625rem;
          color: oklch(32% 0.025 58);
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        /* ── Overview cards ──────────────────────────────────────────── */
        .sv-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 36px;
        }

        .sv-card {
          padding: 16px 18px;
          background: oklch(98.5% 0.006 62);
          border: 1px solid oklch(88% 0.014 58);
          border-radius: 6px;
          min-width: 0;
        }

        .sv-card-value {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 2rem;
          font-weight: 400;
          color: oklch(26% 0.025 58);
          line-height: 1.1;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
          margin-bottom: 4px;
        }

        .sv-card-label {
          font-size: 0.8125rem;
          color: oklch(54% 0.018 58);
          letter-spacing: 0.03em;
        }

        .sv-card-sub {
          font-size: 0.75rem;
          color: oklch(62% 0.016 58);
          margin-top: 2px;
        }

        /* ── Section ──────────────────────────────────────────────────── */
        .sv-section {
          margin-bottom: 40px;
        }

        .sv-section-head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .sv-section-title {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.0625rem;
          font-weight: 400;
          color: oklch(32% 0.025 58);
          letter-spacing: 0.06em;
          margin: 0;
          white-space: nowrap;
        }

        .sv-section-rule {
          flex: 1;
          height: 1px;
          background: oklch(88% 0.014 58);
        }

        /* ── Task bars ────────────────────────────────────────────────── */
        .sv-bars {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .sv-bar-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
        }

        .sv-bar-meta {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }

        .sv-bar-icon {
          font-size: 1rem;
          line-height: 1;
          flex-shrink: 0;
        }

        .sv-bar-name {
          font-size: 0.875rem;
          color: oklch(32% 0.022 58);
          letter-spacing: 0.02em;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sv-bar-count {
          font-size: 0.8125rem;
          color: oklch(52% 0.018 58);
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .sv-bar-track {
          width: 100%;
        }

        .sv-bar-hitrate {
          font-size: 0.75rem;
          color: oklch(56% 0.016 58);
          letter-spacing: 0.02em;
        }

        /* ── Streak list ───────────────────────────────────────────────── */
        .sv-streaks {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sv-streak-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: oklch(98% 0.006 62);
          border: 1px solid oklch(90% 0.012 58);
          border-radius: 5px;
        }

        .sv-streak-icon {
          font-size: 1.125rem;
          flex-shrink: 0;
        }

        .sv-streak-name {
          font-size: 0.875rem;
          color: oklch(32% 0.022 58);
          letter-spacing: 0.02em;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sv-streak-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
          font-size: 0.8125rem;
        }

        .sv-streak-current {
          font-weight: 500;
        }

        .sv-streak-sep {
          color: oklch(72% 0.014 58);
        }

        .sv-streak-longest {
          color: oklch(54% 0.018 58);
        }

        /* ── Heatmap ──────────────────────────────────────────────────── */
        .sv-heatmap-year {
          overflow-x: auto;
          padding-bottom: 4px;
        }

        .sv-heatmap-month {
          display: inline-block;
        }

        .sv-heatmap-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 28px);
          gap: 4px;
          margin-bottom: 4px;
        }

        .sv-heatmap-weekday-label {
          font-size: 0.6875rem;
          color: oklch(58% 0.016 58);
          text-align: center;
          letter-spacing: 0.04em;
        }

        .sv-heatmap-week {
          display: flex;
          gap: 8px;
        }

        .sv-heatmap-week-cell {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .sv-heatmap-cell-square {
          width: 32px;
          height: 32px;
          border-radius: 4px;
        }

        .sv-heatmap-week-label {
          font-size: 0.6875rem;
          color: oklch(56% 0.016 58);
        }

        .sv-heatmap-legend {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 10px;
        }

        .sv-legend-label {
          font-size: 0.6875rem;
          color: oklch(58% 0.016 58);
        }

        .sv-legend-cell {
          width: 12px;
          height: 12px;
          border-radius: 2px;
        }

        /* ── Empty state ─────────────────────────────────────────────── */
        .sv-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 32px 16px;
          color: oklch(58% 0.016 58);
          font-size: 0.875rem;
          text-align: center;
          letter-spacing: 0.03em;
        }

        .sv-empty p {
          margin: 0;
        }

        .sv-empty-icon {
          font-size: 2rem;
          opacity: 0.6;
        }

        /* ── Responsive ──────────────────────────────────────────────── */
        @media (max-width: 600px) {
          .sv-root {
            padding: 20px 16px 64px;
          }

          .sv-overview {
            grid-template-columns: repeat(2, 1fr);
          }

          .sv-card-value {
            font-size: 1.625rem;
          }

          .sv-topbar {
            gap: 8px;
          }
        }

        @media (max-width: 400px) {
          .sv-overview {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      <div className="sv-root">
        {/* ── Page header ── */}
        <div className="sv-page-header">
          <h1 className="sv-page-title">统计</h1>
          <p className="sv-page-subtitle">
            量化你的坚持，一眼看懂每个周期的节奏
          </p>
        </div>

        {/* ── Top bar ── */}
        <div className="sv-topbar">
          {/* Period toggle */}
          <div className="sv-period-toggle" role="group" aria-label="周期选择">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                className="sv-period-btn"
                data-active={period === p.value ? "true" : "false"}
                onClick={() => navigate(p.value, anchorKey)}
                aria-pressed={period === p.value}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Prev / Next / Today */}
          <div className="sv-nav">
            <button
              type="button"
              className="sv-nav-btn"
              aria-label="上一个周期"
              onClick={() => navigate(period, prev)}
            >
              ‹
            </button>
            <button
              type="button"
              className="sv-nav-btn"
              aria-label="下一个周期"
              onClick={() => navigate(period, next)}
            >
              ›
            </button>
            <button
              type="button"
              className="sv-nav-today-btn"
              onClick={() => navigate(period, todayKey)}
            >
              现在
            </button>
          </div>

          {/* Label */}
          <span className="sv-period-label">{label}</span>
        </div>

        {/* ── Overview cards ── */}
        <div className="sv-overview" aria-label="本期概览">
          <OverviewCard label="总事件数" value={totalEvents} />
          <OverviewCard label="活跃任务" value={activeTasks} />
          <OverviewCard label="涉及天数" value={activeDays} />
          <OverviewCard label="日均事件" value={avgPerDay} sub={`/ ${totalDays} 天`} />
        </div>

        {/* ── Task bars ── */}
        <div className="sv-section">
          <SectionHead title="任务统计" />
          <TaskBars
            taskStats={taskStats}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
          />
        </div>

        {/* ── Streak (year/month only) ── */}
        {period !== "week" && hasCheckTasks && (
          <div className="sv-section">
            <SectionHead title="打卡 Streak" />
            <StreakList streaks={streaks} />
          </div>
        )}

        {/* ── Heatmap ── */}
        <div className="sv-section">
          <SectionHead title="活跃日历" />
          <Heatmap heatmap={heatmap} period={period} rangeStart={rangeStart} />
          <HeatmapLegend />
        </div>
      </div>
    </>
  );
}
