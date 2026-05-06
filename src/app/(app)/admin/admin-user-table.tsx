"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { updateUserAction, resetPasswordAction, deleteUserAction } from "./actions";

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  color: string;
  isAdmin: boolean;
  createdAt: Date;
}

interface AdminUserTableProps {
  users: AdminUser[];
  currentUserId: number;
}

// ─── Dialog types ──────────────────────────────────────────────────────────

type DialogState =
  | { type: "none" }
  | { type: "edit"; user: AdminUser }
  | { type: "resetPw"; user: AdminUser }
  | { type: "delete"; user: AdminUser };

// ─── Shared dialog shell ───────────────────────────────────────────────────

function DialogBackdrop({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="aut-backdrop"
      aria-modal="true"
      role="dialog"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="aut-dialog">{children}</div>
    </div>
  );
}

// ─── Edit dialog ───────────────────────────────────────────────────────────

function EditDialog({
  user,
  currentUserId,
  onClose,
}: {
  user: AdminUser;
  currentUserId: number;
  onClose: () => void;
}) {
  const [selectedColor, setSelectedColor] = useState(user.color);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isSelf = user.id === currentUserId;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrorMsg("");
    const fd = new FormData(e.currentTarget);
    fd.set("color", selectedColor);
    const result = await updateUserAction(user.id, fd);
    setPending(false);
    if (!result.ok) {
      setErrorMsg(result.error ?? "保存失败");
    } else {
      onClose();
    }
  }

  return (
    <DialogBackdrop onClose={onClose}>
      <div className="aut-dialog-header">
        <h3 className="aut-dialog-heading">编辑账号</h3>
        <button type="button" className="aut-close-btn" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {errorMsg && (
        <div className="aut-error" role="alert">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {/* Username readonly */}
        <div className="aut-field">
          <span className="aut-label">用户名</span>
          <div className="aut-readonly">{user.username}</div>
        </div>

        {/* Display name */}
        <div className="aut-field">
          <label className="aut-label" htmlFor="ed-displayName">昵称</label>
          <input
            id="ed-displayName"
            name="displayName"
            type="text"
            required
            maxLength={30}
            defaultValue={user.displayName}
            className="aut-input"
            autoComplete="off"
          />
        </div>

        {/* Color */}
        <div className="aut-field">
          <span className="aut-label">颜色</span>
          <div className="aut-color-grid" role="radiogroup" aria-label="选择颜色">
            {(COLOR_PALETTE as readonly string[]).map((c) => (
              <button
                key={c}
                type="button"
                className="aut-color-dot"
                style={{ background: c }}
                data-selected={selectedColor === c ? "true" : "false"}
                aria-label={`颜色 ${c}`}
                aria-checked={selectedColor === c}
                role="radio"
                onClick={() => setSelectedColor(c)}
              />
            ))}
          </div>
          <input type="hidden" name="color" value={selectedColor} />
        </div>

        {/* isAdmin */}
        <div className="aut-field">
          <label className={`aut-check-row${isSelf ? " aut-check-row-disabled" : ""}`}>
            <input
              type="checkbox"
              name="isAdmin"
              defaultChecked={user.isAdmin}
              disabled={isSelf}
              className="aut-check"
              style={{ accentColor: "oklch(52% 0.12 38)" }}
            />
            <span className="aut-check-label">
              管理员权限
              {isSelf && (
                <span className="aut-hint-inline"> — 不能修改自己的权限</span>
              )}
            </span>
          </label>
        </div>

        <div className="aut-dialog-actions">
          <button type="submit" className="aut-btn-primary" disabled={pending}>
            {pending ? "保存中…" : "保存修改"}
          </button>
          <button type="button" className="aut-btn-ghost" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </DialogBackdrop>
  );
}

// ─── Reset Password dialog ─────────────────────────────────────────────────

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [pw, setPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mismatch = pw.length > 0 && confirmPw.length > 0 && pw !== confirmPw;
  const canSubmit = pw.length >= 6 && pw.length <= 100 && pw === confirmPw;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setPending(true);
    setErrorMsg("");
    const result = await resetPasswordAction(user.id, pw);
    setPending(false);
    if (!result.ok) {
      setErrorMsg(result.error ?? "重置失败");
    } else {
      onClose();
    }
  }

  return (
    <DialogBackdrop onClose={onClose}>
      <div className="aut-dialog-header">
        <h3 className="aut-dialog-heading">重置密码</h3>
        <button type="button" className="aut-close-btn" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="aut-warn-note">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }}>
          <path d="M8 2L14.93 14H1.07L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <path d="M8 7v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.7" fill="currentColor" />
        </svg>
        <span>
          正在为 <strong style={{ color: "oklch(32% 0.028 58)", fontWeight: 600 }}>{user.displayName}</strong>（{user.username}）重置密码。
          此操作将强制对方下线。
        </span>
      </div>

      {errorMsg && (
        <div className="aut-error" role="alert">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div className="aut-field">
          <label className="aut-label" htmlFor="rp-pw">新密码</label>
          <input
            id="rp-pw"
            type="password"
            required
            minLength={6}
            maxLength={100}
            placeholder="至少 6 字符"
            className="aut-input"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="aut-field">
          <label className="aut-label" htmlFor="rp-confirm">确认密码</label>
          <input
            id="rp-confirm"
            type="password"
            required
            minLength={6}
            maxLength={100}
            placeholder="再输入一次"
            className={`aut-input${mismatch ? " aut-input-error" : ""}`}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            autoComplete="new-password"
          />
          {mismatch && (
            <span className="aut-field-error">两次密码不一致</span>
          )}
        </div>

        <div className="aut-dialog-actions">
          <button type="submit" className="aut-btn-primary" disabled={pending || !canSubmit}>
            {pending ? "重置中…" : "确认重置"}
          </button>
          <button type="button" className="aut-btn-ghost" onClick={onClose}>
            取消
          </button>
        </div>
      </form>
    </DialogBackdrop>
  );
}

