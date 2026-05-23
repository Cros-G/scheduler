"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { BUILT_IN_EMOJI_CATEGORIES } from "@/lib/emoji-constants";

interface CustomCategory {
  id: number;
  name: string;
  emojis: Array<{ id: number; emoji: string }>;
}

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
  customCategories: CustomCategory[];
}

// Combine built-in + custom into a single unified tab list
type Tab =
  | { kind: "builtin"; index: number; label: string; emojis: string[] }
  | { kind: "custom"; id: number; label: string; emojis: string[] };

export function EmojiPicker({ value, onChange, customCategories }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const tabs: Tab[] = [
    ...BUILT_IN_EMOJI_CATEGORIES.map((g, i) => ({
      kind: "builtin" as const,
      index: i,
      label: g.label,
      emojis: g.emojis,
    })),
    ...customCategories.map((c) => ({
      kind: "custom" as const,
      id: c.id,
      label: c.name,
      emojis: c.emojis.map((e) => e.emoji),
    })),
  ];

  const currentEmojis = tabs[activeTab]?.emojis ?? [];

  function handlePick(emoji: string) {
    onChange(emoji);
    setOpen(false);
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <>
      <style>{`
        .ep-tab-bar {
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          border-bottom: 1px solid oklch(88% 0.014 58);
          background: oklch(97% 0.012 62);
          flex-shrink: 0;
        }
        .ep-tab-bar::-webkit-scrollbar { display: none; }
        .ep-tab {
          flex-shrink: 0;
          padding: 6px 10px;
          font-size: 0.625rem;
          font-weight: 400;
          color: oklch(52% 0.022 58);
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          letter-spacing: 0.04em;
          transition: color 0.12s;
          white-space: nowrap;
          margin-bottom: -1px;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
        }
        .ep-tab:hover { color: oklch(38% 0.022 58); }
        .ep-tab.active {
          font-weight: 600;
          color: oklch(52% 0.12 38);
          border-bottom-color: oklch(52% 0.12 38);
        }
        .ep-tab.custom {
          color: oklch(46% 0.06 58);
        }
        .ep-tab.custom.active {
          color: oklch(48% 0.10 38);
          border-bottom-color: oklch(52% 0.12 38);
        }
        .ep-tab.custom::after {
          content: " ✦";
          font-size: 0.5rem;
          vertical-align: super;
          opacity: 0.7;
        }
        .ep-emoji-btn {
          width: 100%;
          aspect-ratio: 1;
          font-size: 1.2rem;
          line-height: 1;
          background: transparent;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s;
        }
        .ep-emoji-btn:hover { background: oklch(93% 0.016 58); }
        .ep-emoji-btn.selected { background: oklch(91% 0.022 58); }
        .ep-footer {
          display: flex;
          justify-content: flex-end;
          padding: 6px 10px;
          border-top: 1px solid oklch(90% 0.012 58);
          background: oklch(97.5% 0.008 62);
        }
        .ep-manage-link {
          font-size: 0.6875rem;
          color: oklch(52% 0.10 38);
          text-decoration: none;
          letter-spacing: 0.03em;
          padding: 2px 0;
          opacity: 0.85;
          transition: opacity 0.12s;
        }
        .ep-manage-link:hover { opacity: 1; text-decoration: underline; text-underline-offset: 2px; }
      `}</style>

      <div style={{ position: "relative" }}>
        {/* Trigger button */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="选择 emoji"
          aria-expanded={open}
          style={{
            width: 44,
            height: 44,
            borderRadius: 6,
            border: `1px solid ${open ? "oklch(52% 0.12 38)" : "oklch(82% 0.016 58)"}`,
            background: "oklch(99% 0.006 62)",
            fontSize: "1.5rem",
            lineHeight: 1,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "border-color 0.15s, box-shadow 0.15s",
            flexShrink: 0,
            boxShadow: open ? "0 0 0 3px oklch(62% 0.10 38 / 0.20)" : "none",
          }}
          onMouseEnter={(e) => {
            if (!open) (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(68% 0.06 58)";
          }}
          onMouseLeave={(e) => {
            if (!open) (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(82% 0.016 58)";
          }}
        >
          {value || "🙂"}
        </button>

        {/* Picker panel */}
        {open && (
          <div
            ref={panelRef}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 50,
              background: "oklch(99% 0.008 62)",
              border: "1px solid oklch(82% 0.016 58)",
              borderRadius: 8,
              boxShadow: "0 4px 24px oklch(22% 0.02 58 / 0.12), 0 1px 4px oklch(22% 0.02 58 / 0.06)",
              width: 296,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Category tabs — horizontally scrollable */}
            <div className="ep-tab-bar" role="tablist">
              {tabs.map((tab, i) => (
                <button
                  key={tab.kind === "builtin" ? `b-${tab.index}` : `c-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === i}
                  onClick={() => setActiveTab(i)}
                  className={[
                    "ep-tab",
                    activeTab === i ? "active" : "",
                    tab.kind === "custom" ? "custom" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div
              role="tabpanel"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(10, 1fr)",
                gap: 0,
                padding: "8px",
                maxHeight: 168,
                overflowY: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "oklch(82% 0.016 58) transparent",
              }}
            >
              {currentEmojis.length === 0 ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "16px 8px",
                    textAlign: "center",
                    color: "oklch(60% 0.018 58)",
                    fontSize: "0.8125rem",
                    letterSpacing: "0.02em",
                  }}
                >
                  这个分类还没有 emoji
                </div>
              ) : (
                currentEmojis.map((emoji, i) => (
                  <button
                    key={`${emoji}-${i}`}
                    type="button"
                    onClick={() => handlePick(emoji)}
                    title={emoji}
                    className={`ep-emoji-btn${emoji === value ? " selected" : ""}`}
                  >
                    {emoji}
                  </button>
                ))
              )}
            </div>

            {/* Footer: manage link */}
            <div className="ep-footer">
              <Link href="/settings/emojis" className="ep-manage-link" onClick={() => setOpen(false)}>
                管理 emoji →
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
