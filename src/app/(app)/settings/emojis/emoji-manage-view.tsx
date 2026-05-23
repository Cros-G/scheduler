"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  createCategoryAction,
  renameCategoryAction,
  deleteCategoryAction,
  addEmojiAction,
  removeEmojiAction,
} from "@/app/(app)/emojis/actions";
import type { BuiltInEmojiCategory } from "@/lib/emoji-constants";
import { CATEGORY_NAME_MAX, EMOJI_MAX_LENGTH } from "@/lib/emoji-validation";

interface CustomEmoji {
  id: number;
  emoji: string;
}

interface CustomCategory {
  id: number;
  name: string;
  emojis: CustomEmoji[];
}

interface EmojiManageViewProps {
  customCategories: CustomCategory[];
  builtInCategories: BuiltInEmojiCategory[];
}

export function EmojiManageView({
  customCategories: initialCategories,
  builtInCategories,
}: EmojiManageViewProps) {
  // Local optimistic state
  const [categories, setCategories] = useState<CustomCategory[]>(initialCategories);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialCategories[0]?.id ?? null
  );

  // Inline rename state
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // New category creation
  const [newCatName, setNewCatName] = useState("");
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const newCatInputRef = useRef<HTMLInputElement>(null);

  // Add emoji dialog
  const [addEmojiOpen, setAddEmojiOpen] = useState(false);
  const [addEmojiTab, setAddEmojiTab] = useState(0);
  const [customEmojiInput, setCustomEmojiInput] = useState("");
  const addEmojiDialogRef = useRef<HTMLDivElement>(null);

  // Error messages
  const [error, setError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  const selected = categories.find((c) => c.id === selectedId) ?? null;

  // Focus rename input when activated
  useEffect(() => {
    if (renamingId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Focus new category input when shown
  useEffect(() => {
    if (showNewCatInput && newCatInputRef.current) {
      newCatInputRef.current.focus();
    }
  }, [showNewCatInput]);

  // Close add emoji dialog on outside click
  useEffect(() => {
    if (!addEmojiOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        addEmojiDialogRef.current &&
        !addEmojiDialogRef.current.contains(e.target as Node)
      ) {
        setAddEmojiOpen(false);
        setCustomEmojiInput("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addEmojiOpen]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleCreateCategory() {
    const name = newCatName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const result = await createCategoryAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Optimistically add a placeholder; real data comes via revalidation
      const tempId = Date.now();
      setCategories((prev) => [...prev, { id: tempId, name, emojis: [] }]);
      setSelectedId(tempId);
      setNewCatName("");
      setShowNewCatInput(false);
    });
  }

  function handleStartRename(cat: CustomCategory) {
    setRenamingId(cat.id);
    setRenameValue(cat.name);
    setError(null);
  }

  function handleCancelRename() {
    setRenamingId(null);
    setRenameValue("");
  }

  function handleCommitRename(categoryId: number) {
    const name = renameValue.trim();
    if (!name) { handleCancelRename(); return; }
    setError(null);
    startTransition(async () => {
      const result = await renameCategoryAction(categoryId, name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, name } : c))
      );
      setRenamingId(null);
    });
  }

  function handleDeleteCategory(cat: CustomCategory) {
    const ok = window.confirm(
      `删除分类「${cat.name}」？分类下所有 emoji 收藏也会删除（已用在任务上的 emoji 不受影响）`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction(cat.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const remaining = categories.filter((c) => c.id !== cat.id);
      setCategories(remaining);
      if (selectedId === cat.id) {
        setSelectedId(remaining[0]?.id ?? null);
      }
    });
  }

  function handleAddEmoji(emoji: string) {
    if (!selectedId) return;
    setError(null);
    startTransition(async () => {
      const result = await addEmojiAction(selectedId, emoji);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                emojis: [...c.emojis, { id: Date.now(), emoji }],
              }
            : c
        )
      );
      setAddEmojiOpen(false);
      setCustomEmojiInput("");
    });
  }

  function handleRemoveEmoji(emojiRecord: CustomEmoji) {
    setError(null);
    startTransition(async () => {
      const result = await removeEmojiAction(emojiRecord.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCategories((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, emojis: c.emojis.filter((e) => e.id !== emojiRecord.id) }
            : c
        )
      );
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .emm-root {
          max-width: 820px;
          margin: 0 auto;
          padding: 32px 24px 64px;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(22% 0.025 58);
        }

        .emm-header {
          margin-bottom: 32px;
          padding-bottom: 20px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          position: relative;
        }

        .emm-header::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 27px,
            oklch(88% 0.014 58 / 0.6) 27px,
            oklch(88% 0.014 58 / 0.6) 28px
          );
          pointer-events: none;
          border-radius: 4px;
        }

        .emm-heading {
          position: relative;
          z-index: 1;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", "SimSun", serif;
          font-size: 1.75rem;
          font-weight: 400;
          color: oklch(22% 0.025 58);
          letter-spacing: 0.08em;
          margin: 0 0 4px;
          line-height: 1.3;
        }

        .emm-subtitle {
          position: relative;
          z-index: 1;
          font-size: 0.875rem;
          color: oklch(56% 0.018 58);
          margin: 0;
          letter-spacing: 0.03em;
        }

        .emm-layout {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 20px;
          align-items: start;
        }

        @media (max-width: 600px) {
          .emm-layout {
            grid-template-columns: 1fr;
          }
        }

        /* Left rail */
        .emm-rail {
          background: oklch(98.5% 0.010 62);
          border: 1px solid oklch(85% 0.014 58);
          border-radius: 8px;
          overflow: hidden;
        }

        .emm-rail-head {
          padding: 12px 14px 10px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", serif;
          font-size: 0.8125rem;
          font-weight: 400;
          color: oklch(46% 0.022 58);
          letter-spacing: 0.06em;
        }

        .emm-cat-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding: 10px 14px;
          cursor: pointer;
          border-bottom: 1px solid oklch(91% 0.012 58);
          transition: background 0.1s;
          font-size: 0.9375rem;
          letter-spacing: 0.02em;
        }

        .emm-cat-item:last-of-type { border-bottom: none; }
        .emm-cat-item:hover { background: oklch(96% 0.012 62); }
        .emm-cat-item.active {
          background: oklch(94% 0.018 62);
          color: oklch(32% 0.025 58);
        }

        .emm-cat-name {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .emm-cat-count {
          font-size: 0.6875rem;
          color: oklch(58% 0.018 58);
          background: oklch(91% 0.014 58);
          padding: 1px 6px;
          border-radius: 8px;
          flex-shrink: 0;
          font-variant-numeric: tabular-nums;
        }

        .emm-new-cat-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          width: 100%;
          padding: 10px 14px;
          background: transparent;
          border: none;
          border-top: 1px solid oklch(88% 0.014 58);
          color: oklch(52% 0.12 38);
          font-size: 0.875rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          letter-spacing: 0.03em;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }

        .emm-new-cat-btn:hover { background: oklch(95% 0.016 62); }

        .emm-new-cat-form {
          padding: 8px 10px;
          border-top: 1px solid oklch(88% 0.014 58);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .emm-new-cat-form-actions {
          display: flex;
          gap: 6px;
          justify-content: flex-end;
        }

        /* Right pane */
        .emm-pane {
          background: oklch(98.5% 0.010 62);
          border: 1px solid oklch(85% 0.014 58);
          border-radius: 8px;
          overflow: hidden;
          min-height: 320px;
        }

        .emm-pane-head {
          padding: 14px 18px 12px;
          border-bottom: 1px solid oklch(88% 0.014 58);
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .emm-cat-title {
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", serif;
          font-size: 1.125rem;
          font-weight: 400;
          color: oklch(22% 0.025 58);
          letter-spacing: 0.05em;
          flex: 1;
          min-width: 0;
        }

        .emm-rename-input {
          flex: 1;
          min-width: 120px;
          padding: 5px 10px;
          font-size: 1rem;
          font-family: "Hiragino Mincho ProN", "Source Han Serif CN", "Noto Serif CJK SC", serif;
          letter-spacing: 0.04em;
          color: oklch(22% 0.025 58);
          background: oklch(99% 0.006 62);
          border: 1px solid oklch(68% 0.10 38);
          border-radius: 4px;
          outline: none;
          box-sizing: border-box;
          box-shadow: 0 0 0 3px oklch(68% 0.10 38 / 0.18);
        }

        .emm-icon-btn {
          appearance: none;
          background: transparent;
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          padding: 5px 10px;
          font-size: 0.8125rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(46% 0.022 58);
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: border-color 0.12s, background 0.12s;
          flex-shrink: 0;
        }

        .emm-icon-btn:hover {
          border-color: oklch(62% 0.022 58);
          background: oklch(96% 0.010 62);
        }

        .emm-delete-btn {
          appearance: none;
          background: transparent;
          border: 1px solid oklch(78% 0.06 28);
          border-radius: 4px;
          padding: 5px 10px;
          font-size: 0.8125rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(48% 0.10 28);
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: border-color 0.12s, background 0.12s, color 0.12s;
          flex-shrink: 0;
        }

        .emm-delete-btn:hover {
          border-color: oklch(58% 0.14 28);
          background: oklch(96% 0.020 28);
          color: oklch(38% 0.14 28);
        }

        .emm-pane-body {
          padding: 16px 18px;
        }

        /* Emoji grid */
        .emm-emoji-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
          gap: 4px;
          margin-bottom: 16px;
        }

        .emm-emoji-cell {
          position: relative;
        }

        .emm-emoji-tile {
          width: 100%;
          aspect-ratio: 1;
          font-size: 1.375rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: oklch(96% 0.012 62);
          transition: background 0.1s;
          cursor: default;
        }

        .emm-emoji-cell:hover .emm-emoji-tile {
          background: oklch(91% 0.018 62);
        }

        .emm-remove-btn {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: oklch(38% 0.025 58);
          color: oklch(97% 0.008 62);
          border: none;
          font-size: 0.625rem;
          line-height: 1;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: background 0.1s;
        }

        .emm-emoji-cell:hover .emm-remove-btn {
          display: flex;
        }

        .emm-remove-btn:hover {
          background: oklch(48% 0.12 28);
        }

        /* Add emoji section */
        .emm-add-emoji-area {
          position: relative;
        }

        .emm-add-emoji-btn {
          appearance: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: transparent;
          border: 1px dashed oklch(72% 0.08 38);
          border-radius: 6px;
          font-size: 0.875rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(52% 0.10 38);
          cursor: pointer;
          letter-spacing: 0.03em;
          transition: border-color 0.12s, background 0.12s;
        }

        .emm-add-emoji-btn:hover {
          border-color: oklch(52% 0.12 38);
          background: oklch(97% 0.014 62);
        }

        /* Add emoji dialog (floating panel) */
        .emm-add-dialog {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          z-index: 40;
          background: oklch(99% 0.008 62);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 8px;
          box-shadow: 0 4px 24px oklch(22% 0.02 58 / 0.13), 0 1px 4px oklch(22% 0.02 58 / 0.06);
          width: 320px;
          overflow: hidden;
        }

        .emm-dialog-tabs {
          display: flex;
          overflow-x: auto;
          scrollbar-width: none;
          border-bottom: 1px solid oklch(88% 0.014 58);
          background: oklch(97% 0.012 62);
          flex-shrink: 0;
        }

        .emm-dialog-tabs::-webkit-scrollbar { display: none; }

        .emm-dialog-tab {
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

        .emm-dialog-tab:hover { color: oklch(38% 0.022 58); }

        .emm-dialog-tab.active {
          font-weight: 600;
          color: oklch(52% 0.12 38);
          border-bottom-color: oklch(52% 0.12 38);
        }

        .emm-dialog-emoji-grid {
          display: grid;
          grid-template-columns: repeat(10, 1fr);
          gap: 0;
          padding: 8px;
          max-height: 160px;
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: oklch(82% 0.016 58) transparent;
        }

        .emm-dialog-emoji-btn {
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

        .emm-dialog-emoji-btn:hover { background: oklch(93% 0.016 58); }

        .emm-dialog-custom-row {
          display: flex;
          gap: 8px;
          padding: 10px 12px;
          border-top: 1px solid oklch(90% 0.012 58);
          background: oklch(98% 0.008 62);
          align-items: center;
        }

        .emm-dialog-custom-input {
          flex: 1;
          padding: 6px 10px;
          font-size: 1.125rem;
          text-align: center;
          background: oklch(99% 0.006 62);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          outline: none;
          font-family: system-ui, sans-serif;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
          width: 60px;
        }

        .emm-dialog-custom-input:focus {
          border-color: oklch(52% 0.12 38);
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.22);
        }

        .emm-dialog-add-btn {
          appearance: none;
          padding: 6px 14px;
          background: oklch(52% 0.12 38);
          color: oklch(99% 0.006 62);
          border: none;
          border-radius: 4px;
          font-size: 0.875rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.12s;
          white-space: nowrap;
        }

        .emm-dialog-add-btn:hover { background: oklch(46% 0.14 38); }
        .emm-dialog-add-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        /* General inputs */
        .emm-text-input {
          appearance: none;
          padding: 6px 10px;
          font-size: 0.875rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          color: oklch(22% 0.025 58);
          background: oklch(99% 0.006 62);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s, box-shadow 0.15s;
          flex: 1;
        }

        .emm-text-input:focus {
          border-color: oklch(52% 0.12 38);
          box-shadow: 0 0 0 3px oklch(62% 0.10 38 / 0.22);
        }

        .emm-submit-btn {
          appearance: none;
          padding: 6px 12px;
          background: oklch(52% 0.12 38);
          color: oklch(99% 0.006 62);
          border: none;
          border-radius: 4px;
          font-size: 0.8125rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          letter-spacing: 0.04em;
          cursor: pointer;
          transition: background 0.12s;
          white-space: nowrap;
        }

        .emm-submit-btn:hover { background: oklch(46% 0.14 38); }
        .emm-submit-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .emm-cancel-btn {
          appearance: none;
          padding: 6px 10px;
          background: transparent;
          color: oklch(52% 0.022 58);
          border: 1px solid oklch(82% 0.016 58);
          border-radius: 4px;
          font-size: 0.8125rem;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          cursor: pointer;
          transition: background 0.12s, border-color 0.12s;
          white-space: nowrap;
        }

        .emm-cancel-btn:hover {
          border-color: oklch(62% 0.022 58);
          background: oklch(96% 0.010 62);
        }

        /* Empty state */
        .emm-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          text-align: center;
          color: oklch(56% 0.018 58);
          gap: 10px;
          min-height: 260px;
        }

        .emm-empty-icon {
          font-size: 2.5rem;
          opacity: 0.55;
        }

        .emm-empty-text {
          font-size: 0.9375rem;
          line-height: 1.6;
          letter-spacing: 0.02em;
          max-width: 260px;
        }

        .emm-empty-hint {
          font-size: 0.8125rem;
          color: oklch(64% 0.016 58);
          letter-spacing: 0.02em;
        }

        /* Error banner */
        .emm-error {
          margin: 0 18px 12px;
          padding: 8px 12px;
          background: oklch(96% 0.025 28);
          border: 1px solid oklch(72% 0.08 28);
          border-radius: 4px;
          color: oklch(38% 0.14 28);
          font-size: 0.8125rem;
          line-height: 1.5;
        }

        .emm-pending-overlay {
          opacity: 0.6;
          pointer-events: none;
        }
      `}</style>

      <div className="emm-root">
        {/* Page header */}
        <div className="emm-header">
          <h1 className="emm-heading">Emoji 管理</h1>
          <p className="emm-subtitle">
            建自己的分类，把常用的 emoji 收集起来——创建任务时 picker 会显示
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="emm-error" role="alert">
            ⚠ {error}
          </div>
        )}

        {/* Two-column layout */}
        <div className={`emm-layout${isPending ? " emm-pending-overlay" : ""}`}>
          {/* ── Left rail: category list ── */}
          <div className="emm-rail">
            <div className="emm-rail-head">自定义分类</div>

            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`emm-cat-item${selectedId === cat.id ? " active" : ""}`}
                onClick={() => setSelectedId(cat.id)}
              >
                <span className="emm-cat-name">{cat.name}</span>
                <span className="emm-cat-count">{cat.emojis.length}</span>
              </div>
            ))}

            {/* New category input or button */}
            {showNewCatInput ? (
              <div className="emm-new-cat-form">
                <input
                  ref={newCatInputRef}
                  type="text"
                  className="emm-text-input"
                  placeholder="分类名称…"
                  maxLength={CATEGORY_NAME_MAX}
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateCategory();
                    if (e.key === "Escape") {
                      setShowNewCatInput(false);
                      setNewCatName("");
                    }
                  }}
                />
                <div className="emm-new-cat-form-actions">
                  <button
                    type="button"
                    className="emm-cancel-btn"
                    onClick={() => {
                      setShowNewCatInput(false);
                      setNewCatName("");
                    }}
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    className="emm-submit-btn"
                    disabled={!newCatName.trim() || isPending}
                    onClick={handleCreateCategory}
                  >
                    创建
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="emm-new-cat-btn"
                onClick={() => setShowNewCatInput(true)}
              >
                <span style={{ fontSize: "1em", lineHeight: 1 }}>＋</span>
                新建分类
              </button>
            )}
          </div>

          {/* ── Right pane ── */}
          <div className="emm-pane">
            {!selected ? (
              /* Empty state */
              <div className="emm-empty">
                <div className="emm-empty-icon">✦</div>
                <p className="emm-empty-text">
                  还没有自定义分类，从左边新建一个开始
                </p>
                <p className="emm-empty-hint">
                  分类里收藏的 emoji 会出现在任务编辑器的 picker 中
                </p>
              </div>
            ) : (
              <>
                {/* Pane header */}
                <div className="emm-pane-head">
                  {renamingId === selected.id ? (
                    <>
                      <input
                        ref={renameInputRef}
                        type="text"
                        className="emm-rename-input"
                        maxLength={CATEGORY_NAME_MAX}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCommitRename(selected.id);
                          if (e.key === "Escape") handleCancelRename();
                        }}
                      />
                      <button
                        type="button"
                        className="emm-submit-btn"
                        disabled={!renameValue.trim() || isPending}
                        onClick={() => handleCommitRename(selected.id)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="emm-cancel-btn"
                        onClick={handleCancelRename}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="emm-cat-title">{selected.name}</h2>
                      <button
                        type="button"
                        className="emm-icon-btn"
                        onClick={() => handleStartRename(selected)}
                        disabled={isPending}
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        className="emm-delete-btn"
                        onClick={() => handleDeleteCategory(selected)}
                        disabled={isPending}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>

                {/* Pane body */}
                <div className="emm-pane-body">
                  {/* Emoji grid */}
                  {selected.emojis.length > 0 ? (
                    <div className="emm-emoji-grid">
                      {selected.emojis.map((e) => (
                        <div key={e.id} className="emm-emoji-cell">
                          <div className="emm-emoji-tile">{e.emoji}</div>
                          <button
                            type="button"
                            className="emm-remove-btn"
                            aria-label={`移除 ${e.emoji}`}
                            onClick={() => handleRemoveEmoji(e)}
                            disabled={isPending}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "24px 0 20px",
                        textAlign: "center",
                        color: "oklch(64% 0.016 58)",
                        fontSize: "0.875rem",
                        letterSpacing: "0.02em",
                        lineHeight: 1.6,
                      }}
                    >
                      这个分类还空空的<br />
                      <span style={{ fontSize: "0.8125rem", color: "oklch(68% 0.014 58)" }}>
                        点击下方按钮添加你的第一个 emoji
                      </span>
                    </div>
                  )}

                  {/* Add emoji area */}
                  <div className="emm-add-emoji-area">
                    <button
                      type="button"
                      className="emm-add-emoji-btn"
                      onClick={() => {
                        setAddEmojiOpen((v) => !v);
                        setAddEmojiTab(0);
                        setCustomEmojiInput("");
                        setError(null);
                      }}
                      disabled={isPending}
                    >
                      <span style={{ fontSize: "1rem", lineHeight: 1 }}>＋</span>
                      添加 emoji
                    </button>

                    {/* Add emoji floating dialog */}
                    {addEmojiOpen && (
                      <div
                        ref={addEmojiDialogRef}
                        className="emm-add-dialog"
                      >
                        {/* Built-in category tabs */}
                        <div className="emm-dialog-tabs" role="tablist">
                          {builtInCategories.map((cat, i) => (
                            <button
                              key={cat.label}
                              type="button"
                              role="tab"
                              aria-selected={addEmojiTab === i}
                              className={`emm-dialog-tab${addEmojiTab === i ? " active" : ""}`}
                              onClick={() => setAddEmojiTab(i)}
                            >
                              {cat.label}
                            </button>
                          ))}
                        </div>

                        {/* Built-in emojis for selected tab */}
                        <div className="emm-dialog-emoji-grid" role="tabpanel">
                          {builtInCategories[addEmojiTab]?.emojis.map((emoji, i) => (
                            <button
                              key={`${emoji}-${i}`}
                              type="button"
                              className="emm-dialog-emoji-btn"
                              title={emoji}
                              onClick={() => handleAddEmoji(emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        {/* Custom emoji text input */}
                        <div className="emm-dialog-custom-row">
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "oklch(56% 0.018 58)",
                              letterSpacing: "0.03em",
                              whiteSpace: "nowrap",
                            }}
                          >
                            自定义
                          </span>
                          <input
                            type="text"
                            className="emm-dialog-custom-input"
                            placeholder="🌟"
                            maxLength={EMOJI_MAX_LENGTH}
                            value={customEmojiInput}
                            onChange={(e) => setCustomEmojiInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && customEmojiInput.trim()) {
                                handleAddEmoji(customEmojiInput.trim());
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="emm-dialog-add-btn"
                            disabled={!customEmojiInput.trim() || isPending}
                            onClick={() => {
                              if (customEmojiInput.trim()) {
                                handleAddEmoji(customEmojiInput.trim());
                              }
                            }}
                          >
                            添加
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
