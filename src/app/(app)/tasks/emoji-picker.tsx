"use client";

import { useState } from "react";

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "食物",
    emojis: [
      "🍎","🍊","🍋","🍇","🍓","🫐","🍑","🥝","🍒","🍌",
      "🥑","🥕","🥦","🌽","🍄","🍞","🍜","🍚","🍣","🍰",
    ],
  },
  {
    label: "运动",
    emojis: [
      "🏃","🚴","🏊","🧘","🤸","⛹️","🏋️","🧗","🚶","🧜",
      "🎯","🏓","🥊","⚽","🏀","🎾","🏸","🎿","🧘‍♀️","💪",
    ],
  },
  {
    label: "心情",
    emojis: [
      "😊","😌","🥰","😄","🤩","😎","🌟","✨","💫","🎉",
      "💕","❤️","🧡","💛","💚","💙","💜","🌈","☀️","🌙",
    ],
  },
  {
    label: "自然",
    emojis: [
      "🌸","🌺","🌻","🌷","🍀","🌿","🍃","🌱","🌲","🌳",
      "🌊","🏔️","🌅","🌄","❄️","🌦️","🌸","🦋","🐝","🌙",
    ],
  },
  {
    label: "物品",
    emojis: [
      "📚","✏️","📝","💡","🎵","🎨","📷","💻","📱","⌚",
      "🎁","🏆","🔑","💎","🧩","🪴","🕯️","📖","🎧","🌿",
    ],
  },
];

interface EmojiPickerProps {
  value: string;
  onChange: (emoji: string) => void;
}

export function EmojiPicker({ value, onChange }: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState(0);

  function handlePick(emoji: string) {
    onChange(emoji);
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="选择 emoji"
        aria-expanded={open}
        style={{
          width: 44,
          height: 44,
          borderRadius: 6,
          border: "1px solid oklch(82% 0.016 58)",
          background: "oklch(99% 0.006 62)",
          fontSize: "1.5rem",
          lineHeight: 1,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "border-color 0.15s, box-shadow 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(52% 0.12 38)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "oklch(82% 0.016 58)";
        }}
      >
        {value || "🙂"}
      </button>

      {/* Picker panel */}
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            background: "oklch(99% 0.008 62)",
            border: "1px solid oklch(82% 0.016 58)",
            borderRadius: 8,
            boxShadow: "0 4px 24px oklch(22% 0.02 58 / 0.12), 0 1px 4px oklch(22% 0.02 58 / 0.06)",
            width: 284,
            overflow: "hidden",
          }}
        >
          {/* Category tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid oklch(88% 0.014 58)",
              background: "oklch(97% 0.012 62)",
            }}
          >
            {EMOJI_GROUPS.map((g, i) => (
              <button
                key={g.label}
                type="button"
                onClick={() => setActiveGroup(i)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: "0.6875rem",
                  fontWeight: activeGroup === i ? 600 : 400,
                  color: activeGroup === i ? "oklch(52% 0.12 38)" : "oklch(46% 0.022 58)",
                  background: "transparent",
                  border: "none",
                  borderBottom: activeGroup === i ? "2px solid oklch(52% 0.12 38)" : "2px solid transparent",
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                  transition: "color 0.12s",
                  marginBottom: -1,
                }}
              >
                {g.label}
              </button>
            ))}
          </div>

          {/* Emoji grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(10, 1fr)",
              gap: 0,
              padding: "8px",
              maxHeight: 160,
              overflowY: "auto",
            }}
          >
            {EMOJI_GROUPS[activeGroup].emojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                type="button"
                onClick={() => handlePick(emoji)}
                title={emoji}
                style={{
                  width: "100%",
                  aspectRatio: "1",
                  fontSize: "1.25rem",
                  lineHeight: 1,
                  background: emoji === value ? "oklch(93% 0.018 58)" : "transparent",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (emoji !== value) {
                    (e.currentTarget as HTMLButtonElement).style.background = "oklch(95% 0.014 58)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (emoji !== value) {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
