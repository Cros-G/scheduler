"use client";

import { useState } from "react";
import type { Task } from "@prisma/client";
import { TaskForm } from "./task-form";
import {
  archiveTaskFormAction,
  unarchiveTaskFormAction,
  deleteTaskFormAction,
} from "./actions";

const PERIOD_LABEL: Record<string, string> = {
  DAY: "每日",
  WEEK: "每周",
  MONTH: "每月",
};

interface ActiveTaskCardProps {
  task: Task;
}

export function ActiveTaskCard({ task }: ActiveTaskCardProps) {
  const [editing, setEditing] = useState(false);

  const targetSummary =
    task.type === "COUNTED" && task.targetCount && task.targetPeriod
      ? `${PERIOD_LABEL[task.targetPeriod]} ${task.targetCount} 次`
      : "每日打卡";

  return (
    <li style={{ listStyle: "none" }}>
      <div
        style={cardStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow =
            "0 3px 12px oklch(22% 0.02 58 / 0.09)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
        }}
      >
        {/* Color accent circle with icon */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            background: task.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.375rem",
            flexShrink: 0,
            opacity: 0.9,
          }}
        >
          {task.icon}
        </div>

        {/* Task info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={taskNameStyle}>{task.name}</span>
            <span style={typeBadgeStyle(task.type === "COUNTED")}>
              {task.type === "COUNTED" ? "次数" : "打卡"}
            </span>
            {task.isPrivate && (
              <span style={privateBadgeStyle}>私密</span>
            )}
          </div>
          <div style={targetSummaryStyle}>{targetSummary}</div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            style={actionBtnStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(62% 0.022 58)";
              (e.currentTarget as HTMLButtonElement).style.background = "oklch(97% 0.010 62)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(82% 0.016 58)";
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            {editing ? "收起" : "编辑"}
          </button>

          {/* Archive form */}
          <form action={archiveTaskFormAction}>
            <input type="hidden" name="taskId" value={task.id} />
            <button
              type="submit"
              style={actionBtnStyle}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(62% 0.022 58)";
                (e.currentTarget as HTMLButtonElement).style.background = "oklch(97% 0.010 62)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(82% 0.016 58)";
                (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              }}
            >
              归档
            </button>
          </form>
        </div>
      </div>

      {/* Inline edit form */}
      {editing && (
        <div style={{ marginTop: 8 }}>
          <TaskForm mode="edit" task={task} onClose={() => setEditing(false)} />
        </div>
      )}
    </li>
  );
}

interface ArchivedTaskRowProps {
  task: Task;
}

export function ArchivedTaskRow({ task }: ArchivedTaskRowProps) {
  return (
    <li
      style={{
        listStyle: "none",
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid oklch(90% 0.012 58)",
      }}
    >
      {/* Small muted icon */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: task.color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1rem",
          opacity: 0.45,
          flexShrink: 0,
        }}
      >
        {task.icon}
      </div>

      <span
        style={{
          flex: 1,
          fontSize: "0.9375rem",
          color: "oklch(55% 0.016 58)",
          letterSpacing: "0.03em",
          textDecoration: "line-through",
          textDecorationColor: "oklch(70% 0.012 58)",
        }}
      >
        {task.name}
      </span>

      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {/* Unarchive form */}
        <form action={unarchiveTaskFormAction}>
          <input type="hidden" name="taskId" value={task.id} />
          <button
            type="submit"
            style={{ ...actionBtnStyle, color: "oklch(36% 0.10 155)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "oklch(95% 0.016 155)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(60% 0.10 155)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(82% 0.016 58)";
            }}
          >
            恢复
          </button>
        </form>

        {/* Delete button (needs confirm dialog, so client-side) */}
        <DeleteButtonInline taskId={task.id} taskName={task.name} />
      </div>
    </li>
  );
}

// ─── Delete button (needs window.confirm, uses form submit) ──────────────────

function DeleteButtonInline({
  taskId,
  taskName,
}: {
  taskId: number;
  taskName: string;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      `确定永久删除「${taskName}」？此操作不可撤销。`
    );
    if (!confirmed) {
      e.preventDefault();
    }
    // If confirmed, form submits normally to the server action
  }

  return (
    <form
      action={deleteTaskFormAction}
      onSubmit={handleSubmit}
      style={{ display: "inline" }}
    >
      <input type="hidden" name="taskId" value={taskId} />
      <button
        type="submit"
        style={{
          padding: "5px 10px",
          fontSize: "0.75rem",
          background: "transparent",
          color: "oklch(42% 0.12 28)",
          border: "1px solid oklch(78% 0.07 28)",
          borderRadius: 4,
          cursor: "pointer",
          fontFamily:
            '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
          letterSpacing: "0.02em",
          transition: "background 0.12s, color 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = "oklch(95% 0.025 28)";
          btn.style.color = "oklch(35% 0.14 28)";
          btn.style.borderColor = "oklch(62% 0.10 28)";
        }}
        onMouseLeave={(e) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.style.background = "transparent";
          btn.style.color = "oklch(42% 0.12 28)";
          btn.style.borderColor = "oklch(78% 0.07 28)";
        }}
      >
        永久删除
      </button>
    </form>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "14px 16px",
  background: "oklch(99% 0.006 62)",
  border: "1px solid oklch(88% 0.014 58)",
  borderRadius: 8,
  transition: "box-shadow 0.15s",
};

const taskNameStyle: React.CSSProperties = {
  fontFamily:
    '"Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif',
  fontSize: "1rem",
  fontWeight: 400,
  color: "oklch(22% 0.025 58)",
  letterSpacing: "0.04em",
};

const targetSummaryStyle: React.CSSProperties = {
  marginTop: 3,
  fontSize: "0.8125rem",
  color: "oklch(56% 0.018 58)",
  letterSpacing: "0.02em",
};

const actionBtnStyle: React.CSSProperties = {
  padding: "5px 10px",
  fontSize: "0.75rem",
  background: "transparent",
  color: "oklch(46% 0.022 58)",
  border: "1px solid oklch(82% 0.016 58)",
  borderRadius: 4,
  cursor: "pointer",
  fontFamily:
    '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  letterSpacing: "0.02em",
  transition: "background 0.12s, border-color 0.12s",
};

function typeBadgeStyle(isCounted: boolean): React.CSSProperties {
  return {
    fontSize: "0.6875rem",
    fontWeight: 500,
    padding: "2px 7px",
    borderRadius: 10,
    background: isCounted
      ? "oklch(94% 0.016 235)"
      : "oklch(94% 0.016 155)",
    color: isCounted
      ? "oklch(36% 0.10 235)"
      : "oklch(32% 0.10 155)",
    letterSpacing: "0.04em",
  };
}

const privateBadgeStyle: React.CSSProperties = {
  fontSize: "0.6875rem",
  fontWeight: 500,
  padding: "2px 7px",
  borderRadius: 10,
  background: "oklch(94% 0.016 62)",
  color: "oklch(40% 0.08 62)",
  letterSpacing: "0.04em",
};
