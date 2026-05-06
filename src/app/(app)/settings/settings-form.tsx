"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { updateProfileAction } from "./actions";

interface SettingsFormProps {
  username: string;
  initialDisplayName: string;
  initialColor: string;
}

export function SettingsForm({ username, initialDisplayName, initialColor }: SettingsFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");

    const fd = new FormData();
    fd.set("displayName", displayName);
    fd.set("color", selectedColor);

    const result = await updateProfileAction(fd);

    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.error ?? "保存失败");
    } else {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2400);
    }
  }

  return (
    <>
      <style>{`
        .sf-root {
          max-width: 520px;
        }

        .sf-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 24px;
        }

        .sf-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: oklch(46% 0.022 58);
          letter-spacing: 0.04em;
        }

        .sf-readonly-value {
          padding: 10px 14px;
          background: oklch(94% 0.012 62);
          border: 1px solid oklch(86% 0.014 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          color: oklch(46% 0.022 58);
          letter-spacing: 0.03em;
          font-family: inherit;
        }

        .sf-input {
          appearance: none;
          -webkit-appearance: none;
          width: 100%;
          padding: 10px 14px;
          background: oklch(99% 0.006 62);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          color: oklch(22% 0.025 58);
          font-family: inherit;
          line-height: 1.5;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          outline: none;
        }

        .sf-input:hover {
          border-color: oklch(70% 0.02 58);
        }

        .sf-input:focus-visible {
          border-color: oklch(52% 0.12 38);
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }

        .sf-char-hint {
          font-size: 0.75rem;
          color: oklch(64% 0.016 58);
          letter-spacing: 0.02em;
          text-align: right;
          margin-top: 4px;
        }

        /* Color picker */
        .sf-color-grid {
          display: grid;
          grid-template-columns: repeat(6, 36px);
          gap: 8px;
          margin-top: 4px;
        }

        .sf-color-dot {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.1s ease, box-shadow 0.12s ease;
          outline: none;
          background-color: var(--dot-color);
          flex-shrink: 0;
        }

        .sf-color-dot:hover {
          transform: scale(1.12);
          box-shadow: 0 2px 8px var(--dot-color, oklch(52% 0.12 38)) / 0.35;
        }

        .sf-color-dot:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.35);
        }

        .sf-color-dot[data-selected="true"] {
          border-color: oklch(22% 0.025 58);
          transform: scale(1.15);
          box-shadow: 0 0 0 2px oklch(99% 0.008 62), 0 0 0 4px oklch(22% 0.025 58 / 0.45);
        }

        /* Check mark inside selected dot */
        .sf-color-dot[data-selected="true"]::after {
          content: "";
          display: block;
          width: 10px;
          height: 6px;
          border-bottom: 2.5px solid oklch(99% 0.006 62);
          border-left: 2.5px solid oklch(99% 0.006 62);
          transform: rotate(-45deg) translateY(-2px);
          filter: drop-shadow(0 1px 1px oklch(0% 0 0 / 0.25));
        }

        /* Error banner */
        .sf-error {
          margin-bottom: 20px;
          padding: 11px 16px;
          background: oklch(96% 0.025 28);
          border: 1px solid oklch(72% 0.08 28);
          border-radius: 4px;
          color: oklch(38% 0.14 28);
          font-size: 0.875rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        /* Saved feedback */
        .sf-saved {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 0.875rem;
          color: oklch(40% 0.12 145);
          margin-left: 12px;
          opacity: 0;
          animation: sf-fade-in-out 2.4s ease forwards;
        }

        @keyframes sf-fade-in-out {
          0%   { opacity: 0; transform: translateY(2px); }
          12%  { opacity: 1; transform: translateY(0); }
          75%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Buttons row */
        .sf-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          flex-wrap: wrap;
        }

        .sf-btn-primary {
          padding: 10px 24px;
          background: oklch(52% 0.12 38);
          color: oklch(99% 0.006 62);
          border: none;
          border-radius: 4px;
          font-size: 0.9375rem;
          font-weight: 500;
          font-family: inherit;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background-color 0.12s ease, transform 0.1s ease, box-shadow 0.12s ease;
          outline: none;
        }

        .sf-btn-primary:hover {
          background: oklch(46% 0.14 38);
          box-shadow: 0 2px 8px oklch(52% 0.12 38 / 0.25);
        }

        .sf-btn-primary:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.35);
        }

        .sf-btn-primary:active {
          background: oklch(41% 0.14 38);
          transform: translateY(1px);
          box-shadow: none;
        }

        .sf-btn-primary:disabled {
          opacity: 0.6;
          cursor: default;
          transform: none;
        }

        .sf-btn-ghost {
          padding: 10px 20px;
          background: transparent;
          color: oklch(46% 0.022 58);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.9375rem;
          font-family: inherit;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: border-color 0.12s, color 0.12s;
          outline: none;
        }

        .sf-btn-ghost:hover {
          border-color: oklch(62% 0.022 58);
          color: oklch(32% 0.025 58);
        }

        .sf-btn-ghost:focus-visible {
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.3);
        }

        /* Divider */
        .sf-divider {
          margin: 40px 0 32px;
          border: none;
          border-top: 1px solid oklch(88% 0.014 58);
        }

        .sf-section-label {
          font-size: 0.8125rem;
          font-weight: 500;
          color: oklch(56% 0.018 58);
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: 0 0 16px;
        }

        .sf-logout-area {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .sf-logout-text {
          font-size: 0.875rem;
          color: oklch(56% 0.018 58);
          margin: 0;
        }

        .sf-btn-logout {
          padding: 8px 20px;
          background: transparent;
          color: oklch(44% 0.14 28);
          border: 1px solid oklch(72% 0.08 28);
          border-radius: 4px;
          font-size: 0.875rem;
          font-family: inherit;
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: border-color 0.12s, background-color 0.12s, color 0.12s;
          outline: none;
        }

        .sf-btn-logout:hover {
          background: oklch(96% 0.025 28);
          border-color: oklch(58% 0.12 28);
        }

        .sf-btn-logout:focus-visible {
          box-shadow: 0 0 0 3px oklch(72% 0.08 28 / 0.4);
        }
      `}</style>

      <div className="sf-root">
        <form ref={formRef} onSubmit={handleSubmit}>
          {/* Username (read-only) */}
          <div className="sf-field">
            <span className="sf-label">用户名</span>
            <div className="sf-readonly-value">{username}</div>
          </div>

          {/* Display name */}
          <div className="sf-field">
            <label htmlFor="sf-displayName" className="sf-label">昵称</label>
            <input
              id="sf-displayName"
              type="text"
              className="sf-input"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (status === "error") setStatus("idle");
              }}
              maxLength={30}
              autoComplete="off"
            />
            <div className="sf-char-hint">{displayName.length} / 30</div>
          </div>

          {/* Color picker */}
          <div className="sf-field">
            <span className="sf-label">颜色</span>
            <div className="sf-color-grid" role="radiogroup" aria-label="选择颜色">
              {(COLOR_PALETTE as readonly string[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  className="sf-color-dot"
                  style={{ "--dot-color": c } as React.CSSProperties}
                  data-selected={selectedColor === c ? "true" : "false"}
                  aria-label={c}
                  aria-checked={selectedColor === c}
                  role="radio"
                  onClick={() => {
                    setSelectedColor(c);
                    if (status === "error") setStatus("idle");
                  }}
                />
              ))}
            </div>
            {/* Hidden input carries selected color value for form */}
            <input type="hidden" name="color" value={selectedColor} />
          </div>

          {/* Error */}
          {status === "error" && (
            <div className="sf-error" role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
              </svg>
              {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div className="sf-actions">
            <button
              type="submit"
              className="sf-btn-primary"
              disabled={status === "saving"}
            >
              {status === "saving" ? "保存中…" : "保存"}
            </button>
            <button
              type="button"
              className="sf-btn-ghost"
              onClick={() => router.push("/")}
            >
              取消
            </button>
            {status === "saved" && (
              <span className="sf-saved" key={Date.now()}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                已保存
              </span>
            )}
          </div>
        </form>

        <hr className="sf-divider" />

        {/* Logout section */}
        <p className="sf-section-label">账号</p>
        <div className="sf-logout-area">
          <p className="sf-logout-text">退出登录后需重新输入密码</p>
          <form action="/api/logout" method="POST">
            <button type="submit" className="sf-btn-logout">退出登录</button>
          </form>
        </div>
      </div>
    </>
  );
}
