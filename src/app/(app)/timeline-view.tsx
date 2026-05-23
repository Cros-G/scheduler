"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@prisma/client";
import { CHINESE_MONTHS, WEEKDAY_LABELS_CN, monthGrid, weekRange, shiftMonth } from "@/lib/dates";
import { DayDetailSheet } from "./day-detail-sheet";
import type { MultiUserDayData } from "./day-detail-sheet";
import type { NoteData } from "./note-editor";

type AggEntry = {
  taskId: number;
  name: string;
  icon: string;
  color: string;
  type: string;
  totalCount: number;
  occurrenceIds: number[];
};

interface UserLite {
  id: number;
  username: string;
  displayName: string;
  color: string;
}

// An event from a specific user, to be shown in a calendar cell
interface UserEvent {
  userId: number;
  userColor: string;
  taskId: number;
  name: string;
  icon: string;
  taskColor: string;
  type: string;
  totalCount: number;
}

interface TimelineViewProps {
  period: "month" | "week";
  /** Anchor date YYYY-MM-DD. For month mode it's always the 1st of the month. */
  anchorKey: string;
  rangeStart: string; // YYYY-MM-DD
  rangeEnd: string;   // YYYY-MM-DD
  viewerId: number;
  allUsers: UserLite[];
  tasks: Task[];
  /** userId -> dateKey -> aggregated entries */
  occurrencesByUserDate: Record<number, Record<string, AggEntry[]>>;
  /** userId -> dateKey -> NoteData */
  notesByUserDate: Record<number, Record<string, NoteData>>;
  todayKey: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Shift a YYYY-MM-DD by N days */
function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return fmtKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Build 7 cells from weekStart (Monday) */
function buildWeekCells(rangeStart: string): { key: string; day: number; inMonth: true }[] {
  const [y, m, d] = rangeStart.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(y, m - 1, d + i);
    const mo = date.getMonth() + 1;
    const dy = date.getDate();
    return {
      key: fmtKey(date.getFullYear(), mo, dy),
      day: dy,
      inMonth: true as const,
    };
  });
}

