"use client";

import { useState } from "react";
import type { Task } from "@prisma/client";
import { TaskForm } from "./task-form";
import { ActiveTaskCard, ArchivedTaskRow } from "./task-card";

interface CustomCategory {
  id: number;
  name: string;
  emojis: Array<{ id: number; emoji: string }>;
}

interface TasksClientProps {
  active: Task[];
  archived: Task[];
  customCategories: CustomCategory[];
}

export function TasksClient({ active, archived, customCategories }: TasksClientProps) {
  const [creating, setCreating] = useState(false);

  return (
    <>
      <style>{`
        .archived-details summary {
          cursor: pointer;
          user-select: none;
          -webkit-user-select: none;
        }
        .archived-details summary::-webkit-details-marker { display: none; }
        .archived-details[open] .archive-chevron { transform: rotate(90deg); }
        .archive-chevron {
          display: inline-block;
          transition: transform 0.18s ease;
          margin-right: 6px;
        }
        .task-card-hover:hover {
          box-shadow: 0 3px 12px oklch(22% 0.02 58 / 0.09);
        }
      `}</style>

      {/* ── Create form or trigger button ── */}
      {creating ? (
        <TaskForm mode="create" onClose={() => setCreating(false)} customCategories={customCategories} />
      ) : (
        <div style={{ marginBottom: 28 }}>
          <button
            type="button"
            onClick={() => setCreating(true)}
            style={newTaskBtnStyle}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = "oklch(46% 0.14 38)";
              btn.style.boxShadow = "0 2px 10px oklch(52% 0.12 38 / 0.28)";
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement;
              btn.style.background = "oklch(52% 0.12 38)";
              btn.style.boxShadow = "none";
            }}
          >
            <span style={{ fontSize: "1.1em", lineHeight: 1 }}>＋</span>
            新建任务
          </button>
        </div>
      )}

      {/* ── Active tasks ── */}
      <section style={{ marginBottom: 40 }}>
        <h2 style={sectionHeadingStyle}>
          进行中
          <span style={countBadgeStyle}>{active.length}</span>
        </h2>

        {active.length === 0 ? (
          <div style={emptyStateStyle}>
            <div style={{ fontSize: "2rem", marginBottom: 10 }}>🌱</div>
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              还没有任务，从这里开始记录今天的故事吧
            </p>
            <p style={{ margin: "8px 0 0", fontSize: "0.8125rem", color: "oklch(62% 0.016 58)" }}>
              点击「新建任务」来添加你的第一个任务
            </p>
          </div>
        ) : (
          <ul style={{ padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {active.map((task) => (
              <ActiveTaskCard key={task.id} task={task} customCategories={customCategories} />
            ))}
          </ul>
        )}
      </section>

      {/* ── Archived tasks ── */}
      {archived.length > 0 && (
        <section>
          <details className="archived-details">
            <summary style={archiveSummaryStyle}>
              <span className="archive-chevron">▶</span>
              已归档
              <span style={{ ...countBadgeStyle, background: "oklch(90% 0.010 58)", color: "oklch(50% 0.018 58)" }}>
                {archived.length}
              </span>
            </summary>

            <ul style={{ padding: "16px 0 0 0", margin: 0 }}>
              {archived.map((task) => (
                <ArchivedTaskRow key={task.id} task={task} />
              ))}
            </ul>
          </details>
        </section>
      )}
    </>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const newTaskBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "10px 20px",
  background: "oklch(52% 0.12 38)",
  color: "oklch(99% 0.006 62)",
  border: "none",
  borderRadius: 6,
  fontSize: "0.9375rem",
  fontWeight: 500,
  fontFamily: '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  letterSpacing: "0.04em",
  cursor: "pointer",
  transition: "background 0.12s, box-shadow 0.12s",
};

const sectionHeadingStyle: React.CSSProperties = {
  fontFamily: '"Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif',
  fontSize: "1.0625rem",
  fontWeight: 400,
  color: "oklch(34% 0.022 58)",
  letterSpacing: "0.05em",
  margin: "0 0 14px 0",
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const countBadgeStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 10,
  background: "oklch(92% 0.018 58)",
  color: "oklch(42% 0.022 58)",
  letterSpacing: "0.02em",
  fontVariantNumeric: "tabular-nums",
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "40px 20px",
  color: "oklch(54% 0.018 58)",
  fontSize: "0.9375rem",
  lineHeight: 1.6,
  background: "oklch(98% 0.010 62)",
  border: "1px dashed oklch(82% 0.016 58)",
  borderRadius: 8,
  letterSpacing: "0.02em",
};

const archiveSummaryStyle: React.CSSProperties = {
  fontSize: "0.9375rem",
  fontWeight: 500,
  color: "oklch(50% 0.018 58)",
  letterSpacing: "0.03em",
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "8px 0",
  listStyle: "none",
};
