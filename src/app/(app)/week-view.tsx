"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@prisma/client";
import { WEEKDAY_LABELS_CN } from "@/lib/dates";
import { addOccurrenceAction, setCheckAction } from "./occurrences/actions";
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

interface WeekViewProps {
  weekStart: string; // YYYY-MM-DD Monday
  weekEnd: string;   // YYYY-MM-DD Sunday
  dKey: string;      // the ?d= param that was used (any date in the week)
  tasks: Task[];
  occurrencesByDate: Record<string, AggEntry[]>;
  notesByDate: Record<string, NoteData>;
  todayKey: string;
}

// Build the 7 day cells from weekStart (Monday) to weekEnd (Sunday)
function buildWeekCells(weekStart: string): { key: string; day: number; month: number }[] {
  const [y, m, d] = weekStart.split("-").map(Number);
  const cells: { key: string; day: number; month: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(y, m - 1, d + i);
    const yy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    cells.push({
      key: `${yy}-${mm}-${dd}`,
      day: date.getDate(),
      month: date.getMonth() + 1,
    });
  }
  return cells;
}

// Shift a YYYY-MM-DD by N days
function shiftDate(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Format range label: "5 月 4 日 - 5 月 10 日" or span months
function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const [, sm, sd] = weekStart.split("-").map(Number);
  const [, em, ed] = weekEnd.split("-").map(Number);
  if (sm === em) {
    return `${sm} 月 ${sd} 日 — ${ed} 日`;
  }
  return `${sm} 月 ${sd} 日 — ${em} 月 ${ed} 日`;
}