/** "5 月 4 日 — 10 日" or cross-month */
function weekLabel(start: string, end: string): string {
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  if (sm === em) return `${sm} 月 ${sd} 日 — ${ed} 日`;
  return `${sm} 月 ${sd} 日 — ${em} 月 ${ed} 日`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TimelineView({
  period,
  anchorKey,
  rangeStart,
  rangeEnd,
  viewerId,
  allUsers,
  tasks,
  occurrencesByUserDate,
  notesByUserDate,
  todayKey,
}: TimelineViewProps) {
  const router = useRouter();
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  // ── Calendar cells ───────────────────────────────────────────────────────
  const [ay, am] = anchorKey.split("-").map(Number);
  const cells =
    period === "week"
      ? buildWeekCells(rangeStart)
      : monthGrid(ay, am);

  // ── Labels ───────────────────────────────────────────────────────────────
  const periodLabel =
    period === "week"
      ? weekLabel(rangeStart, rangeEnd)
      : `${CHINESE_MONTHS[am - 1]} ${ay}`;

  // ── Navigation ───────────────────────────────────────────────────────────
  function navPrev() {
    if (period === "week") {
      router.push(`/timeline?period=week&d=${shiftDate(rangeStart, -7)}`);
    } else {
      const { year: ny, month: nm } = shiftMonth(ay, am, -1);
      router.push(`/timeline?y=${ny}&m=${nm}`);
    }
  }

  function navNext() {
    if (period === "week") {
      router.push(`/timeline?period=week&d=${shiftDate(rangeStart, 7)}`);
    } else {
      const { year: ny, month: nm } = shiftMonth(ay, am, 1);
      router.push(`/timeline?y=${ny}&m=${nm}`);
    }
  }

  function navToday() {
    if (period === "week") {
      router.push(`/timeline?period=week`);
    } else {
      router.push("/timeline");
    }
  }

  function switchToMonth() {
    const [y, m] = rangeStart.split("-").map(Number);
    router.push(`/timeline?y=${y}&m=${m}`);
  }

  function switchToWeek() {
    router.push(`/timeline?period=week&d=${rangeStart}`);
  }

  // ── Aggregation: merge all users' events per date ────────────────────────
  function getUserEvents(dateKey: string): UserEvent[] {
    const events: UserEvent[] = [];
    for (const user of allUsers) {
      const userOccs = occurrencesByUserDate[user.id]?.[dateKey] ?? [];
      for (const occ of userOccs) {
        events.push({
          userId: user.id,
          userColor: user.color,
          taskId: occ.taskId,
          name: occ.name,
          icon: occ.icon,
          taskColor: occ.color,
          type: occ.type,
          totalCount: occ.totalCount,
        });
      }
    }
    return events;
  }

  // Build multi-user data for the sheet on a specific date
  function buildMultiUserData(dateKey: string): MultiUserDayData[] {
    return allUsers
      .map((user) => ({
        user,
        occurrences: occurrencesByUserDate[user.id]?.[dateKey] ?? [],
        note: notesByUserDate[user.id]?.[dateKey] ?? null,
      }))
      .filter((d) => d.occurrences.length > 0 || d.note !== null);
  }

  const isWeek = period === "week";
  const MAX_ICONS = isWeek ? 6 : 4;

  // Sheet data
  const sheetMultiUserData = sheetDate ? buildMultiUserData(sheetDate) : [];

  return (
    <>
      <style>{`
        :root {
          --bg: oklch(97% 0.012 62);
          --bg-card: oklch(99% 0.006 62);
          --ink: oklch(22% 0.025 58);
          --ink-soft: oklch(46% 0.022 58);
          --ink-faint: oklch(68% 0.016 58);
          --accent: oklch(52% 0.12 38);
          --accent-hover: oklch(46% 0.14 38);
          --accent-light: oklch(94% 0.022 62);
          --border: oklch(88% 0.014 58);
          --border-mid: oklch(82% 0.016 58);
          --rule-color: oklch(90% 0.012 62);
          --ghost: oklch(93% 0.010 62);
        }

        .tl-root {
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: var(--ink);
          padding: 24px 20px 64px;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ── Top bar ── */
        .tl-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          flex-wrap: wrap;
        }

        .tl-period-label {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.5rem;
          font-weight: 400;
          letter-spacing: 0.08em;
          color: var(--ink);
          min-width: 120px;
        }

        .tl-nav-btn {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 4px;
          cursor: pointer;
          color: var(--ink-soft);
          font-size: 1rem;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          flex-shrink: 0;
        }

        .tl-nav-btn:hover {
          border-color: var(--border-mid);
          color: var(--ink);
          background: oklch(97% 0.010 62);
        }

        .tl-today-btn {
          padding: 6px 14px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 0.8125rem;
          color: var(--ink-soft);
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          white-space: nowrap;
        }

        .tl-today-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: oklch(96% 0.016 62);
        }

        /* ── Period toggle ── */
        .tl-period-toggle {
          display: inline-flex;
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
          margin-left: auto;
          flex-shrink: 0;
        }

        .tl-toggle-btn {
          padding: 5px 14px;
          font-size: 0.8125rem;
          font-family: inherit;
          letter-spacing: 0.04em;
          cursor: pointer;
          border: none;
          background: transparent;
          color: var(--ink-soft);
          transition: background 0.12s, color 0.12s;
          white-space: nowrap;
        }

        .tl-toggle-btn + .tl-toggle-btn {
          border-left: 1px solid var(--border);
        }

        .tl-toggle-btn:hover {
          background: oklch(95% 0.014 62);
          color: var(--ink);
        }

        .tl-toggle-btn.active {
          background: var(--accent);
          color: oklch(99% 0.004 62);
          font-weight: 500;
        }

        .tl-toggle-btn.active:hover {
          background: var(--accent-hover);
        }

        /* ── User legend ── */
        .tl-legend {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 16px;
          padding: 10px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 5px;
        }

        .tl-legend-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--ink-faint);
          letter-spacing: 0.06em;
          margin-right: 4px;
          flex-shrink: 0;
        }

        .tl-legend-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px 3px 7px;
          border-radius: 20px;
          border: 1px solid var(--border);
          background: oklch(98% 0.005 62);
          font-size: 0.75rem;
          color: var(--ink-soft);
          letter-spacing: 0.02em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .tl-legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .tl-legend-name {
          font-size: 0.75rem;
          letter-spacing: 0.02em;
        }

        /* ── Calendar grid ── */
        .tl-grid-wrap {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
        }

        .tl-grid-ruled {
          position: relative;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 97px,
            var(--rule-color) 97px,
            var(--rule-color) 98px
          );
        }

        .tl-grid-ruled.week-ruled {
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 239px,
            var(--rule-color) 239px,
            var(--rule-color) 240px
          );
        }

        .tl-weekday-headers {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-bottom: 1px solid var(--border);
          background: var(--ghost);
        }

        /* Use .tl-header-day-cell to keep E2E selectors working */
        .tl-header-day-cell {
          padding: 8px 0 7px;
          text-align: center;
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--ink-faint);
          letter-spacing: 0.06em;
        }

        .tl-header-day-cell:last-child {
          color: oklch(52% 0.06 28);
        }

        /* In week mode, weekday headers get this class too */
        .tl-header-day-cell.week-header {
          padding: 8px 8px 7px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .tl-header-day-cell.week-header .wh-date {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          opacity: 0.8;
          font-weight: 400;
        }

        .tl-header-day-cell.today-col {
          color: var(--accent);
          font-weight: 700;
          background: oklch(95% 0.024 60);
        }

        .tl-header-day-cell.today-col .wh-date {
          color: var(--accent);
        }

        .tl-cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }

        /* ── Day cells ── */
        .tl-day-cell {
          min-height: 90px;
          padding: 6px 5px 6px 5px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          position: relative;
          transition: background 0.12s;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .tl-day-cell:nth-child(7n) {
          border-right: none;
        }

        .tl-day-cell:nth-last-child(-n+7) {
          border-bottom: none;
        }

        .tl-day-cell:hover {
          background: oklch(95% 0.016 62);
        }

        .tl-day-cell.out-of-month {
          background: var(--ghost);
          cursor: default;
        }

        .tl-day-cell.out-of-month:hover {
          background: var(--ghost);
        }

        .tl-day-cell.today {
          background: oklch(95% 0.024 60);
        }

        .tl-day-cell.today:hover {
          background: oklch(92% 0.030 60);
        }

        .tl-day-cell.today::before {
          content: "";
          position: absolute;
          inset: 0;
          border: 1.5px solid oklch(60% 0.09 38 / 0.5);
          pointer-events: none;
        }

        /* Week mode: taller cells */
        .tl-day-cell.week-cell {
          min-height: 240px;
          border-bottom: none;
          padding: 8px 6px 10px;
          gap: 6px;
        }

        /* Week mode: no bottom border since only 1 row */
        .tl-day-cell.week-cell:nth-last-child(-n+7) {
          border-bottom: none;
        }

        .tl-day-num {
          font-size: 0.75rem;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          line-height: 1;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .tl-day-cell.today .tl-day-num {
          color: var(--accent);
          font-weight: 600;
        }

        .tl-day-cell.out-of-month .tl-day-num {
          color: var(--ink-faint);
          opacity: 0.5;
        }

        .tl-day-cell.week-cell .tl-day-num {
          font-size: 1rem;
        }

        /* Month label in week mode */
        .tl-day-month {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          letter-spacing: 0.02em;
        }

        /* View detail hover button */
        .tl-view-btn {
          margin-left: auto;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 1px solid var(--border-mid);
          background: var(--bg-card);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.5625rem;
          color: var(--ink-faint);
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s;
          flex-shrink: 0;
        }

        .tl-day-cell:hover .tl-view-btn {
          opacity: 1;
        }

        /* ── Icons area ── */
        .tl-icons-area {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
          flex: 1;
          align-content: flex-start;
        }

        /* User-ringed icon: emoji inside a subtle colored circle */
        .tl-user-icon {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px 4px 2px 2px;
          border-radius: 10px;
          font-size: 0.9375rem;
          line-height: 1;
          /* user ring: subtle fill + solid border in user color */
          border: 1.5px solid transparent;
          position: relative;
        }

        .tl-user-icon .tl-icon-badge {
          font-size: 0.5625rem;
          font-weight: 600;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .tl-user-icon .tl-icon-check {
          font-size: 0.625rem;
          color: oklch(42% 0.12 155);
          font-weight: 700;
        }

        /* Compact size for month mode */
        .tl-day-cell:not(.week-cell) .tl-user-icon {
          font-size: 0.8125rem;
          padding: 1px 3px 1px 2px;
          gap: 1px;
        }

        .tl-overflow-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 0.625rem;
          font-weight: 600;
          background: oklch(90% 0.014 62);
          color: var(--ink-faint);
          letter-spacing: 0.01em;
        }

        /* ── Note indicator ── */
        .tl-note-indicator {
          position: absolute;
          bottom: 5px;
          right: 5px;
          font-size: 0.625rem;
          color: oklch(58% 0.030 52);
          opacity: 0.62;
          pointer-events: none;
          user-select: none;
          transition: opacity 0.12s;
        }

        .tl-day-cell:hover .tl-note-indicator {
          opacity: 0.9;
        }

        /* Note dot for month mode (compact) */
        .tl-note-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: oklch(58% 0.030 52);
          opacity: 0.6;
          flex-shrink: 0;
          margin-top: auto;
          margin-bottom: 2px;
          align-self: flex-start;
        }

        /* Note preview in week cells */
        .tl-note-preview {
          font-size: 0.6875rem;
          color: oklch(52% 0.022 58);
          line-height: 1.5;
          letter-spacing: 0.01em;
          word-break: break-all;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin-top: auto;
          padding-top: 4px;
          opacity: 0.78;
          transition: opacity 0.12s;
        }

        .tl-day-cell:hover .tl-note-preview {
          opacity: 1;
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .tl-root { padding: 16px 10px 48px; }
          .tl-period-label { font-size: 1.25rem; }
          .tl-day-cell { min-height: 60px; padding: 4px 3px; }
          .tl-day-cell.week-cell { min-height: 140px; padding: 6px 4px 8px; }
          .tl-period-toggle { margin-left: 0; }
          .tl-user-icon { font-size: 0.75rem !important; }
        }

        @media (max-width: 400px) {
          .tl-day-cell { min-height: 48px; }
        }
      `}</style>

      <div className="tl-root">
        {/* ── Top bar ── */}
        <div className="tl-topbar">
          <button
            className="tl-nav-btn"
            onClick={navPrev}
            title={isWeek ? "上周" : "上个月"}
            aria-label={isWeek ? "上周" : "上个月"}
          >
            ←
          </button>
          <h1 className="tl-period-label">{periodLabel}</h1>
          <button
            className="tl-nav-btn"
            onClick={navNext}
            title={isWeek ? "下周" : "下个月"}
            aria-label={isWeek ? "下周" : "下个月"}
          >
            →
          </button>
          <button className="tl-today-btn" onClick={navToday}>
            今天
          </button>

          {/* Period toggle */}
          <div className="tl-period-toggle" role="group" aria-label="视图切换">
            <button
              className={`tl-toggle-btn${period === "month" ? " active" : ""}`}
              onClick={period === "month" ? undefined : switchToMonth}
              aria-pressed={period === "month"}
            >
              月
            </button>
            <button
              className={`tl-toggle-btn${period === "week" ? " active" : ""}`}
              onClick={period === "week" ? undefined : switchToWeek}
              aria-pressed={period === "week"}
            >
              周
            </button>
          </div>
        </div>

        {/* ── User legend ── */}
        <div className="tl-legend" aria-label="成员图例">
          <span className="tl-legend-label">成员</span>
          {allUsers.map((user) => (
            <div key={user.id} className="tl-legend-chip">
              <span
                className="tl-legend-dot"
                style={{ background: user.color }}
                aria-hidden="true"
              />
              <span className="tl-legend-name" style={{ color: user.color }}>
                {user.displayName}
              </span>
            </div>
          ))}
        </div>

        {/* ── Calendar grid ── */}
        <div className="tl-grid-wrap" aria-label={`${periodLabel}合并日历`}>
          {/* Weekday headers */}
          <div className="tl-weekday-headers" aria-hidden="true">
            {WEEKDAY_LABELS_CN.map((label, idx) => {
              if (isWeek) {
                const cell = (cells as ReturnType<typeof buildWeekCells>)[idx];
                const isToday = cell?.key === todayKey;
                return (
                  <div
                    key={label}
                    className={`tl-header-day-cell week-header${isToday ? " today-col" : ""}`}
                  >
                    <span>{label}</span>
                    {cell && (
                      <span className="wh-date">
                        {Number(cell.key.split("-")[1])}/{String(cell.day).padStart(2, "0")}
                      </span>
                    )}
                  </div>
                );
              }
              return (
                <div key={label} className="tl-header-day-cell">
                  {label}
                </div>
              );
            })}
          </div>

          {/* Calendar cells */}
          <div className={`tl-grid-ruled${isWeek ? " week-ruled" : ""}`}>
            <div className="tl-cal-grid" role="grid">
              {cells.map((cell, idx) => {
                if (cell === null) {
                  return (
                    <div
                      key={`empty-${idx}`}
                      className="tl-day-cell out-of-month"
                      aria-hidden="true"
                    />
                  );
                }

                const isToday = cell.key === todayKey;
                const events = getUserEvents(cell.key);

                // Collect any notes across all users for note indicator
                const hasAnyNote = allUsers.some((u) => {
                  const note = notesByUserDate[u.id]?.[cell.key];
                  return !!note && (
                    (note.content && note.content.length > 0) ||
                    note.images.length > 0
                  );
                });

                // Collect first note content for week mode preview
                let weekNotePreview: string | null = null;
                if (isWeek && hasAnyNote) {
                  for (const u of allUsers) {
                    const note = notesByUserDate[u.id]?.[cell.key];
                    if (note?.content && note.content.length > 0) {
                      const text = note.content;
                      weekNotePreview = text.length > 50 ? text.slice(0, 50) + "…" : text;
                      break;
                    }
                  }
                }

                const displayEvents = events.slice(0, MAX_ICONS);
                const overflow = events.length - MAX_ICONS;

                const cellClasses = [
                  "tl-day-cell",
                  isWeek ? "week-cell" : "",
                  isToday ? "today" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                return (
                  <div
                    key={cell.key}
                    className={cellClasses}
                    role="gridcell"
                    aria-label={`${cell.day}日`}
                    onClick={() => setSheetDate(cell.key)}
                  >
                    <div className="tl-day-num">
                      {isWeek && (
                        <span className="tl-day-month">{Number(cell.key.split("-")[1])} 月</span>
                      )}
                      <span>{cell.day}</span>
                      <button
                        className="tl-view-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSheetDate(cell.key);
                        }}
                        title="查看详情"
                        aria-label={`查看 ${cell.day} 日详情`}
                      >
                        ···
                      </button>
                    </div>

                    {/* Event icons with user-color rings */}
                    <div className="tl-icons-area">
                      {displayEvents.map((ev, evIdx) => {
                        const isCheck = ev.type === "CHECK";
                        // Ring: semi-transparent fill + solid border of user color
                        const fillOpacity = "18"; // ~10% opacity in hex
                        const ringColor = ev.userColor;
                        return (
                          <div
                            key={`${ev.userId}-${ev.taskId}-${evIdx}`}
                            className="tl-user-icon"
                            style={{
                              background: `${ringColor}${fillOpacity}`,
                              borderColor: ringColor,
                            }}
                            title={`${allUsers.find((u) => u.id === ev.userId)?.displayName ?? "?"} · ${ev.name}`}
                          >
                            <span>{ev.icon}</span>
                            {isCheck ? (
                              <span className="tl-icon-check">✓</span>
                            ) : ev.totalCount >= 2 ? (
                              <span className="tl-icon-badge">·{ev.totalCount}</span>
                            ) : null}
                          </div>
                        );
                      })}
                      {overflow > 0 && (
                        <div className="tl-overflow-chip">+{overflow}</div>
                      )}
                    </div>

                    {/* Note indicators */}
                    {hasAnyNote && !isWeek && (
                      <span className="tl-note-dot" aria-label="有心声记录" />
                    )}
                    {isWeek && weekNotePreview && (
                      <div className="tl-note-preview">{weekNotePreview}</div>
                    )}
                    {hasAnyNote && !isWeek && (
                      <span
                        className="tl-note-indicator"
                        aria-label="有心声记录"
                      >
                        ✎
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Day detail sheet — multi-user readonly mode */}
      {sheetDate !== null && (
        <DayDetailSheet
          date={sheetDate}
          occurrences={[]}
          tasks={[]}
          note={null}
          onClose={() => setSheetDate(null)}
          readonly={true}
          multiUserData={sheetMultiUserData}
        />
      )}
    </>
  );
}
