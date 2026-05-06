"use client";

import { useState, useRef } from "react";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { createUserAction } from "./actions";

const DEFAULT_COLOR = COLOR_PALETTE[0];

export function CreateUserForm() {
  const [open, setOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState<string>(DEFAULT_COLOR);
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  function handleToggle() {
    setOpen((v) => !v);
    setErrorMsg("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrorMsg("");
    const fd = new FormData(e.currentTarget);
    fd.set("color", selectedColor);
    const result = await createUserAction(fd);
    setPending(false);
    if (!result.ok) {
      setErrorMsg(result.error ?? "创建失败，请重试");
    } else {
      // Success: collapse + reset
      formRef.current?.reset();
      setSelectedColor(DEFAULT_COLOR);
      setOpen(false);
    }
  }

  return (
    <>
      <style>{`
        /* ── CreateUserForm ────────────────────────────────────────── */
        .cuf-toggle {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 9px 20px;
          background: oklch(99% 0.008 62);
          border: 1px solid oklch(78% 0.018 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(38% 0.025 58);
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background-color 0.12s, border-color 0.12s, color 0.12s;
          outline: none;
        }
        .cuf-toggle:hover {
          background: oklch(96% 0.012 62);
          border-color: oklch(66% 0.022 58);
          color: oklch(28% 0.028 58);
        }
        .cuf-toggle:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }
        .cuf-toggle[data-open="true"] {
          background: oklch(96% 0.012 62);
          border-color: oklch(68% 0.018 58);
        }
        .cuf-toggle-icon {
          font-size: 1rem;
          font-weight: 300;
          line-height: 1;
          transition: transform 0.2s ease;
        }
        .cuf-toggle[data-open="true"] .cuf-toggle-icon {
          transform: rotate(45deg);
        }

        .cuf-panel {
          margin-top: 14px;
          background: oklch(98.5% 0.010 62);
          border: 1px solid oklch(84% 0.014 58);
          border-radius: 6px;
          padding: 24px 28px;
          box-shadow: 0 2px 12px oklch(22% 0.02 58 / 0.06);
          animation: cuf-slide-in 0.18s ease;
        }
        @keyframes cuf-slide-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .cuf-panel-heading {
          margin: 0 0 20px;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.0625rem;
          font-weight: 400;
          color: oklch(28% 0.026 58);
          letter-spacing: 0.06em;
        }

        .cuf-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px 20px;
          margin-bottom: 16px;
        }

        @media (max-width: 600px) {
          .cuf-grid {
            grid-template-columns: 1fr;
          }
        }

        .cuf-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .cuf-field-full {
          grid-column: 1 / -1;
        }

        .cuf-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: oklch(46% 0.022 58);
          letter-spacing: 0.03em;
        }

        .cuf-hint {
          font-size: 0.75rem;
          color: oklch(62% 0.016 58);
          letter-spacing: 0.02em;
          margin-top: 2px;
        }

        .cuf-input {
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
        .cuf-input::placeholder { color: oklch(68% 0.016 58); }
        .cuf-input:hover { border-color: oklch(70% 0.02 58); }
        .cuf-input:focus-visible {
          border-color: oklch(52% 0.12 38);
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.25);
        }

        /* Color picker */
        .cuf-color-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          padding-top: 3px;
        }

        .cuf-color-dot {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.1s ease, box-shadow 0.12s ease;
          outline: none;
          flex-shrink: 0;
        }
        .cuf-color-dot:hover {
          transform: scale(1.12);
        }
        .cuf-color-dot:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.35);
        }
        .cuf-color-dot[data-selected="true"] {
          border-color: oklch(22% 0.025 58);
          transform: scale(1.18);
          box-shadow: 0 0 0 2px oklch(99% 0.008 62), 0 0 0 4px oklch(22% 0.025 58 / 0.4);
        }

        /* Admin checkbox */
        .cuf-check-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding-top: 4px;
        }
        .cuf-check {
          width: 16px;
          height: 16px;
          accentColor: oklch(52% 0.12 38);
          cursor: pointer;
          flex-shrink: 0;
        }
        .cuf-check-label {
          font-size: 0.9375rem;
          color: oklch(36% 0.024 58);
          letter-spacing: 0.02em;
        }

        /* Error banner */
        .cuf-error {
          margin-bottom: 14px;
          padding: 10px 14px;
          background: oklch(96% 0.025 28);
          border: 1px solid oklch(72% 0.08 28);
          border-radius: 4px;
          color: oklch(38% 0.14 28);
          font-size: 0.875rem;
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.5;
        }

        /* Actions row */
        .cuf-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 20px;
        }

        .cuf-btn-primary {
          padding: 9px 22px;
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
        .cuf-btn-primary:hover:not(:disabled) {
          background: oklch(46% 0.14 38);
          box-shadow: 0 2px 8px oklch(52% 0.12 38 / 0.25);
        }
        .cuf-btn-primary:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.35);
        }
        .cuf-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .cuf-btn-ghost {
          padding: 9px 18px;
          background: transparent;
          color: oklch(46% 0.022 58);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: border-color 0.12s, color 0.12s;
          outline: none;
        }
        .cuf-btn-ghost:hover {
          border-color: oklch(62% 0.022 58);
          color: oklch(32% 0.025 58);
        }
        .cuf-btn-ghost:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }
      `}</style>

      {/* Toggle trigger */}
      <button
        type="button"
        className="cuf-toggle"
        data-open={open ? "true" : "false"}
        onClick={handleToggle}
        aria-expanded={open}
      >
        <span className="cuf-toggle-icon" aria-hidden="true">+</span>
        新建账号
      </button>

      {/* Expandable form panel */}
      {open && (
        <div className="cuf-panel">
          <h3 className="cuf-panel-heading">填写新账号信息</h3>

          {/* Error */}
          {errorMsg && (
            <div className="cuf-error" role="alert">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }}>
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
              </svg>
              {errorMsg}
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit}>
            <div className="cuf-grid">
              {/* Username */}
              <div className="cuf-field">
                <label className="cuf-label" htmlFor="cuf-username">用户名</label>
                <input
                  id="cuf-username"
                  name="username"
                  type="text"
                  required
                  pattern="[a-zA-Z0-9_]{3,30}"
                  className="cuf-input"
                  placeholder="alice_wang"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                <span className="cuf-hint">3-30 字符，仅字母数字下划线</span>
              </div>

              {/* Display name */}
              <div className="cuf-field">
                <label className="cuf-label" htmlFor="cuf-displayName">昵称</label>
                <input
                  id="cuf-displayName"
                  name="displayName"
                  type="text"
                  required
                  maxLength={30}
                  className="cuf-input"
                  placeholder="小明"
                  autoComplete="off"
                />
              </div>

              {/* Password */}
              <div className="cuf-field">
                <label className="cuf-label" htmlFor="cuf-password">密码</label>
                <input
                  id="cuf-password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  maxLength={100}
                  className="cuf-input"
                  placeholder="至少 6 字符"
                  autoComplete="new-password"
                />
                <span className="cuf-hint">至少 6 字符</span>
              </div>

              {/* Color picker */}
              <div className="cuf-field">
                <span className="cuf-label">颜色</span>
                <div className="cuf-color-grid" role="radiogroup" aria-label="选择颜色">
                  {(COLOR_PALETTE as readonly string[]).map((c) => (
                    <button
                      key={c}
                      type="button"
                      className="cuf-color-dot"
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

              {/* isAdmin checkbox */}
              <div className="cuf-field cuf-field-full">
                <label className="cuf-check-row">
                  <input
                    type="checkbox"
                    name="isAdmin"
                    className="cuf-check"
                    style={{ accentColor: "oklch(52% 0.12 38)" }}
                  />
                  <span className="cuf-check-label">设为管理员</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="cuf-actions">
              <button
                type="submit"
                className="cuf-btn-primary"
                disabled={pending}
              >
                {pending ? "创建中…" : "保存"}
              </button>
              <button
                type="button"
                className="cuf-btn-ghost"
                onClick={handleToggle}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