export function WeekView({
  weekStart,
  weekEnd,
  dKey,
  tasks,
  occurrencesByDate,
  notesByDate,
  todayKey,
}: WeekViewProps) {
  const router = useRouter();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDateKey, setPendingDateKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  const cells = buildWeekCells(weekStart);
  const weekLabel = formatWeekLabel(weekStart, weekEnd);

  // Navigation: prev = weekStart - 7, next = weekStart + 7
  const prevDate = shiftDate(weekStart, -7);
  const nextDate = shiftDate(weekStart, 7);

  function showToast(msg: string) {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  }

  function handleCellClick(dateKey: string) {
    if (selectedTaskId === null) {
      setSheetDate(dateKey);
      return;
    }
    const task = tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    setPendingDateKey(dateKey);
    startTransition(async () => {
      let result: { ok: boolean; error?: string };
      if (task.type === "COUNTED") {
        result = await addOccurrenceAction(task.id, dateKey, 1);
      } else {
        const existing = occurrencesByDate[dateKey]?.find((e) => e.taskId === task.id);
        if (existing) {
          result = await setCheckAction(task.id, dateKey, false);
        } else {
          result = await setCheckAction(task.id, dateKey, true);
        }
      }
      setPendingDateKey(null);
      if (!result.ok && result.error) {
        showToast(result.error);
      }
    });
  }

  function handleViewDetail(dateKey: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSheetDate(dateKey);
  }

  return (
    <>
      <style>{`
        /* ── Week view: reuse month-view's design tokens verbatim ── */
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

        .wv-root {
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: var(--ink);
          padding: 24px 20px 64px;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ── Top bar ── */
        .wv-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .wv-week-label {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.5rem;
          font-weight: 400;
          letter-spacing: 0.06em;
          color: var(--ink);
          min-width: 200px;
        }

        .wv-nav-btn {
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
          text-decoration: none;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          flex-shrink: 0;
        }

        .wv-nav-btn:hover {
          border-color: var(--border-mid);
          color: var(--ink);
          background: oklch(97% 0.010 62);
        }

        .wv-today-btn {
          padding: 6px 14px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 0.8125rem;
          color: var(--ink-soft);
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.04em;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          white-space: nowrap;
        }

        .wv-today-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: oklch(96% 0.016 62);
        }

        /* ── Two-column layout ── */
        .wv-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          align-items: start;
        }

        @media (max-width: 640px) {
          .wv-layout {
            grid-template-columns: 1fr;
          }
        }

        /* ── Task panel (identical structure to month-view) ── */
        .wv-task-panel {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          position: sticky;
          top: 68px;
        }

        .wv-task-panel-header {
          padding: 12px 14px 10px;
          border-bottom: 1px solid var(--border);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--ink-faint);
          letter-spacing: 0.06em;
          background: var(--ghost);
        }

        .wv-task-list {
          list-style: none;
          margin: 0;
          padding: 6px 0;
        }

        .wv-task-row {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 9px 12px;
          cursor: pointer;
          border-radius: 4px;
          margin: 2px 6px;
          transition: background 0.12s;
          position: relative;
        }

        .wv-task-row:hover {
          background: oklch(95% 0.014 62);
        }

        .wv-task-row.selected {
          background: oklch(94% 0.022 58);
        }

        .wv-task-icon-wrap {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.0625rem;
          flex-shrink: 0;
          opacity: 0.88;
          transition: box-shadow 0.14s, opacity 0.14s;
        }

        .wv-task-row.selected .wv-task-icon-wrap {
          opacity: 1;
          box-shadow: 0 0 0 2.5px var(--bg-card), 0 0 0 4px var(--accent);
        }

        .wv-task-name {
          font-size: 0.875rem;
          color: var(--ink);
          letter-spacing: 0.03em;
          line-height: 1.3;
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .wv-task-row.selected .wv-task-name {
          color: oklch(28% 0.030 58);
          font-weight: 500;
        }

        .wv-task-empty {
          padding: 16px 14px;
          font-size: 0.8125rem;
          color: var(--ink-faint);
          letter-spacing: 0.02em;
          line-height: 1.6;
        }

        .wv-task-deselect-hint {
          padding: 8px 12px;
          font-size: 0.6875rem;
          color: var(--ink-faint);
          text-align: center;
          border-top: 1px solid var(--border);
          letter-spacing: 0.03em;
        }

        /* ── Week grid ── */
        .wv-grid-wrap {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
        }

        .wv-grid-ruled {
          position: relative;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 27px,
            var(--rule-color) 27px,
            var(--rule-color) 28px
          );
        }

        /* 7-column header row */
        .wv-weekday-headers {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-bottom: 1px solid var(--border);
          background: var(--ghost);
        }

        .wv-weekday-cell {
          padding: 8px 0 7px;
          text-align: center;
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--ink-faint);
          letter-spacing: 0.06em;
        }

        .wv-weekday-cell:last-child {
          color: oklch(52% 0.06 28);
        }

        /* 7 day cells in a single row */
        .wv-cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }

        .wv-day-cell {
          min-height: 260px;
          padding: 8px 6px 10px;
          border-right: 1px solid var(--border);
          cursor: pointer;
          position: relative;
          transition: background 0.12s;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .wv-day-cell:last-child {
          border-right: none;
        }

        .wv-day-cell:hover {
          background: oklch(95% 0.016 62);
        }

        .wv-day-cell.today {
          background: oklch(95% 0.024 60);
        }

        .wv-day-cell.today:hover {
          background: oklch(92% 0.030 60);
        }

        .wv-day-cell.today::before {
          content: "";
          position: absolute;
          inset: 0;
          border: 1.5px solid oklch(60% 0.09 38 / 0.5);
          pointer-events: none;
        }

        .wv-day-cell.pending {
          opacity: 0.7;
        }

        /* Date number row */
        .wv-day-header {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .wv-day-num {
          font-size: 1rem;
          font-weight: 400;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          line-height: 1;
        }

        .wv-day-cell.today .wv-day-num {
          color: var(--accent);
          font-weight: 700;
        }

        .wv-day-month {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          letter-spacing: 0.02em;
        }

        /* view-detail button */
        .wv-view-btn {
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

        .wv-day-cell:hover .wv-view-btn {
          opacity: 1;
        }

        /* Icons area */
        .wv-icons-area {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
          align-content: flex-start;
        }

        .wv-icon-chip {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          padding: 2px 5px 2px 3px;
          border-radius: 10px;
          background: oklch(96% 0.012 62);
          border: 1px solid transparent;
          font-size: 0.9375rem;
          line-height: 1;
        }

        .wv-icon-badge {
          font-size: 0.5625rem;
          font-weight: 600;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .wv-icon-check {
          font-size: 0.625rem;
          color: oklch(42% 0.12 155);
          font-weight: 700;
        }

        .wv-overflow-chip {
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

        /* Note preview — new in week view vs month view */
        .wv-note-preview {
          font-size: 0.6875rem;
          color: oklch(52% 0.022 58);
          line-height: 1.5;
          letter-spacing: 0.01em;
          word-break: break-all;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          margin-top: auto;
          padding-top: 4px;
          opacity: 0.78;
          transition: opacity 0.12s;
        }

        .wv-day-cell:hover .wv-note-preview {
          opacity: 1;
        }

        .wv-note-img-hint {
          font-size: 0.6875rem;
          color: var(--ink-faint);
          margin-top: auto;
          padding-top: 4px;
          letter-spacing: 0.01em;
          opacity: 0.72;
        }

        /* ── Toast ── */
        .wv-toast {
          position: fixed;
          bottom: 32px;
          left: 50%;
          transform: translateX(-50%);
          background: oklch(22% 0.025 58);
          color: oklch(97% 0.008 62);
          font-size: 0.875rem;
          padding: 10px 20px;
          border-radius: 6px;
          z-index: 200;
          letter-spacing: 0.03em;
          pointer-events: none;
          animation: wv-toast-in 0.18s ease;
        }

        @keyframes wv-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .wv-root { padding: 16px 12px 48px; }
          .wv-week-label { font-size: 1.125rem; min-width: 0; }
          .wv-day-cell { min-height: 120px; padding: 6px 4px 8px; }
          .wv-task-panel { position: static; }
          .wv-icon-chip { font-size: 0.8125rem; }
          .wv-note-preview { -webkit-line-clamp: 2; }
        }

        @media (max-width: 480px) {
          .wv-day-cell { min-height: 88px; }
          .wv-day-num { font-size: 0.875rem; }
          .wv-icon-chip { font-size: 0.6875rem; padding: 1px 3px 1px 2px; }
        }
      `}</style>

      <div className="wv-root">
        {/* ── Top bar ── */}
        <div className="wv-topbar">
          <a
            href={`/week?d=${prevDate}`}
            className="wv-nav-btn"
            title="上周"
            aria-label="上周"
          >
            ←
          </a>
          <h1 className="wv-week-label">{weekLabel}</h1>
          <a
            href={`/week?d=${nextDate}`}
            className="wv-nav-btn"
            title="下周"
            aria-label="下周"
          >
            →
          </a>
          <a href="/week" className="wv-today-btn">
            本周
          </a>
        </div>

        {/* ── Two-column layout ── */}
        <div className="wv-layout">
          {/* Task panel */}
          <aside className="wv-task-panel" aria-label="任务列表">
            <div className="wv-task-panel-header">选择任务后点击日期</div>
            {tasks.length === 0 ? (
              <div className="wv-task-empty">
                还没有任务，前往「任务」页面创建吧
              </div>
            ) : (
              <ul className="wv-task-list" role="listbox" aria-label="选择任务">
                {tasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  return (
                    <li
                      key={task.id}
                      role="option"
                      aria-selected={isSelected}
                      className={`wv-task-row${isSelected ? " selected" : ""}`}
                      onClick={() =>
                        setSelectedTaskId(isSelected ? null : task.id)
                      }
                      title={task.name}
                    >
                      <div
                        className="wv-task-icon-wrap"
                        style={{ background: task.color }}
                      >
                        {task.icon}
                      </div>
                      <span className="wv-task-name">{task.name}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedTaskId !== null && (
              <div className="wv-task-deselect-hint">
                点击任意任务取消选择
              </div>
            )}
          </aside>

          {/* Week grid */}
          <div className="wv-grid-wrap" aria-label={`${weekLabel} 周历`}>
            {/* Weekday header row */}
            <div className="wv-weekday-headers" aria-hidden="true">
              {WEEKDAY_LABELS_CN.map((d) => (
                <div key={d} className="wv-weekday-cell">
                  {d}
                </div>
              ))}
            </div>

            {/* Single grid row with 7 tall cells */}
            <div className="wv-grid-ruled">
              <div className="wv-cal-grid" role="grid">
                {cells.map((cell) => {
                  const isToday = cell.key === todayKey;
                  const cellOccs = occurrencesByDate[cell.key] ?? [];
                  const isCellPending = isPending && pendingDateKey === cell.key;
                  const cellNote = notesByDate[cell.key];

                  const hasContent = !!cellNote?.content && cellNote.content.length > 0;
                  const hasImages = !!cellNote && cellNote.images.length > 0;

                  const cellClasses = [
                    "wv-day-cell",
                    isToday ? "today" : "",
                    isCellPending ? "pending" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const displayOccs = cellOccs.slice(0, 4);
                  const overflow = cellOccs.length - 4;

                  // Note preview text (up to 60 chars)
                  let notePreview: string | null = null;
                  let imageHint: string | null = null;
                  if (hasContent) {
                    const text = cellNote!.content;
                    notePreview = text.length > 60 ? text.slice(0, 60) + "…" : text;
                  } else if (hasImages) {
                    imageHint = `📷×${cellNote!.images.length}`;
                  }

                  return (
                    <div
                      key={cell.key}
                      className={cellClasses}
                      role="gridcell"
                      aria-label={`${cell.month} 月 ${cell.day} 日`}
                      onClick={() => handleCellClick(cell.key)}
                    >
                      {/* Date header */}
                      <div className="wv-day-header">
                        <span className="wv-day-num">{cell.day}</span>
                        {/* Show month label only when month changes mid-week */}
                        <span className="wv-day-month">{cell.month} 月</span>
                        <button
                          className="wv-view-btn"
                          onClick={(e) => handleViewDetail(cell.key, e)}
                          title="查看详情"
                          aria-label={`查看 ${cell.month} 月 ${cell.day} 日详情`}
                        >
                          ···
                        </button>
                      </div>

                      {/* Task icons */}
                      <div className="wv-icons-area">
                        {displayOccs.map((occ) => {
                          const isCheck = occ.type === "CHECK";
                          return (
                            <div
                              key={occ.taskId}
                              className="wv-icon-chip"
                              style={{
                                background: `${occ.color}1a`,
                                borderColor: `${occ.color}33`,
                              }}
                              title={occ.name}
                            >
                              <span>{occ.icon}</span>
                              {isCheck ? (
                                <span className="wv-icon-check">✓</span>
                              ) : occ.totalCount >= 2 ? (
                                <span className="wv-icon-badge">
                                  ·{occ.totalCount}
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                        {overflow > 0 && (
                          <div className="wv-overflow-chip">+{overflow}</div>
                        )}
                      </div>

                      {/* Note preview — unique to week view */}
                      {notePreview !== null && (
                        <div className="wv-note-preview" title={cellNote?.content ?? undefined}>
                          {notePreview}
                        </div>
                      )}
                      {imageHint !== null && (
                        <div className="wv-note-img-hint">{imageHint}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMsg && (
        <div className="wv-toast" role="alert">
          {toastMsg}
        </div>
      )}

      {/* Day detail sheet */}
      {sheetDate !== null && (
        <DayDetailSheet
          date={sheetDate}
          occurrences={occurrencesByDate[sheetDate] ?? []}
          tasks={tasks}
          note={notesByDate[sheetDate] ?? null}
          onClose={() => setSheetDate(null)}
        />
      )}
    </>
  );
}
