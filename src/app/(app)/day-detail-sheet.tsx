"use client";

import { useEffect, useTransition, useCallback, useRef, useState } from "react";
import type { Task } from "@prisma/client";
import { addOccurrenceAction, removeOccurrenceAction, setCheckAction } from "./occurrences/actions";
import { NoteEditor, type NoteData } from "./note-editor";

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

export interface MultiUserDayData {
  user: UserLite;
  occurrences: AggEntry[];
  note: NoteData | null;
}

interface DayDetailSheetProps {
  date: string; // YYYY-MM-DD
  occurrences: AggEntry[];
  tasks: Task[];
  note: NoteData | null | undefined;
  onClose: () => void;
  readonly?: boolean;
  /** When set, renders multi-user readonly view (used by /timeline) */
  multiUserData?: MultiUserDayData[];
}

function formatDateDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const dow = new Date(y, m - 1, d).getDay();
  return `${y} 年 ${m} 月 ${d} 日 ${weekdays[dow]}`;
}

export function DayDetailSheet({ date, occurrences, tasks, note, onClose, readonly = false, multiUserData }: DayDetailSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isDirtyRef = useRef(false);

  // Guard: warn user about unsaved changes before closing (skip in readonly mode)
  const safeClose = useCallback(() => {
    if (!readonly && isDirtyRef.current) {
      if (!window.confirm("未保存的修改将丢失，是否离开？")) return;
    }
    onClose();
  }, [onClose, readonly]);

  function handleDirtyChange(dirty: boolean) {
    isDirtyRef.current = dirty;
  }

  // Close on ESC (with unsaved-changes guard)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") safeClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [safeClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  function handleRemove(occurrenceId: number) {
    startTransition(async () => {
      await removeOccurrenceAction(occurrenceId);
    });
  }

  function handleAdd(task: Task) {
    startTransition(async () => {
      if (task.type === "COUNTED") {
        await addOccurrenceAction(task.id, date, 1);
      } else {
        const existing = occurrences.find((o) => o.taskId === task.id);
        if (existing) {
          await setCheckAction(task.id, date, false);
        } else {
          await setCheckAction(task.id, date, true);
        }
      }
    });
  }

  const dateDisplay = formatDateDisplay(date);
  const activeTasks = tasks.filter((t) => !t.archivedAt);

  return (
    <>
      <style>{`
        .sheet-backdrop {
          position: fixed;
          inset: 0;
          background: oklch(22% 0.025 58 / 0.32);
          z-index: 100;
          animation: sheet-fade-in 0.2s ease;
        }

        @keyframes sheet-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .sheet-panel {
          position: fixed;
          top: 0;
          right: 0;
          bottom: 0;
          width: min(420px, 100vw);
          background: oklch(98.5% 0.010 62);
          border-left: 1px solid oklch(88% 0.014 58);
          z-index: 101;
          display: flex;
          flex-direction: column;
          animation: sheet-slide-in 0.22s cubic-bezier(0.22, 1, 0.36, 1);
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(22% 0.025 58);
        }

        @keyframes sheet-slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }

        /* Ruled texture on sheet */
        .sheet-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 35px,
            oklch(88% 0.014 58 / 0.45) 35px,
            oklch(88% 0.014 58 / 0.45) 36px
          );
          pointer-events: none;
          z-index: 0;
        }

        .sheet-header {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 20px 20px 16px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          background: oklch(98.5% 0.010 62);
          flex-shrink: 0;
        }

        .sheet-date {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.0625rem;
          font-weight: 400;
          letter-spacing: 0.05em;
          color: oklch(22% 0.025 58);
          line-height: 1.4;
        }

        .sheet-close-btn {
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid oklch(84% 0.014 58);
          border-radius: 4px;
          background: transparent;
          cursor: pointer;
          color: oklch(52% 0.018 58);
          font-size: 1.125rem;
          line-height: 1;
          transition: border-color 0.12s, color 0.12s;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .sheet-close-btn:hover {
          border-color: oklch(64% 0.018 58);
          color: oklch(28% 0.025 58);
        }

        .sheet-body {
          position: relative;
          z-index: 1;
          flex: 1;
          overflow-y: auto;
          padding: 0 20px 32px;
        }

        .sheet-section {
          margin-top: 20px;
        }

        .sheet-section-title {
          font-size: 0.6875rem;
          font-weight: 600;
          color: oklch(60% 0.016 58);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }

        /* Existing events section */
        .sheet-event-group {
          margin-bottom: 8px;
        }

        .sheet-event-task-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          background: oklch(99% 0.006 62);
          border: 1px solid oklch(88% 0.014 58);
          border-radius: 5px 5px 0 0;
        }

        .sheet-event-task-row + .sheet-event-task-row {
          border-radius: 0;
          border-top: none;
        }

        .sheet-event-icon-wrap {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9375rem;
          flex-shrink: 0;
          opacity: 0.88;
        }

        .sheet-event-name {
          font-size: 0.9375rem;
          color: oklch(22% 0.025 58);
          letter-spacing: 0.03em;
          flex: 1;
          min-width: 0;
        }

        .sheet-event-count {
          font-size: 0.8125rem;
          color: oklch(46% 0.022 58);
          font-variant-numeric: tabular-nums;
        }

        .sheet-event-check-badge {
          font-size: 0.8125rem;
          padding: 2px 8px;
          border-radius: 10px;
          background: oklch(93% 0.020 155);
          color: oklch(34% 0.10 155);
          font-weight: 500;
          letter-spacing: 0.02em;
        }

        .sheet-occ-list {
          padding: 4px 8px 6px 12px;
          background: oklch(98% 0.006 62);
          border: 1px solid oklch(88% 0.014 58);
          border-top: none;
          border-radius: 0 0 5px 5px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .sheet-occ-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8125rem;
          color: oklch(46% 0.022 58);
        }

        .sheet-occ-label {
          flex: 1;
          letter-spacing: 0.02em;
        }

        .sheet-remove-btn {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 1px solid oklch(80% 0.012 58);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.875rem;
          color: oklch(54% 0.018 58);
          cursor: pointer;
          line-height: 1;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          flex-shrink: 0;
        }

        .sheet-remove-btn:hover:not(:disabled) {
          border-color: oklch(58% 0.12 28);
          color: oklch(38% 0.14 28);
          background: oklch(96% 0.022 28);
        }

        .sheet-remove-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .sheet-empty-events {
          font-size: 0.875rem;
          color: oklch(60% 0.014 58);
          letter-spacing: 0.02em;
          font-style: italic;
          padding: 6px 0;
        }

        /* Add section */
        .sheet-add-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .sheet-add-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: oklch(99% 0.006 62);
          border: 1px solid oklch(88% 0.014 58);
          border-radius: 5px;
        }

        .sheet-add-task-name {
          font-size: 0.875rem;
          color: oklch(22% 0.025 58);
          letter-spacing: 0.03em;
          flex: 1;
          min-width: 0;
        }

        .sheet-add-btn {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1px solid oklch(78% 0.016 58);
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          color: oklch(46% 0.022 58);
          cursor: pointer;
          line-height: 1;
          transition: border-color 0.12s, color 0.12s, background 0.12s;
          flex-shrink: 0;
        }

        .sheet-add-btn:hover:not(:disabled) {
          border-color: oklch(52% 0.12 38);
          color: oklch(52% 0.12 38);
          background: oklch(95% 0.020 62);
        }

        .sheet-add-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sheet-add-btn.check-active {
          background: oklch(92% 0.022 155);
          border-color: oklch(56% 0.10 155);
          color: oklch(34% 0.12 155);
        }

        /* Heart-voices section */
        .sheet-heartvoice-section {
          margin-top: 20px;
          padding-bottom: 8px;
        }

        .sheet-heartvoice-title {
          font-size: 0.6875rem;
          font-weight: 600;
          color: oklch(60% 0.016 58);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .sheet-heartvoice-quill {
          font-style: normal;
          opacity: 0.7;
          font-size: 0.875rem;
        }

        /* ── Multi-user section (timeline view) ── */
        .sheet-multi-user-section {
          margin-top: 20px;
        }

        .sheet-multi-user-block {
          margin-bottom: 20px;
        }

        .sheet-multi-user-header {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 10px;
          padding: 6px 10px;
          background: oklch(97% 0.008 62);
          border: 1px solid oklch(88% 0.014 58);
          border-radius: 5px;
        }

        .sheet-multi-user-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .sheet-multi-user-name {
          font-size: 0.875rem;
          font-weight: 500;
          letter-spacing: 0.03em;
        }

        .sheet-multi-user-at {
          font-size: 0.75rem;
          color: oklch(60% 0.016 58);
          letter-spacing: 0.02em;
        }

        .sheet-multi-note-wrap {
          margin-top: 10px;
        }

        .sheet-multi-note-label {
          font-size: 0.6875rem;
          font-weight: 600;
          color: oklch(60% 0.016 58);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .sheet-multi-empty {
          font-size: 0.8125rem;
          color: oklch(60% 0.014 58);
          font-style: italic;
          letter-spacing: 0.02em;
          padding: 4px 0;
        }

        .sheet-multi-section-divider {
          height: 1px;
          background: oklch(88% 0.014 58);
          margin: 16px 0;
        }
      `}</style>

      {/* Backdrop */}
      <div
        className="sheet-backdrop"
        onClick={safeClose}
        aria-hidden="true"
      />

      {/* Sheet panel */}
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-label="日期详情"
      >
        {/* Header */}
        <div className="sheet-header">
          <div className="sheet-date">{dateDisplay}</div>
          <button
            className="sheet-close-btn"
            onClick={safeClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="sheet-body">
          {/* ── Multi-user mode (timeline view) ── */}
          {multiUserData && multiUserData.length > 0 ? (
            <div className="sheet-multi-user-section">
              {multiUserData.map((userData, blockIdx) => (
                <div key={userData.user.id} className="sheet-multi-user-block">
                  {blockIdx > 0 && <div className="sheet-multi-section-divider" />}

                  {/* User header */}
                  <div className="sheet-multi-user-header">
                    <span
                      className="sheet-multi-user-dot"
                      style={{ background: userData.user.color }}
                    />
                    <span
                      className="sheet-multi-user-name"
                      style={{ color: userData.user.color }}
                    >
                      {userData.user.displayName}
                    </span>
                    <span className="sheet-multi-user-at">@{userData.user.username}</span>
                  </div>

                  {/* That user's events */}
                  {userData.occurrences.length === 0 ? (
                    <div className="sheet-multi-empty">暂无事件记录</div>
                  ) : (
                    userData.occurrences.map((occ) => {
                      const isCheck = occ.type === "CHECK";
                      return (
                        <div key={occ.taskId} className="sheet-event-group">
                          <div className="sheet-event-task-row">
                            <div
                              className="sheet-event-icon-wrap"
                              style={{ background: occ.color }}
                            >
                              {occ.icon}
                            </div>
                            <span className="sheet-event-name">{occ.name}</span>
                            {isCheck ? (
                              <span className="sheet-event-check-badge">已打卡</span>
                            ) : (
                              <span className="sheet-event-count">× {occ.totalCount}</span>
                            )}
                          </div>
                          <div className="sheet-occ-list">
                            {occ.occurrenceIds.map((oid, i) => (
                              <div key={oid} className="sheet-occ-row">
                                <span className="sheet-occ-label">
                                  {isCheck ? "✓ 已完成" : `第 ${i + 1} 次`}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* That user's note */}
                  {userData.note && (
                    (userData.note.content && userData.note.content.length > 0) ||
                    userData.note.images.length > 0
                  ) && (
                    <div className="sheet-multi-note-wrap">
                      <div className="sheet-multi-note-label">
                        <span style={{ opacity: 0.7, fontSize: "0.875rem" }}>✎</span>
                        心声
                      </div>
                      <NoteEditor
                        date={date}
                        note={userData.note}
                        readonly={true}
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* If all users have no events and no notes */}
              {multiUserData.every(
                (d) =>
                  d.occurrences.length === 0 &&
                  (!d.note ||
                    ((!d.note.content || d.note.content.length === 0) &&
                      d.note.images.length === 0))
              ) && (
                <div className="sheet-multi-empty">今日暂无记录</div>
              )}
            </div>
          ) : multiUserData ? (
            /* multiUserData provided but empty — no events for any user */
            <div className="sheet-section">
              <div className="sheet-empty-events">今日暂无记录</div>
            </div>
          ) : (
            /* ── Single-user mode (existing behavior) ── */
            <>
              {/* 当日事件 */}
              <div className="sheet-section">
                <div className="sheet-section-title">当日事件</div>
                {occurrences.length === 0 ? (
                  <div className="sheet-empty-events">今日暂无记录</div>
                ) : (
                  occurrences.map((occ) => {
                    const isCheck = occ.type === "CHECK";
                    return (
                      <div key={occ.taskId} className="sheet-event-group">
                        <div className="sheet-event-task-row">
                          <div
                            className="sheet-event-icon-wrap"
                            style={{ background: occ.color }}
                          >
                            {occ.icon}
                          </div>
                          <span className="sheet-event-name">{occ.name}</span>
                          {isCheck ? (
                            <span className="sheet-event-check-badge">已打卡</span>
                          ) : (
                            <span className="sheet-event-count">
                              × {occ.totalCount}
                            </span>
                          )}
                        </div>
                        {/* Per-occurrence remove rows — delete button hidden in readonly */}
                        <div className="sheet-occ-list">
                          {occ.occurrenceIds.map((oid, i) => (
                            <div key={oid} className="sheet-occ-row">
                              <span className="sheet-occ-label">
                                {isCheck
                                  ? "✓ 已完成"
                                  : `第 ${i + 1} 次`}
                              </span>
                              {!readonly && (
                                <button
                                  className="sheet-remove-btn"
                                  onClick={() => handleRemove(oid)}
                                  disabled={isPending}
                                  aria-label={`删除记录 ${i + 1}`}
                                  title="删除此记录"
                                >
                                  −
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* 添加 — entire section hidden in readonly */}
              {!readonly && (
                <div className="sheet-section">
                  <div className="sheet-section-title">添加</div>
                  {activeTasks.length === 0 ? (
                    <div className="sheet-empty-events">没有活跃任务</div>
                  ) : (
                    <div className="sheet-add-list">
                      {activeTasks.map((task) => {
                        const existing = occurrences.find((o) => o.taskId === task.id);
                        const isCheck = task.type === "CHECK";
                        const isChecked = !!existing;
                        return (
                          <div key={task.id} className="sheet-add-row">
                            <div
                              className="sheet-event-icon-wrap"
                              style={{ background: task.color }}
                            >
                              {task.icon}
                            </div>
                            <span className="sheet-add-task-name">{task.name}</span>
                            {isCheck ? (
                              <button
                                className={`sheet-add-btn${isChecked ? " check-active" : ""}`}
                                onClick={() => handleAdd(task)}
                                disabled={isPending}
                                title={isChecked ? "取消打卡" : "打卡"}
                                aria-label={`${isChecked ? "取消打卡" : "打卡"} ${task.name}`}
                              >
                                {isChecked ? "✓" : "○"}
                              </button>
                            ) : (
                              <button
                                className="sheet-add-btn"
                                onClick={() => handleAdd(task)}
                                disabled={isPending}
                                title="添加一次"
                                aria-label={`添加 ${task.name} 一次`}
                              >
                                +
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 当日心声 — note editor */}
              <div className="sheet-heartvoice-section">
                <div className="sheet-heartvoice-title">
                  <span className="sheet-heartvoice-quill">✎</span>
                  当日心声
                </div>
                <NoteEditor
                  date={date}
                  note={note}
                  onDirtyChange={readonly ? undefined : handleDirtyChange}
                  readonly={readonly}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
