"use client";

import { useActionState, useState, useEffect } from "react";
import { EmojiPicker } from "./emoji-picker";
import { COLOR_PALETTE, TASK_NAME_MAX } from "@/lib/task-validation";
import { createTaskAction, updateTaskAction } from "./actions";
import type { Task } from "@prisma/client";

type FormMode = "create" | "edit";

interface CustomCategory {
  id: number;
  name: string;
  emojis: Array<{ id: number; emoji: string }>;
}

interface TaskFormProps {
  mode: FormMode;
  task?: Task; // provided in edit mode
  onClose: () => void;
  customCategories: CustomCategory[];
}

type ActionState = { ok: boolean; error?: string } | null;

export function TaskForm({ mode, task, onClose, customCategories }: TaskFormProps) {
  const isEdit = mode === "edit";

  // Local controlled state for fields that drive UI changes
  const [icon, setIcon] = useState(task?.icon ?? "");
  const [color, setColor] = useState<string>(task?.color ?? COLOR_PALETTE[0]);
  const [type, setType] = useState<"COUNTED" | "CHECK">(task?.type ?? "COUNTED");

  // useActionState: wrap server actions into (prevState, formData) => Promise<State> shape
  const [createState, createDispatch, createPending] = useActionState(
    async (_prev: ActionState, fd: FormData): Promise<ActionState> => createTaskAction(fd),
    null
  );

  // For edit: bind taskId into the action call
  const taskId = task?.id ?? 0;
  const [editState, editDispatch, editPending] = useActionState(
    async (_prev: ActionState, fd: FormData): Promise<ActionState> => updateTaskAction(taskId, fd),
    null
  );

  const state = isEdit ? editState : createState;
  const dispatch = isEdit ? editDispatch : createDispatch;
  const pending = isEdit ? editPending : createPending;

  // Close on success
  useEffect(() => {
    if (state?.ok === true) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div style={formWrapStyle}>
      <style>{`
        .task-form-inner { animation: task-form-in 0.2s ease-out both; }
        @keyframes task-form-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tf-input {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          padding: 9px 12px;
          background: oklch(99% 0.006 62);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          color: oklch(22% 0.025 58);
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          line-height: 1.5;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          box-sizing: border-box;
        }
        .tf-input::placeholder { color: oklch(68% 0.016 58); }
        .tf-input:hover:not(:disabled) { border-color: oklch(70% 0.02 58); }
        .tf-input:focus-visible {
          border-color: oklch(52% 0.12 38);
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.25);
        }
        .tf-input:disabled { opacity: 0.55; cursor: not-allowed; background: oklch(95% 0.01 58); }
        .tf-select {
          appearance: none;
          -webkit-appearance: none;
          padding: 9px 32px 9px 12px;
          background: oklch(99% 0.006 62) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23998870' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 10px center;
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          color: oklch(22% 0.025 58);
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          line-height: 1.5;
          cursor: pointer;
          transition: border-color 0.15s, box-shadow 0.15s;
          outline: none;
          min-width: 84px;
          box-sizing: border-box;
        }
        .tf-select:focus-visible {
          border-color: oklch(52% 0.12 38);
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.25);
        }
        .tf-submit:hover:not(:disabled) {
          background: oklch(46% 0.14 38) !important;
          box-shadow: 0 2px 8px oklch(52% 0.12 38 / 0.25);
        }
        .tf-cancel:hover {
          border-color: oklch(62% 0.022 58) !important;
          background: oklch(96% 0.010 62) !important;
        }
      `}</style>

      <div className="task-form-inner" style={formPanelStyle}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={formHeadingStyle}>{isEdit ? "编辑任务" : "新建任务"}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            style={closeButtonStyle}
          >
            ×
          </button>
        </div>

        {/* Error banner */}
        {state?.ok === false && state.error && (
          <div role="alert" style={errorBannerStyle}>
            ⚠ {state.error}
          </div>
        )}

        <form action={dispatch} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Hidden controlled fields */}
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />
          {/* In edit mode, send the locked type from the existing task */}
          {isEdit && <input type="hidden" name="type" value={task?.type} />}

          {/* Name */}
          <div style={fieldStyle}>
            <label style={labelStyle} htmlFor="tf-name">名称</label>
            <input
              id="tf-name"
              name="name"
              type="text"
              required
              maxLength={TASK_NAME_MAX}
              defaultValue={task?.name ?? ""}
              placeholder="给任务起个名字…"
              className="tf-input"
            />
          </div>

          {/* Icon + Color row */}
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* Icon */}
            <div style={{ ...fieldStyle, flexShrink: 0 }}>
              <label style={labelStyle}>图标</label>
              <EmojiPicker value={icon} onChange={setIcon} customCategories={customCategories} />
            </div>

            {/* Color palette */}
            <div style={{ ...fieldStyle, flex: 1 }}>
              <label style={labelStyle}>颜色</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
                {COLOR_PALETTE.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    data-color-pick={hex}
                    aria-label={`选择颜色 ${hex}`}
                    aria-pressed={color === hex}
                    onClick={() => setColor(hex)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: hex,
                      border: color === hex
                        ? `2px solid oklch(22% 0.025 58)`
                        : "2px solid transparent",
                      outline: color === hex ? `2.5px solid ${hex}` : "none",
                      outlineOffset: 2,
                      cursor: "pointer",
                      transition: "transform 0.1s, outline 0.12s",
                      transform: color === hex ? "scale(1.2)" : "scale(1)",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (color !== hex) {
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (color !== hex) {
                        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Type radio */}
          <div style={fieldStyle}>
            <label style={labelStyle}>类型</label>
            <div style={{ display: "flex", gap: 16 }}>
              {(["COUNTED", "CHECK"] as const).map((t) => (
                <label
                  key={t}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    cursor: isEdit ? "not-allowed" : "pointer",
                    opacity: isEdit && task?.type !== t ? 0.38 : 1,
                    fontSize: "0.9375rem",
                    color: "oklch(22% 0.025 58)",
                    letterSpacing: "0.01em",
                  }}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    checked={type === t}
                    onChange={() => !isEdit && setType(t)}
                    disabled={isEdit}
                    style={{
                      accentColor: "oklch(52% 0.12 38)",
                      width: 16,
                      height: 16,
                      cursor: isEdit ? "not-allowed" : "pointer",
                    }}
                  />
                  {t === "COUNTED" ? "次数型" : "打卡型"}
                </label>
              ))}
            </div>
            {isEdit && (
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "oklch(58% 0.018 58)", fontStyle: "italic" }}>
                任务类型在创建后不可修改
              </p>
            )}
          </div>

          {/* COUNTED-only fields */}
          {type === "COUNTED" && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
              <div style={{ ...fieldStyle, flex: 1 }}>
                <label style={labelStyle} htmlFor="tf-count">目标次数</label>
                <input
                  id="tf-count"
                  name="targetCount"
                  type="number"
                  min={1}
                  required
                  defaultValue={task?.targetCount ?? 1}
                  className="tf-input"
                />
              </div>
              <div style={{ ...fieldStyle, flexShrink: 0 }}>
                <label style={labelStyle} htmlFor="tf-period">周期</label>
                <select
                  id="tf-period"
                  name="targetPeriod"
                  required
                  defaultValue={task?.targetPeriod ?? "WEEK"}
                  className="tf-select"
                >
                  <option value="DAY">每日</option>
                  <option value="WEEK">每周</option>
                  <option value="MONTH">每月</option>
                </select>
              </div>
            </div>
          )}

          {/* Private toggle */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              name="isPrivate"
              type="checkbox"
              defaultChecked={task?.isPrivate ?? false}
              style={{ width: 16, height: 16, accentColor: "oklch(52% 0.12 38)", cursor: "pointer" }}
            />
            <span style={{ ...labelStyle }}>私密（仅自己可见）</span>
          </label>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="submit"
              disabled={pending}
              className="tf-submit"
              style={{
                flex: 1,
                padding: "10px 20px",
                background: pending ? "oklch(65% 0.08 38)" : "oklch(52% 0.12 38)",
                color: "oklch(99% 0.006 62)",
                border: "none",
                borderRadius: 4,
                fontSize: "0.9375rem",
                fontWeight: 500,
                fontFamily: '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
                letterSpacing: "0.04em",
                cursor: pending ? "not-allowed" : "pointer",
                transition: "background 0.12s, box-shadow 0.12s",
              }}
            >
              {pending ? "保存中…" : isEdit ? "保存修改" : "创建任务"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="tf-cancel"
              style={{
                padding: "10px 16px",
                background: "transparent",
                color: "oklch(46% 0.022 58)",
                border: "1px solid oklch(82% 0.016 58)",
                borderRadius: 4,
                fontSize: "0.9375rem",
                fontFamily: '"Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
                cursor: "pointer",
                transition: "border-color 0.12s, background 0.12s",
              }}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const formWrapStyle: React.CSSProperties = {
  marginBottom: 24,
};

const formPanelStyle: React.CSSProperties = {
  background: "oklch(98.5% 0.010 62)",
  border: "1px solid oklch(82% 0.016 58)",
  borderRadius: 8,
  padding: "24px 28px",
  boxShadow: "0 2px 16px oklch(22% 0.02 58 / 0.08)",
};

const formHeadingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: '"Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif',
  fontSize: "1.125rem",
  fontWeight: 400,
  color: "oklch(22% 0.025 58)",
  letterSpacing: "0.05em",
};

const fieldStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "oklch(46% 0.022 58)",
  letterSpacing: "0.03em",
};

const errorBannerStyle: React.CSSProperties = {
  marginBottom: 16,
  padding: "10px 14px",
  background: "oklch(96% 0.025 28)",
  border: "1px solid oklch(72% 0.08 28)",
  borderRadius: 4,
  color: "oklch(38% 0.14 28)",
  fontSize: "0.875rem",
  lineHeight: 1.5,
};

const closeButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "1.5rem",
  lineHeight: 1,
  color: "oklch(56% 0.018 58)",
  cursor: "pointer",
  padding: "2px 6px",
  borderRadius: 4,
};