// ─── Delete dialog ─────────────────────────────────────────────────────────

function DeleteDialog({
  user,
  onClose,
}: {
  user: AdminUser;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus confirm input on mount
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  const canDelete = confirmText === user.username;

  async function handleDelete() {
    if (!canDelete) return;
    setPending(true);
    setErrorMsg("");
    const result = await deleteUserAction(user.id);
    setPending(false);
    if (!result.ok) {
      setErrorMsg(result.error ?? "删除失败");
    } else {
      onClose();
    }
  }

  return (
    <DialogBackdrop onClose={onClose}>
      <div className="aut-dialog-header">
        <h3 className="aut-dialog-heading aut-dialog-heading-danger">永久删除账号</h3>
        <button type="button" className="aut-close-btn" onClick={onClose} aria-label="关闭">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="aut-danger-note">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }}>
          <path d="M8 2L14.93 14H1.07L8 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="oklch(96% 0.025 28 / 0.5)" />
          <path d="M8 7v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="8" cy="12" r="0.7" fill="currentColor" />
        </svg>
        <span>
          此操作<strong>不可恢复</strong>，将一并删除 <strong style={{ color: "oklch(30% 0.025 58)" }}>{user.displayName}</strong>（{user.username}）的所有任务、事件、心声与图片。
        </span>
      </div>

      {errorMsg && (
        <div className="aut-error" role="alert">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
          {errorMsg}
        </div>
      )}

      <div className="aut-field" style={{ marginTop: "16px" }}>
        <label className="aut-label" htmlFor="del-confirm">
          请输入用户名 <code className="aut-code">{user.username}</code> 确认删除
        </label>
        <input
          id="del-confirm"
          ref={inputRef}
          type="text"
          className="aut-input"
          placeholder={user.username}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      <div className="aut-dialog-actions" style={{ marginTop: "20px" }}>
        <button
          type="button"
          className="aut-btn-danger"
          disabled={pending || !canDelete}
          onClick={handleDelete}
        >
          {pending ? "删除中…" : "永久删除"}
        </button>
        <button type="button" className="aut-btn-ghost" onClick={onClose}>
          取消
        </button>
      </div>
    </DialogBackdrop>
  );
}

// ─── Main table component ──────────────────────────────────────────────────

