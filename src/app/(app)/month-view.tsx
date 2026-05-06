"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Task } from "@prisma/client";
import { CHINESE_MONTHS, WEEKDAY_LABELS_CN, monthGrid, shiftMonth } from "@/lib/dates";
import { addOccurrenceAction, setCheckAction } from "./occurrences/actions";
import { DayDetailSheet } from "./day-detail-sheet";

type AggEntry = {
  taskId: number;
  name: string;
  icon: string;
  color: string;
  type: string;
  totalCount: number;
  occurrenceIds: number[];
};

interface MonthViewProps {
  year: number;
  month: number;
  tasks: Task[];
  occurrencesByDate: Record<string, AggEntry[]>;
  todayKey: string;
}

export function MonthView({ year, month, tasks, occurrencesByDate, todayKey }: MonthViewProps) {
  const router = useRouter();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingDateKey, setPendingDateKey] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [sheetDate, setSheetDate] = useState<string | null>(null);

  const cells = monthGrid(year, month);
  const monthLabel = `${CHINESE_MONTHS[month - 1]} ${year}`;

  function navTo(delta: number) {
    const { year: ny, month: nm } = shiftMonth(year, month, delta);
    router.push(`/?y=${ny}&m=${nm}`);
  }

  function navToday() {
    router.push("/");
  }

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
        // CHECK: toggle
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

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

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

        .mv-root {
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: var(--ink);
          padding: 24px 20px 64px;
          max-width: 1100px;
          margin: 0 auto;
        }

        /* ── Top bar ── */
        .mv-topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
        }

        .mv-month-label {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.5rem;
          font-weight: 400;
          letter-spacing: 0.08em;
          color: var(--ink);
          min-width: 120px;
        }

        .mv-nav-btn {
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

        .mv-nav-btn:hover {
          border-color: var(--border-mid);
          color: var(--ink);
          background: oklch(97% 0.010 62);
        }

        .mv-today-btn {
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

        .mv-today-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: oklch(96% 0.016 62);
        }

        /* ── Two-column layout ── */
        .mv-layout {
          display: grid;
          grid-template-columns: 200px 1fr;
          gap: 20px;
          align-items: start;
        }

        @media (max-width: 640px) {
          .mv-layout {
            grid-template-columns: 1fr;
          }
        }

        /* ── Task panel ── */
        .mv-task-panel {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
          position: sticky;
          top: 68px;
        }

        .mv-task-panel-header {
          padding: 12px 14px 10px;
          border-bottom: 1px solid var(--border);
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--ink-faint);
          letter-spacing: 0.06em;
          background: var(--ghost);
        }

        .mv-task-list {
          list-style: none;
          margin: 0;
          padding: 6px 0;
        }

        .mv-task-row {
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

        .mv-task-row:hover {
          background: oklch(95% 0.014 62);
        }

        .mv-task-row.selected {
          background: oklch(94% 0.022 58);
        }

        .mv-task-icon-wrap {
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

        .mv-task-row.selected .mv-task-icon-wrap {
          opacity: 1;
          box-shadow: 0 0 0 2.5px var(--bg-card), 0 0 0 4px var(--accent);
        }

        .mv-task-name {
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

        .mv-task-row.selected .mv-task-name {
          color: oklch(28% 0.030 58);
          font-weight: 500;
        }

        .mv-task-empty {
          padding: 16px 14px;
          font-size: 0.8125rem;
          color: var(--ink-faint);
          letter-spacing: 0.02em;
          line-height: 1.6;
        }

        .mv-task-deselect-hint {
          padding: 8px 12px;
          font-size: 0.6875rem;
          color: var(--ink-faint);
          text-align: center;
          border-top: 1px solid var(--border);
          letter-spacing: 0.03em;
        }

        /* ── Month grid ── */
        .mv-grid-wrap {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
        }

        /* Ruled-paper texture behind grid */
        .mv-grid-ruled {
          position: relative;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 97px,
            var(--rule-color) 97px,
            var(--rule-color) 98px
          );
        }

        .mv-weekday-headers {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          border-bottom: 1px solid var(--border);
          background: var(--ghost);
        }

        .mv-weekday-cell {
          padding: 8px 0 7px;
          text-align: center;
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--ink-faint);
          letter-spacing: 0.06em;
        }

        .mv-weekday-cell:last-child {
          color: oklch(52% 0.06 28); /* Sun: slightly warmer */
        }

        .mv-cal-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
        }

        .mv-day-cell {
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

        .mv-day-cell:nth-child(7n) {
          border-right: none;
        }

        /* last row cells - remove bottom border */
        .mv-day-cell:nth-last-child(-n+7) {
          border-bottom: none;
        }

        .mv-day-cell:hover {
          background: oklch(95% 0.016 62);
        }

        .mv-day-cell.out-of-month {
          background: var(--ghost);
          cursor: default;
        }

        .mv-day-cell.out-of-month:hover {
          background: var(--ghost);
        }

        .mv-day-cell.today {
          background: oklch(95% 0.024 60);
        }

        .mv-day-cell.today:hover {
          background: oklch(92% 0.030 60);
        }

        .mv-day-cell.today::before {
          content: "";
          position: absolute;
          inset: 0;
          border: 1.5px solid oklch(60% 0.09 38 / 0.5);
          border-radius: 0;
          pointer-events: none;
        }

        .mv-day-cell.pending {
          opacity: 0.7;
        }

        .mv-day-num {
          font-size: 0.75rem;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          line-height: 1;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .mv-day-cell.today .mv-day-num {
          color: var(--accent);
          font-weight: 600;
        }

        .mv-day-cell.out-of-month .mv-day-num {
          color: var(--ink-faint);
          opacity: 0.5;
        }

        /* Tiny "view detail" button shown on hover */
        .mv-view-btn {
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

        .mv-day-cell:hover .mv-view-btn {
          opacity: 1;
        }

        /* Icon area inside cell */
        .mv-icons-area {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
          flex: 1;
          align-content: flex-start;
        }

        .mv-icon-chip {
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

        .mv-icon-badge {
          font-size: 0.5625rem;
          font-weight: 600;
          color: var(--ink-soft);
          font-variant-numeric: tabular-nums;
          letter-spacing: -0.02em;
        }

        .mv-icon-check {
          font-size: 0.625rem;
          color: oklch(42% 0.12 155);
          font-weight: 700;
        }

        .mv-overflow-chip {
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

        /* ── Toast ── */
        .mv-toast {
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
          animation: mv-toast-in 0.18s ease;
        }

        @keyframes mv-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* ── Responsive ── */
        @media (max-width: 640px) {
          .mv-root { padding: 16px 12px 48px; }
          .mv-month-label { font-size: 1.25rem; }
          .mv-day-cell { min-height: 60px; padding: 4px 3px; }
          .mv-task-panel { position: static; }
          .mv-icon-chip { font-size: 0.8125rem; }
        }

        @media (max-width: 400px) {
          .mv-day-cell { min-height: 48px; }
          .mv-icon-chip { font-size: 0.6875rem; padding: 1px 3px 1px 2px; }
        }
      `}</style>

      <div className="mv-root">
        {/* ── Top bar ── */}
        <div className="mv-topbar">
          <button
            className="mv-nav-btn"
            onClick={() => navTo(-1)}
            title="上个月"
            aria-label="上个月"
          >
            ←
          </button>
          <h1 className="mv-month-label">{monthLabel}</h1>
          <button
            className="mv-nav-btn"
            onClick={() => navTo(1)}
            title="下个月"
            aria-label="下个月"
          >
            →
          </button>
          <button className="mv-today-btn" onClick={navToday}>
            今天
          </button>
        </div>

        {/* ── Two-column layout ── */}
        <div className="mv-layout">
          {/* Task panel */}
          <aside className="mv-task-panel" aria-label="任务列表">
            <div className="mv-task-panel-header">选择任务后点击日期</div>
            {tasks.length === 0 ? (
              <div className="mv-task-empty">
                还没有任务，前往「任务」页面创建吧
              </div>
            ) : (
              <ul className="mv-task-list" role="listbox" aria-label="选择任务">
                {tasks.map((task) => {
                  const isSelected = selectedTaskId === task.id;
                  return (
                    <li
                      key={task.id}
                      role="option"
                      aria-selected={isSelected}
                      className={`mv-task-row${isSelected ? " selected" : ""}`}
                      onClick={() =>
                        setSelectedTaskId(isSelected ? null : task.id)
                      }
                      title={task.name}
                    >
                      <div
                        className="mv-task-icon-wrap"
                        style={{ background: task.color }}
                      >
                        {task.icon}
                      </div>
                      <span className="mv-task-name">{task.name}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {selectedTaskId !== null && (
              <div className="mv-task-deselect-hint">
                点击任意任务取消选择
              </div>
            )}
          </aside>

          {/* Month grid */}
          <div className="mv-grid-wrap" aria-label={`${monthLabel}月历`}>
            <div className="mv-weekday-headers" aria-hidden="true">
              {WEEKDAY_LABELS_CN.map((d) => (
                <div key={d} className="mv-weekday-cell">
                  {d}
                </div>
              ))}
            </div>
            <div className="mv-grid-ruled">
              <div className="mv-cal-grid" role="grid">
                {cells.map((cell, idx) => {
                  if (cell === null) {
                    return (
                      <div
                        key={`empty-${idx}`}
                        className="mv-day-cell out-of-month"
                        aria-hidden="true"
                      />
                    );
                  }

                  const isToday = cell.key === todayKey;
                  const cellOccs = occurrencesByDate[cell.key] ?? [];
                  const isCellPending =
                    isPending && pendingDateKey === cell.key;

                  const cellClasses = [
                    "mv-day-cell",
                    isToday ? "today" : "",
                    isCellPending ? "pending" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  // Compute display: up to 4 icons + overflow
                  const displayOccs = cellOccs.slice(0, 4);
                  const overflow = cellOccs.length - 4;

                  return (
                    <div
                      key={cell.key}
                      className={cellClasses}
                      role="gridcell"
                      aria-label={`${cell.day}日`}
                      onClick={() => handleCellClick(cell.key)}
                    >
                      <div className="mv-day-num">
                        <span>{cell.day}</span>
                        <button
                          className="mv-view-btn"
                          onClick={(e) => handleViewDetail(cell.key, e)}
                          title="查看详情"
                          aria-label={`查看 ${cell.day} 日详情`}
                        >
                          ···
                        </button>
                      </div>
                      <div className="mv-icons-area">
                        {displayOccs.map((occ) => {
                          const isCheck = occ.type === "CHECK";
                          return (
                            <div
                              key={occ.taskId}
                              className="mv-icon-chip"
                              style={{
                                background: `${occ.color}1a`,
                                borderColor: `${occ.color}33`,
                              }}
                              title={occ.name}
                            >
                              <span>{occ.icon}</span>
                              {isCheck ? (
                                <span className="mv-icon-check">✓</span>
                              ) : occ.totalCount >= 2 ? (
                                <span className="mv-icon-badge">
                                  ·{occ.totalCount}
                                </span>
                              ) : null}
                            </div>
                          );
                        })}
                        {overflow > 0 && (
                          <div className="mv-overflow-chip">+{overflow}</div>
                        )}
                      </div>
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
        <div className="mv-toast" role="alert">
          {toastMsg}
        </div>
      )}

      {/* Day detail sheet */}
      {sheetDate !== null && (
        <DayDetailSheet
          date={sheetDate}
          occurrences={occurrencesByDate[sheetDate] ?? []}
          tasks={tasks}
          onClose={() => setSheetDate(null)}
        />
      )}
    </>
  );
}
