"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@prisma/client";
import { CHINESE_MONTHS, WEEKDAY_LABELS_CN } from "@/lib/dates";
import { DayDetailSheet } from "./day-detail-sheet";
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

interface SheetState {
  date: string;
  userId: number;
  readonly: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function fmtKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Shift a YYYY-MM-DD by N days */
function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return fmtKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Build ordered day keys for month mode */
function buildMonthColumns(anchorKey: string): { key: string; label: string }[] {
  const [y, m] = anchorKey.split("-").map(Number);
  const n = daysInMonth(y, m);
  return Array.from({ length: n }, (_, i) => {
    const day = i + 1;
    return { key: fmtKey(y, m, day), label: String(day) };
  });
}

/** Build ordered day keys for week mode (Mon→Sun) */
function buildWeekColumns(rangeStart: string): { key: string; label: string }[] {
  const [y, m, d] = rangeStart.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(y, m - 1, d + i);
    const mo = date.getMonth() + 1;
    const dy = date.getDate();
    return {
      key: fmtKey(date.getFullYear(), mo, dy),
      label: `${String(mo).padStart(2, "0")}/${String(dy).padStart(2, "0")}`,
    };
  });
}

/** "5 月 4 日 — 10 日" or cross-month "5 月 30 日 — 6 月 5 日" */
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
  const [sheetState, setSheetState] = useState<SheetState | null>(null);

  // ── Column definitions ───────────────────────────────────────────────────
  const columns =
    period === "week"
      ? buildWeekColumns(rangeStart)
      : buildMonthColumns(anchorKey);

  // ── Labels ───────────────────────────────────────────────────────────────
  const [ay, am] = anchorKey.split("-").map(Number);
  const periodLabel =
    period === "week"
      ? weekLabel(rangeStart, rangeEnd)
      : `${CHINESE_MONTHS[am - 1]} ${ay}`;

  // ── Navigation ───────────────────────────────────────────────────────────
  function navPrev() {
    if (period === "week") {
      const prev = shiftDate(rangeStart, -7);
      router.push(`/timeline?period=week&d=${prev}`);
    } else {
      const total = ay * 12 + (am - 1) - 1;
      const ny = Math.floor(total / 12);
      const nm = (total % 12) + 1;
      router.push(`/timeline?y=${ny}&m=${nm}`);
    }
  }

  function navNext() {
    if (period === "week") {
      const next = shiftDate(rangeStart, 7);
      router.push(`/timeline?period=week&d=${next}`);
    } else {
      const total = ay * 12 + (am - 1) + 1;
      const ny = Math.floor(total / 12);
      const nm = (total % 12) + 1;
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

  // ── Toggle period ────────────────────────────────────────────────────────
  function switchToMonth() {
    // Use first day of rangeStart's month as anchor
    const [y, m] = rangeStart.split("-").map(Number);
    router.push(`/timeline?y=${y}&m=${m}`);
  }

  function switchToWeek() {
    // Use rangeStart (first day of current range) as anchor
    router.push(`/timeline?period=week&d=${rangeStart}`);
  }

  // ── Cell click ───────────────────────────────────────────────────────────
  function handleCellClick(userId: number, dateKey: string) {
    const isOwn = userId === viewerId;
    setSheetState({ date: dateKey, userId, readonly: !isOwn });
  }

  // ── Data helpers ─────────────────────────────────────────────────────────
  function getUserOccs(userId: number, dateKey: string): AggEntry[] {
    return occurrencesByUserDate[userId]?.[dateKey] ?? [];
  }

  function getUserNote(userId: number, dateKey: string): NoteData | null {
    return notesByUserDate[userId]?.[dateKey] ?? null;
  }

  const sheetOccs = sheetState ? getUserOccs(sheetState.userId, sheetState.date) : [];
  const sheetNote = sheetState ? getUserNote(sheetState.userId, sheetState.date) : null;
  const sheetUserTasks = sheetState
    ? sheetState.readonly
      ? []
      : tasks.filter((t) => t.userId === sheetState.userId)
    : [];

  const isWeek = period === "week";

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
          --accent-ring: oklch(62% 0.10 38 / 0.35);
          --border: oklch(88% 0.014 58);
          --border-mid: oklch(82% 0.016 58);
          --rule-color: oklch(90% 0.012 62);
          --ghost: oklch(93% 0.010 62);
        }

        .tl-root {
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: var(--ink);
          padding: 24px 20px 64px;
          max-width: 1200px;
          margin: 0 auto;
        }

        /* ── Top bar ── */
        .tl-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
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

        /* ── Period toggle group ── */
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

        /* ── Sub-label ── */
        .tl-subtitle {
          font-size: 0.8125rem;
          color: var(--ink-faint);
          letter-spacing: 0.04em;
          margin-bottom: 20px;
        }

        /* ── Grid wrapper: scroll horizontally on narrow screens ── */
        .tl-grid-outer {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg-card);
        }

        /* ── The actual table ── */
        .tl-table {
          display: grid;
          min-width: max-content;
        }

        /* header row: user-col + day numbers */
        .tl-header-row {
          display: contents;
        }

        .tl-header-user-cell {
          grid-column: 1;
          padding: 8px 14px 7px;
          background: var(--ghost);
          border-bottom: 1px solid var(--border);
          border-right: 1px solid var(--border);
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--ink-faint);
          letter-spacing: 0.06em;
          text-align: left;
          white-space: nowrap;
          position: sticky;
          left: 0;
          z-index: 2;
        }

        /* Month mode header cells */
        .tl-header-day-cell {
          padding: 8px 0 7px;
          background: var(--ghost);
          border-bottom: 1px solid var(--border);
          border-right: 1px solid oklch(91% 0.012 62);
          text-align: center;
          font-size: 0.6875rem;
          font-weight: 500;
          color: var(--ink-faint);
          letter-spacing: 0.04em;
          min-width: 32px;
        }

        /* Week mode header cells */
        .tl-header-day-cell.week-header {
          min-width: 130px;
          padding: 8px 8px 7px;
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .tl-header-day-cell.week-header .wh-weekday {
          font-size: 0.6875rem;
          font-weight: 700;
          color: var(--ink-faint);
          letter-spacing: 0.08em;
        }

        .tl-header-day-cell.week-header .wh-date {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          opacity: 0.8;
        }

        .tl-header-day-cell.today-col {
          color: var(--accent);
          font-weight: 700;
          background: oklch(95% 0.024 60);
        }

        .tl-header-day-cell.today-col .wh-weekday,
        .tl-header-day-cell.today-col .wh-date {
          color: var(--accent);
        }

        .tl-header-day-cell:last-child {
          border-right: none;
        }

        /* user rows */
        .tl-user-row {
          display: contents;
        }

        /* Sticky user label cell */
        .tl-user-label-cell {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px 6px 14px;
          background: oklch(98.5% 0.008 62);
          border-bottom: 1px solid var(--border);
          border-right: 1px solid var(--border);
          min-width: 140px;
          position: sticky;
          left: 0;
          z-index: 1;
          transition: background 0.1s;
        }

        .tl-user-row:last-child .tl-user-label-cell {
          border-bottom: none;
        }

        .tl-user-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .tl-user-info {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .tl-user-display {
          font-size: 0.8125rem;
          font-weight: 500;
          letter-spacing: 0.03em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tl-user-at {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          letter-spacing: 0.02em;
          white-space: nowrap;
        }

        .tl-viewer-badge {
          font-size: 0.5625rem;
          font-weight: 600;
          padding: 1px 5px;
          border-radius: 8px;
          background: oklch(92% 0.020 38);
          color: oklch(44% 0.10 38);
          letter-spacing: 0.04em;
          white-space: nowrap;
          flex-shrink: 0;
        }

        /* ── Day cells: month mode (compact) ── */
        .tl-day-cell {
          padding: 4px 3px;
          border-bottom: 1px solid var(--border);
          border-right: 1px solid oklch(91% 0.012 62);
          cursor: pointer;
          position: relative;
          transition: background 0.12s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          gap: 2px;
          min-height: 48px;
          min-width: 32px;
        }

        .tl-user-row:last-child .tl-day-cell {
          border-bottom: none;
        }

        .tl-day-cell:last-child {
          border-right: none;
        }

        .tl-day-cell:hover {
          background: oklch(95% 0.016 62);
        }

        .tl-day-cell.today-col {
          background: oklch(96% 0.022 60);
        }

        .tl-day-cell.today-col:hover {
          background: oklch(92% 0.030 60);
        }

        .tl-day-cell.today-col::before {
          content: "";
          position: absolute;
          inset: 0;
          border: 1px solid oklch(60% 0.09 38 / 0.4);
          pointer-events: none;
        }

        /* ── Day cells: week mode (wide) ── */
        .tl-day-cell.week-cell {
          min-width: 130px;
          min-height: 88px;
          padding: 6px 8px 8px;
          align-items: flex-start;
          justify-content: flex-start;
          gap: 4px;
        }

        /* ── Icon chips — very compact ── */
        .tl-icons-area {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2px;
          width: 100%;
        }

        .tl-day-cell.week-cell .tl-icons-area {
          justify-content: flex-start;
        }

        .tl-icon-chip {
          display: inline-flex;
          align-items: center;
          gap: 1px;
          padding: 1px 3px 1px 2px;
          border-radius: 8px;
          border: 1px solid transparent;
          font-size: 0.75rem;
          line-height: 1;
        }

        .tl-day-cell.week-cell .tl-icon-chip {
          font-size: 0.9375rem;
          padding: 2px 5px 2px 3px;
          gap: 2px;
        }

        .tl-icon-badge {
          font-size: 0.4375rem;
          font-weight: 700;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
        }

        .tl-day-cell.week-cell .tl-icon-badge {
          font-size: 0.5625rem;
          font-weight: 600;
          letter-spacing: -0.02em;
        }

        .tl-icon-check {
          font-size: 0.5rem;
          color: oklch(42% 0.12 155);
          font-weight: 700;
        }

        .tl-day-cell.week-cell .tl-icon-check {
          font-size: 0.625rem;
        }

        .tl-overflow-chip {
          display: inline-flex;
          align-items: center;
          padding: 1px 4px;
          border-radius: 8px;
          font-size: 0.4375rem;
          font-weight: 700;
          background: oklch(90% 0.014 62);
          color: var(--ink-faint);
        }

        .tl-day-cell.week-cell .tl-overflow-chip {
          font-size: 0.625rem;
          padding: 2px 6px;
        }

        /* Note dot indicator (month mode) */
        .tl-note-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: oklch(58% 0.030 52);
          opacity: 0.6;
          flex-shrink: 0;
          margin-top: auto;
          margin-bottom: 2px;
        }

        .tl-day-cell:hover .tl-note-dot {
          opacity: 0.9;
        }

        /* Note preview (week mode) */
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
          padding-top: 2px;
          opacity: 0.78;
          transition: opacity 0.12s;
          width: 100%;
        }

        .tl-day-cell:hover .tl-note-preview {
          opacity: 1;
        }

        .tl-note-img-hint {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          margin-top: auto;
          padding-top: 2px;
          opacity: 0.72;
        }

        /* ── Legend / info strip ── */
        .tl-legend {
          margin-top: 14px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          font-size: 0.75rem;
          color: var(--ink-faint);
          letter-spacing: 0.03em;
        }

        .tl-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .tl-legend-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .tl-root { padding: 16px 10px 48px; }
          .tl-period-label { font-size: 1.25rem; }
          .tl-user-label-cell { min-width: 110px; padding: 5px 8px 5px 10px; }
          .tl-day-cell { min-width: 28px; min-height: 40px; }
          .tl-day-cell.week-cell { min-width: 100px; min-height: 72px; }
          .tl-period-toggle { margin-left: 0; }
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

        <div className="tl-subtitle">
          合并视图 — 点击任意格子查看当天详情
        </div>

        {/* ── Main grid ── */}
        <div className="tl-grid-outer">
          <div
            className="tl-table"
            data-period={period}
            style={{
              gridTemplateColumns: isWeek
                ? `minmax(140px, auto) repeat(7, minmax(130px, 1fr))`
                : `minmax(140px, auto) repeat(${columns.length}, minmax(32px, 1fr))`,
            }}
          >
            {/* Header row */}
            <div className="tl-header-user-cell">成员</div>
            {columns.map((col, idx) => {
              const isToday = col.key === todayKey;
              if (isWeek) {
                return (
                  <div
                    key={col.key}
                    className={`tl-header-day-cell week-header${isToday ? " today-col" : ""}`}
                  >
                    <span className="wh-weekday">{WEEKDAY_LABELS_CN[idx]}</span>
                    <span className="wh-date">{col.label}</span>
                  </div>
                );
              }
              return (
                <div
                  key={col.key}
                  className={`tl-header-day-cell${isToday ? " today-col" : ""}`}
                >
                  {col.label}
                </div>
              );
            })}

            {/* User rows */}
            {allUsers.map((user) => {
              const isViewer = user.id === viewerId;
              return (
                <div key={user.id} className="tl-user-row">
                  {/* Sticky label */}
                  <div className="tl-user-label-cell">
                    <span
                      className="tl-user-dot"
                      style={{ background: user.color }}
                    />
                    <div className="tl-user-info">
                      <span
                        className="tl-user-display"
                        style={{ color: user.color }}
                      >
                        {user.displayName}
                      </span>
                      <span className="tl-user-at">@{user.username}</span>
                    </div>
                    {isViewer && (
                      <span className="tl-viewer-badge">我</span>
                    )}
                  </div>

                  {/* Day cells */}
                  {columns.map((col) => {
                    const isToday = col.key === todayKey;
                    const occs = getUserOccs(user.id, col.key);
                    const note = getUserNote(user.id, col.key);
                    const hasNoteContent =
                      !!note &&
                      ((note.content && note.content.length > 0) ||
                        note.images.length > 0);

                    if (isWeek) {
                      // Week mode: wider cell with note preview
                      const displayOccs = occs.slice(0, 4);
                      const overflow = occs.length - 4;
                      const hasContent = !!note?.content && note.content.length > 0;
                      const hasImages = !!note && note.images.length > 0;
                      let notePreview: string | null = null;
                      let imageHint: string | null = null;
                      if (hasContent) {
                        const text = note!.content;
                        notePreview = text.length > 30 ? text.slice(0, 30) + "…" : text;
                      } else if (hasImages) {
                        imageHint = `📷×${note!.images.length}`;
                      }

                      return (
                        <div
                          key={col.key}
                          className={`tl-day-cell week-cell${isToday ? " today-col" : ""}`}
                          onClick={() => handleCellClick(user.id, col.key)}
                          title={`${user.displayName} · ${col.key}${occs.length > 0 ? ` · ${occs.length} 个事件` : ""}${hasNoteContent ? " · 有心声" : ""}`}
                          aria-label={`${user.displayName} ${col.key}`}
                        >
                          <div className="tl-icons-area">
                            {displayOccs.map((occ) => {
                              const isCheck = occ.type === "CHECK";
                              return (
                                <div
                                  key={occ.taskId}
                                  className="tl-icon-chip"
                                  style={{
                                    background: `${occ.color}1a`,
                                    borderColor: `${occ.color}33`,
                                  }}
                                  title={occ.name}
                                >
                                  <span>{occ.icon}</span>
                                  {isCheck ? (
                                    <span className="tl-icon-check">✓</span>
                                  ) : occ.totalCount >= 2 ? (
                                    <span className="tl-icon-badge">
                                      ·{occ.totalCount}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
                            {overflow > 0 && (
                              <div className="tl-overflow-chip">+{overflow}</div>
                            )}
                          </div>
                          {notePreview !== null && (
                            <div
                              className="tl-note-preview"
                              title={note?.content ?? undefined}
                            >
                              {notePreview}
                            </div>
                          )}
                          {imageHint !== null && (
                            <div className="tl-note-img-hint">{imageHint}</div>
                          )}
                        </div>
                      );
                    }

                    // Month mode: compact cell
                    const displayOccs = occs.slice(0, 3);
                    const overflow = occs.length - 3;

                    const [, mo, d] = col.key.split("-").map(Number);
                    return (
                      <div
                        key={col.key}
                        className={`tl-day-cell${isToday ? " today-col" : ""}`}
                        onClick={() => handleCellClick(user.id, col.key)}
                        title={`${user.displayName} · ${mo} 月 ${d} 日${occs.length > 0 ? ` · ${occs.length} 个事件` : ""}${hasNoteContent ? " · 有心声" : ""}`}
                        aria-label={`${user.displayName} ${mo} 月 ${d} 日`}
                      >
                        <div className="tl-icons-area">
                          {displayOccs.map((occ) => {
                            const isCheck = occ.type === "CHECK";
                            return (
                              <div
                                key={occ.taskId}
                                className="tl-icon-chip"
                                style={{
                                  background: `${occ.color}1a`,
                                  borderColor: `${occ.color}33`,
                                }}
                              >
                                <span>{occ.icon}</span>
                                {isCheck ? (
                                  <span className="tl-icon-check">✓</span>
                                ) : occ.totalCount >= 2 ? (
                                  <span className="tl-icon-badge">
                                    ·{occ.totalCount}
                                  </span>
                                ) : null}
                              </div>
                            );
                          })}
                          {overflow > 0 && (
                            <div className="tl-overflow-chip">+{overflow}</div>
                          )}
                        </div>
                        {hasNoteContent && <span className="tl-note-dot" />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="tl-legend">
          {!isWeek && (
            <div className="tl-legend-item">
              <span
                className="tl-legend-dot"
                style={{ background: "oklch(58% 0.030 52)" }}
              />
              圆点 = 有心声记录
            </div>
          )}
          <div className="tl-legend-item">
            点击格子查看当日详情，可在自己的行编辑
          </div>
        </div>
      </div>

      {/* Day detail sheet */}
      {sheetState !== null && (
        <DayDetailSheet
          date={sheetState.date}
          occurrences={sheetOccs}
          tasks={sheetUserTasks}
          note={sheetNote}
          onClose={() => setSheetState(null)}
          readonly={sheetState.readonly}
        />
      )}
    </>
  );
}