export function AdminUserTable({ users, currentUserId }: AdminUserTableProps) {
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });

  const closeDialog = useCallback(() => setDialog({ type: "none" }), []);

  // Format createdAt as YYYY-MM-DD safely (avoid hydration mismatch)
  function formatDate(d: Date): string {
    const date = new Date(d);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  return (
    <>
      <style>{`
        /* ── AdminUserTable ────────────────────────────────────────── */
        .aut-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        .aut-table {
          width: 100%;
          border-collapse: collapse;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          font-size: 0.875rem;
          color: oklch(28% 0.025 58);
        }

        .aut-table th {
          text-align: left;
          padding: 10px 14px;
          font-size: 0.75rem;
          font-weight: 600;
          color: oklch(52% 0.018 58);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-bottom: 2px solid oklch(86% 0.014 58);
          white-space: nowrap;
          background: oklch(98% 0.010 62);
        }

        .aut-table td {
          padding: 12px 14px;
          border-bottom: 1px solid oklch(90% 0.012 62);
          vertical-align: middle;
        }

        .aut-table tbody tr {
          transition: background-color 0.1s;
        }

        .aut-table tbody tr:hover {
          background: oklch(97.5% 0.010 62);
        }

        .aut-table tbody tr[data-self="true"] {
          background: oklch(97% 0.014 65);
        }

        .aut-table tbody tr[data-self="true"]:hover {
          background: oklch(95.5% 0.016 65);
        }

        .aut-username {
          font-family: "SF Mono", "Fira Code", "Fira Mono", ui-monospace, monospace;
          font-size: 0.8125rem;
          color: oklch(34% 0.026 58);
          letter-spacing: 0.01em;
        }

        .aut-display-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .aut-color-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .aut-self-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 7px;
          background: oklch(88% 0.022 65);
          border-radius: 10px;
          font-size: 0.6875rem;
          font-weight: 600;
          color: oklch(40% 0.040 65);
          letter-spacing: 0.04em;
          margin-left: 5px;
          vertical-align: middle;
        }

        .aut-admin-check {
          font-size: 0.875rem;
          color: oklch(40% 0.12 145);
          font-weight: 600;
        }

        .aut-admin-dash {
          color: oklch(70% 0.018 58);
        }

        .aut-date {
          font-size: 0.8125rem;
          color: oklch(56% 0.018 58);
          white-space: nowrap;
          font-feature-settings: "tnum";
        }

        /* Action buttons in table */
        .aut-ops {
          display: flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }

        .aut-op-btn {
          padding: 5px 11px;
          border-radius: 3px;
          border: 1px solid oklch(84% 0.014 58);
          background: transparent;
          font-size: 0.8125rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(40% 0.022 58);
          cursor: pointer;
          letter-spacing: 0.02em;
          transition: border-color 0.1s, background-color 0.1s, color 0.1s;
          outline: none;
          line-height: 1.4;
        }

        .aut-op-btn:hover:not(:disabled) {
          border-color: oklch(64% 0.022 58);
          color: oklch(28% 0.025 58);
          background: oklch(96% 0.012 62);
        }

        .aut-op-btn:focus-visible {
          box-shadow: 0 0 0 2px oklch(62% 0.10 38 / 0.3);
        }

        .aut-op-btn:disabled {
          opacity: 0.38;
          cursor: not-allowed;
          border-color: oklch(88% 0.012 58);
        }

        .aut-op-btn-danger:hover:not(:disabled) {
          border-color: oklch(64% 0.08 28);
          color: oklch(38% 0.14 28);
          background: oklch(97% 0.018 28);
        }

        /* ── Dialogs ──────────────────────────────────────────────── */
        .aut-backdrop {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: oklch(18% 0.02 58 / 0.38);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          animation: aut-backdrop-in 0.15s ease;
        }

        @keyframes aut-backdrop-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .aut-dialog {
          background: oklch(99% 0.008 62);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 8px;
          padding: 28px 32px;
          width: 100%;
          max-width: 440px;
          box-shadow: 0 8px 40px oklch(22% 0.02 58 / 0.18), 0 2px 8px oklch(22% 0.02 58 / 0.08);
          animation: aut-dialog-in 0.18s ease;
          max-height: 90dvh;
          overflow-y: auto;
        }

        @keyframes aut-dialog-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .aut-dialog-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 18px;
          gap: 12px;
        }

        .aut-dialog-heading {
          margin: 0;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.125rem;
          font-weight: 400;
          color: oklch(24% 0.025 58);
          letter-spacing: 0.06em;
          line-height: 1.3;
        }

        .aut-dialog-heading-danger {
          color: oklch(34% 0.12 28);
        }

        .aut-close-btn {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: oklch(56% 0.018 58);
          border-radius: 4px;
          transition: color 0.1s, background-color 0.1s;
          outline: none;
          flex-shrink: 0;
          display: flex;
          align-items: center;
        }

        .aut-close-btn:hover {
          color: oklch(32% 0.025 58);
          background: oklch(94% 0.012 62);
        }

        .aut-close-btn:focus-visible {
          box-shadow: 0 0 0 2px oklch(62% 0.10 38 / 0.3);
        }

        /* Warn + danger notes */
        .aut-warn-note {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px 14px;
          background: oklch(97% 0.018 62);
          border: 1px solid oklch(82% 0.018 58);
          border-radius: 4px;
          font-size: 0.875rem;
          color: oklch(36% 0.022 58);
          line-height: 1.55;
          margin-bottom: 18px;
        }

        .aut-danger-note {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          padding: 11px 14px;
          background: oklch(96% 0.025 28);
          border: 1px solid oklch(78% 0.06 28);
          border-radius: 4px;
          font-size: 0.875rem;
          color: oklch(34% 0.12 28);
          line-height: 1.55;
          margin-bottom: 18px;
        }

        /* Error banner inside dialog */
        .aut-error {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 14px;
          padding: 10px 13px;
          background: oklch(96% 0.025 28);
          border: 1px solid oklch(72% 0.08 28);
          border-radius: 4px;
          color: oklch(38% 0.14 28);
          font-size: 0.875rem;
          line-height: 1.5;
        }

        /* Fields */
        .aut-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .aut-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: oklch(46% 0.022 58);
          letter-spacing: 0.03em;
        }

        .aut-readonly {
          padding: 9px 12px;
          background: oklch(94% 0.012 62);
          border: 1px solid oklch(86% 0.014 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          color: oklch(46% 0.022 58);
          font-family: "SF Mono", "Fira Code", "Fira Mono", ui-monospace, monospace;
          letter-spacing: 0.01em;
        }

        .aut-input {
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

        .aut-input::placeholder { color: oklch(68% 0.016 58); }
        .aut-input:hover { border-color: oklch(70% 0.02 58); }
        .aut-input:focus-visible {
          border-color: oklch(52% 0.12 38);
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.25);
        }

        .aut-input-error {
          border-color: oklch(58% 0.12 28) !important;
        }

        .aut-field-error {
          font-size: 0.8125rem;
          color: oklch(42% 0.14 28);
          letter-spacing: 0.02em;
        }

        /* Color picker in dialog */
        .aut-color-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          padding-top: 3px;
        }

        .aut-color-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.12s ease;
          outline: none;
          flex-shrink: 0;
        }
        .aut-color-dot:hover { transform: scale(1.12); }
        .aut-color-dot:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.35);
        }
        .aut-color-dot[data-selected="true"] {
          border-color: oklch(22% 0.025 58);
          transform: scale(1.18);
          box-shadow: 0 0 0 2px oklch(99% 0.008 62), 0 0 0 4px oklch(22% 0.025 58 / 0.4);
        }

        /* Checkbox row */
        .aut-check-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding-top: 2px;
        }
        .aut-check-row-disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }
        .aut-check {
          width: 16px;
          height: 16px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .aut-check-label {
          font-size: 0.9375rem;
          color: oklch(36% 0.024 58);
          letter-spacing: 0.02em;
        }
        .aut-hint-inline {
          font-size: 0.8125rem;
          color: oklch(58% 0.016 58);
          font-style: italic;
        }

        /* Code inline */
        .aut-code {
          font-family: "SF Mono", "Fira Code", "Fira Mono", ui-monospace, monospace;
          font-size: 0.875em;
          background: oklch(94% 0.012 62);
          padding: 1px 5px;
          border-radius: 3px;
          color: oklch(34% 0.026 58);
        }

        /* Dialog action buttons */
        .aut-dialog-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
        }

        .aut-btn-primary {
          padding: 9px 20px;
          background: oklch(52% 0.12 38);
          color: oklch(99% 0.006 62);
          border: none;
          border-radius: 4px;
          font-size: 0.9375rem;
          font-weight: 500;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background-color 0.12s, box-shadow 0.12s;
          outline: none;
        }
        .aut-btn-primary:hover:not(:disabled) {
          background: oklch(46% 0.14 38);
          box-shadow: 0 2px 8px oklch(52% 0.12 38 / 0.25);
        }
        .aut-btn-primary:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.35);
        }
        .aut-btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .aut-btn-ghost {
          padding: 9px 18px;
          background: transparent;
          color: oklch(46% 0.022 58);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          cursor: pointer;
          transition: border-color 0.12s, color 0.12s;
          outline: none;
        }
        .aut-btn-ghost:hover {
          border-color: oklch(62% 0.022 58);
          color: oklch(32% 0.025 58);
        }
        .aut-btn-ghost:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }

        .aut-btn-danger {
          padding: 9px 18px;
          background: oklch(96% 0.025 28);
          color: oklch(36% 0.14 28);
          border: 1px solid oklch(68% 0.10 28);
          border-radius: 4px;
          font-size: 0.9375rem;
          font-weight: 500;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: background-color 0.12s, border-color 0.12s, color 0.12s;
          outline: none;
        }
        .aut-btn-danger:hover:not(:disabled) {
          background: oklch(42% 0.16 28);
          border-color: oklch(42% 0.16 28);
          color: oklch(99% 0.006 62);
        }
        .aut-btn-danger:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 28 / 0.35);
        }
        .aut-btn-danger:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>

      {/* Dialogs */}
      {dialog.type === "edit" && (
        <EditDialog user={dialog.user} currentUserId={currentUserId} onClose={closeDialog} />
      )}
      {dialog.type === "resetPw" && (
        <ResetPasswordDialog user={dialog.user} onClose={closeDialog} />
      )}
      {dialog.type === "delete" && (
        <DeleteDialog user={dialog.user} onClose={closeDialog} />
      )}

      <div className="aut-wrap">
        <table className="aut-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>昵称</th>
              <th>管理员</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isSelf = u.id === currentUserId;
              return (
                <tr key={u.id} data-self={isSelf ? "true" : "false"}>
                  {/* Username */}
                  <td>
                    <span className="aut-username">{u.username}</span>
                    {isSelf && <span className="aut-self-badge">你</span>}
                  </td>

                  {/* Display name with color dot */}
                  <td>
                    <div className="aut-display-cell">
                      <span
                        className="aut-color-dot"
                        style={{ background: u.color }}
                        aria-hidden="true"
                      />
                      {u.displayName}
                    </div>
                  </td>

                  {/* Admin indicator */}
                  <td>
                    {u.isAdmin ? (
                      <span className="aut-admin-check" aria-label="是">✓</span>
                    ) : (
                      <span className="aut-admin-dash" aria-label="否">—</span>
                    )}
                  </td>

                  {/* Created date */}
                  <td>
                    <span className="aut-date">{formatDate(u.createdAt)}</span>
                  </td>

                  {/* Operations */}
                  <td>
                    <div className="aut-ops">
                      <button
                        type="button"
                        className="aut-op-btn"
                        onClick={() => setDialog({ type: "edit", user: u })}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="aut-op-btn"
                        disabled={isSelf}
                        title={isSelf ? "请前往「设置」修改自己的密码" : `重置 ${u.displayName} 的密码`}
                        onClick={() => setDialog({ type: "resetPw", user: u })}
                      >
                        重置密码
                      </button>
                      <button
                        type="button"
                        className="aut-op-btn aut-op-btn-danger"
                        disabled={isSelf}
                        title={isSelf ? "不能删除自己" : `永久删除 ${u.displayName}`}
                        onClick={() => setDialog({ type: "delete", user: u })}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
