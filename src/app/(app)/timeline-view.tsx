"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@prisma/client";
import { CHINESE_MONTHS, monthGrid, shiftMonth } from "@/lib/dates";
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
  year: number;
  month: number;
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

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function formatDay(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

export function TimelineView({
  year,
  month,
  viewerId,
  allUsers,
  tasks,
  occurrencesByUserDate,
  notesByUserDate,
  todayKey,
}: TimelineViewProps) {
  const router = useRouter();
  const [sheetState, setSheetState] = useState<SheetState | null>(null);

  const numDays = daysInMonth(year, month);
  const monthLabel = `${CHINESE_MONTHS[month - 1]} ${year}`;
  const todayParts = todayKey.split("-").map(Number);
  const todayInMonth =
    todayParts[0] === year && todayParts[1] === month ? todayParts[2] : null;

  function navTo(delta: number) {
    const { year: ny, month: nm } = shiftMonth(year, month, delta);
    router.push(`/timeline?y=${ny}&m=${nm}`);
  }

  function navToday() {
    router.push("/timeline");
  }

  function handleCellClick(userId: number, day: number) {
    const dateKey = formatDay(year, month, day);
    const isOwn = userId === viewerId;
    setSheetState({ date: dateKey, userId, readonly: !isOwn });
  }

  // Get tasks for a given user
  function getUserTasks(userId: number): Task[] {
    return tasks.filter((t) => t.userId === userId);
  }

  // Get note for a user on a day
  function getUserNote(userId: number, dateKey: string): NoteData | null {
    return notesByUserDate[userId]?.[dateKey] ?? null;
  }

  // Get occurrences for a user on a day
  function getUserOccs(userId: number, dateKey: string): AggEntry[] {
    return occurrencesByUserDate[userId]?.[dateKey] ?? [];
  }

  // For the sheet: get all user occurrences for the date (as AggEntry[])
  const sheetOccs = sheetState
    ? getUserOccs(sheetState.userId, sheetState.date)
    : [];
  const sheetNote = sheetState
    ? getUserNote(sheetState.userId, sheetState.date)
    : null;
  const sheetUserTasks = sheetState
    ? sheetState.readonly
      ? [] // no tasks needed for readonly (add section is hidden)
      : getUserTasks(sheetState.userId)
    : [];

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
        }

        .tl-month-label {
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
          /* User label col (fixed) + N day cols */
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

        .tl-header-day-cell.today-col {
          color: var(--accent);
          font-weight: 700;
          background: oklch(95% 0.024 60);
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

        /* Day cells within a user row */
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

        /* Today's column accent — applied via inline style on each cell in that column */
        .tl-day-cell.today-col {
          background: oklch(96% 0.022 60);
        }

        .tl-day-cell.today-col:hover {
          background: oklch(92% 0.030 60);
        }

        /* Today border — shown on first user row cell for clarity */
        .tl-day-cell.today-col::before {
          content: "";
          position: absolute;
          inset: 0;
          border: 1px solid oklch(60% 0.09 38 / 0.4);
          pointer-events: none;
        }

        /* Icon chips — very compact */
        .tl-icons-area {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 2px;
          width: 100%;
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

        .tl-icon-badge {
          font-size: 0.4375rem;
          font-weight: 700;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
        }

        .tl-icon-check {
          font-size: 0.5rem;
          color: oklch(42% 0.12 155);
          font-weight: 700;
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

        /* Note dot indicator */
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
          .tl-month-label { font-size: 1.25rem; }
          .tl-user-label-cell { min-width: 110px; padding: 5px 8px 5px 10px; }
          .tl-day-cell { min-width: 28px; min-height: 40px; }
        }
      `}</style>

      <div className="tl-root">
        {/* ── Top bar ── */}
        <div className="tl-topbar">
          <button
            className="tl-nav-btn"
            onClick={() => navTo(-1)}
            title="上个月"
            aria-label="上个月"
          >
            ←
          </button>
          <h1 className="tl-month-label">{monthLabel}</h1>
          <button
            className="tl-nav-btn"
            onClick={() => navTo(1)}
            title="下个月"
            aria-label="下个月"
          >
            →
          </button>
          <button className="tl-today-btn" onClick={navToday}>
            今天
          </button>
        </div>
        <div className="tl-subtitle">合并视图 — 点击任意格子查看当天详情</div>

        {/* ── Main grid ── */}
        <div className="tl-grid-outer">
          <div
            className="tl-table"
            style={{
              gridTemplateColumns: `minmax(140px, auto) repeat(${numDays}, minmax(32px, 1fr))`,
            }}
          >
            {/* Header row */}
            <div className="tl-header-user-cell">成员</div>
            {Array.from({ length: numDays }, (_, i) => i + 1).map((day) => {
              const isToday = day === todayInMonth;
              return (
                <div
                  key={day}
                  className={`tl-header-day-cell${isToday ? " today-col" : ""}`}
                >
                  {day}
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
                  {Array.from({ length: numDays }, (_, i) => i + 1).map((day) => {
                    const dateKey = formatDay(year, month, day);
                    const isToday = day === todayInMonth;
                    const occs = getUserOccs(user.id, dateKey);
                    const note = getUserNote(user.id, dateKey);
                    const hasNote =
                      !!note &&
                      ((note.content && note.content.length > 0) ||
                        note.images.length > 0);

                    const displayOccs = occs.slice(0, 3);
                    const overflow = occs.length - 3;

                    return (
                      <div
                        key={day}
                        className={`tl-day-cell${isToday ? " today-col" : ""}`}
                        onClick={() => handleCellClick(user.id, day)}
                        title={`${user.displayName} · ${month} 月 ${day} 日${occs.length > 0 ? ` · ${occs.length} 个事件` : ""}${hasNote ? " · 有心声" : ""}`}
                        aria-label={`${user.displayName} ${month} 月 ${day} 日`}
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
                        {hasNote && <span className="tl-note-dot" />}
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
          <div className="tl-legend-item">
            <span
              className="tl-legend-dot"
              style={{ background: "oklch(58% 0.030 52)" }}
            />
            圆点 = 有心声记录
          </div>
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
