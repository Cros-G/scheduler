"use client";

import { useRef, useState, useTransition, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { upsertNoteAction, deleteNoteImageAction } from "./notes/actions";
import {
  NOTE_CONTENT_MAX,
  NOTE_IMAGES_MAX,
  NOTE_IMAGE_BYTES_MAX,
  ALLOWED_MIME,
} from "@/lib/note-validation";

type NoteImage = {
  id: number;
  sortOrder: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

export type NoteData = {
  id: number;
  content: string;
  images: NoteImage[];
};

interface NoteEditorProps {
  date: string;
  note: NoteData | null | undefined;
  onDirtyChange?: (dirty: boolean) => void;
  readonly?: boolean;
}

export function NoteEditor({ date, note, onDirtyChange, readonly = false }: NoteEditorProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track the props-side content to detect external refreshes
  const lastPropsContentRef = useRef<string | null>(null);

  const initContent = note?.content ?? "";
  const [currentContent, setCurrentContent] = useState(initContent);
  const [lastSavedContent, setLastSavedContent] = useState(initContent);
  const [saveLabel, setSaveLabel] = useState<"保存" | "已保存">("保存");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavePending, startSaveTransition] = useTransition();
  const [isDeletePending, startDeleteTransition] = useTransition();

  // Sync props.note changes without clobbering local drafts
  useEffect(() => {
    const incoming = note?.content ?? "";
    const prevProps = lastPropsContentRef.current;

    if (prevProps === null) {
      // First mount — already initialised via useState
      lastPropsContentRef.current = incoming;
      return;
    }

    if (incoming !== prevProps) {
      // Props changed (parent re-fetched). If user hasn't diverged from last
      // saved state, accept the new baseline; otherwise preserve local draft.
      setCurrentContent((cur) => {
        if (cur === lastSavedContent) {
          setLastSavedContent(incoming);
          return incoming;
        }
        return cur;
      });
      lastPropsContentRef.current = incoming;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note?.content]);

  const dirty = currentContent !== lastSavedContent;

  // Notify parent of dirty state
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const charCount = currentContent.length;
  const isAtWarning = charCount > 9500;
  const images = note?.images ?? [];
  const imageCount = images.length;
  const atImageLimit = imageCount >= NOTE_IMAGES_MAX;

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setCurrentContent(e.target.value);
    setSaveError(null);
  }

  function handleSave() {
    if (!dirty || isSavePending) return;
    setSaveError(null);
    startSaveTransition(async () => {
      const result = await upsertNoteAction(date, currentContent);
      if (result.ok) {
        setLastSavedContent(currentContent);
        setSaveLabel("已保存");
        setTimeout(() => setSaveLabel("保存"), 1800);
        router.refresh();
      } else {
        setSaveError(result.error ?? "保存失败");
      }
    });
  }

  function handleDeleteImage(imageId: number) {
    startDeleteTransition(async () => {
      const result = await deleteNoteImageAction(imageId);
      if (result.ok) {
        router.refresh();
      } else {
        setUploadError(result.error ?? "删除失败");
      }
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";

    if (!file) return;
    setUploadError(null);

    // Client-side pre-validation (server enforces too)
    if (file.size > NOTE_IMAGE_BYTES_MAX) {
      setUploadError("单张图片不能超过 5MB");
      return;
    }
    if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
      setUploadError("仅支持 JPG / PNG / WebP / GIF");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("date", date);
      formData.append("file", file);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (json.ok) {
        router.refresh();
      } else {
        setUploadError(json.error ?? "上传失败");
      }
    } catch {
      setUploadError("上传失败，请检查网络");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <>
      <style>{`
        .ne-root {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        /* ── Textarea wrapper ── */
        .ne-textarea-wrap {
          position: relative;
          border: 1px solid oklch(84% 0.014 58);
          border-radius: 5px;
          overflow: hidden;
          background: oklch(99% 0.007 62);
          transition: border-color 0.15s;
        }

        .ne-textarea-wrap:focus-within {
          border-color: oklch(62% 0.055 52);
          box-shadow: 0 0 0 2.5px oklch(62% 0.055 52 / 0.18);
        }

        /* Subtle ruled lines behind textarea */
        .ne-textarea-wrap::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            to bottom,
            transparent 0px,
            transparent 27px,
            oklch(86% 0.012 58 / 0.5) 27px,
            oklch(86% 0.012 58 / 0.5) 28px
          );
          pointer-events: none;
          z-index: 0;
        }

        .ne-textarea {
          position: relative;
          z-index: 1;
          width: 100%;
          min-height: 120px;
          padding: 10px 12px 28px;
          background: transparent;
          border: none;
          outline: none;
          font-family: "Hiragino Sans GB", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
          font-size: 0.9375rem;
          line-height: 1.75rem; /* match ruled lines at 28px */
          color: oklch(22% 0.025 58);
          resize: vertical;
          display: block;
        }

        .ne-textarea::placeholder {
          color: oklch(68% 0.014 58);
          font-style: italic;
        }

        .ne-char-counter {
          position: absolute;
          bottom: 7px;
          right: 10px;
          font-size: 0.6875rem;
          font-variant-numeric: tabular-nums;
          color: oklch(62% 0.014 58);
          letter-spacing: 0.02em;
          z-index: 2;
          pointer-events: none;
          transition: color 0.15s;
        }

        .ne-char-counter.warning {
          color: oklch(52% 0.12 38);
          font-weight: 600;
        }

        /* ── Save row ── */
        .ne-save-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .ne-save-btn {
          padding: 6px 18px;
          background: oklch(52% 0.12 38);
          color: oklch(99% 0.006 62);
          border: none;
          border-radius: 4px;
          font-size: 0.8125rem;
          font-family: inherit;
          font-weight: 500;
          letter-spacing: 0.05em;
          cursor: pointer;
          transition: background 0.12s, opacity 0.12s, transform 0.1s;
          white-space: nowrap;
        }

        .ne-save-btn:hover:not(:disabled) {
          background: oklch(46% 0.14 38);
        }

        .ne-save-btn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .ne-save-btn:disabled {
          opacity: 0.38;
          cursor: not-allowed;
        }

        .ne-save-error {
          font-size: 0.8125rem;
          color: oklch(42% 0.14 28);
          letter-spacing: 0.02em;
          flex: 1;
        }

        /* ── Image grid ── */
        .ne-images-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .ne-img-thumb {
          position: relative;
          width: 96px;
          height: 96px;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid oklch(84% 0.014 58);
          flex-shrink: 0;
          background: oklch(96% 0.010 62);
        }

        .ne-img-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .ne-img-delete {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: oklch(22% 0.025 58 / 0.72);
          color: oklch(97% 0.008 62);
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          line-height: 1;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.15s, background 0.12s;
          padding: 0;
          flex-shrink: 0;
        }

        .ne-img-thumb:hover .ne-img-delete {
          opacity: 1;
        }

        .ne-img-delete:hover {
          background: oklch(38% 0.14 28 / 0.9);
        }

        .ne-img-delete:disabled {
          opacity: 0.3 !important;
          cursor: not-allowed;
        }

        /* ── Upload row ── */
        .ne-upload-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .ne-upload-btn {
          width: 96px;
          height: 96px;
          border: 1px dashed oklch(76% 0.016 58);
          border-radius: 4px;
          background: oklch(97% 0.009 62);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          cursor: pointer;
          color: oklch(58% 0.016 58);
          font-size: 0.75rem;
          letter-spacing: 0.03em;
          transition: border-color 0.14s, background 0.14s, color 0.14s;
          flex-shrink: 0;
          font-family: inherit;
        }

        .ne-upload-btn:hover:not(:disabled) {
          border-color: oklch(58% 0.055 52);
          color: oklch(42% 0.055 52);
          background: oklch(96% 0.014 62);
        }

        .ne-upload-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ne-upload-plus {
          font-size: 1.5rem;
          line-height: 1;
          font-weight: 300;
        }

        .ne-upload-limit-note {
          font-size: 0.75rem;
          color: oklch(60% 0.014 58);
          letter-spacing: 0.02em;
          font-style: italic;
        }

        .ne-upload-error {
          font-size: 0.8125rem;
          color: oklch(42% 0.14 28);
          letter-spacing: 0.02em;
          margin-top: 4px;
          width: 100%;
        }
      `}</style>

      <div className="ne-root">
        {/* Textarea */}
        <div className="ne-textarea-wrap">
          <textarea
            className="ne-textarea"
            value={currentContent}
            onChange={readonly ? undefined : handleTextChange}
            readOnly={readonly}
            maxLength={readonly ? undefined : NOTE_CONTENT_MAX}
            placeholder={readonly ? "（暂无记录）" : "今天最想说的一句话…"}
            rows={5}
          />
          {!readonly && (
            <span className={`ne-char-counter${isAtWarning ? " warning" : ""}`}>
              {charCount}/{NOTE_CONTENT_MAX}
            </span>
          )}
        </div>

        {/* Save button row — hidden in readonly */}
        {!readonly && (
          <div className="ne-save-row">
            <button
              className="ne-save-btn"
              onClick={handleSave}
              disabled={!dirty || isSavePending}
            >
              {isSavePending ? "保存中…" : saveLabel}
            </button>
            {saveError && (
              <span className="ne-save-error" role="alert">
                {saveError}
              </span>
            )}
          </div>
        )}

        {/* Image thumbnails */}
        {imageCount > 0 && (
          <div className="ne-images-grid">
            {images.map((img) => (
              <div key={img.id} className="ne-img-thumb">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/uploads/${img.id}`}
                  alt={img.originalName}
                  loading="lazy"
                />
                {/* Delete button hidden in readonly */}
                {!readonly && (
                  <button
                    className="ne-img-delete"
                    onClick={() => handleDeleteImage(img.id)}
                    disabled={isDeletePending}
                    aria-label={`删除图片 ${img.originalName}`}
                    title="删除"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload control — hidden in readonly */}
        {!readonly && (
          <div className="ne-upload-row">
            {atImageLimit ? (
              <span className="ne-upload-limit-note">已达上限 6 张</span>
            ) : (
              <button
                className="ne-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isDeletePending}
                aria-label="上传图片"
                title={isUploading ? "上传中…" : "添加图片"}
              >
                <span className="ne-upload-plus">
                  {isUploading ? "…" : "+"}
                </span>
                <span>{isUploading ? "上传中" : "添加图片"}</span>
              </button>
            )}
            {uploadError && (
              <span className="ne-upload-error" role="alert">
                {uploadError}
              </span>
            )}
          </div>
        )}

        {/* Hidden file input — only needed in interactive mode */}
        {!readonly && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={handleFileChange}
            aria-hidden="true"
          />
        )}
      </div>
    </>
  );
}
