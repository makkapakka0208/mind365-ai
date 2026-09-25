"use client";

import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { Note } from "@/types";

/**
 * 阅读笔记：专栏式目录（NoteIndex）+ 全屏阅读页（NoteReader）。
 * 正文按空行 / 换行分段；以引号开头的段落排成引文，以「——」开头的行排成署名。
 */

const SERIF = "var(--v5-serif)";

function countChars(text: string) {
  return text.replace(/\s/g, "").length;
}

function readingMinutes(chars: number) {
  return Math.max(1, Math.round(chars / 400));
}

type Block = { kind: "p" | "quote" | "attribution"; text: string };

/** 把笔记正文拆成段落块：引号开头 → 引文，「——」开头 → 署名，其余为普通段落。 */
function toBlocks(content: string): Block[] {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => {
      if (/^(——|—|--)/.test(text)) return { kind: "attribution", text };
      if (/^[“"「『]/.test(text)) return { kind: "quote", text };
      return { kind: "p", text };
    });
}

function Meta({ note }: { note: Note }) {
  const chars = countChars(note.content);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1" style={{ fontFamily: SERIF, fontSize: 13.5, color: "var(--v5-ink3)" }}>
      {note.tags.map((tag) => (
        <span key={tag} style={{ fontStyle: "italic", color: "var(--v5-accent)" }}>#{tag}</span>
      ))}
      {note.tags.length > 0 && <span aria-hidden>·</span>}
      <span>{chars.toLocaleString("zh-CN")} 字</span>
      <span aria-hidden>·</span>
      <span>约 {readingMinutes(chars)} 分钟</span>
    </div>
  );
}

/* ── 目录 ─────────────────────────────────────────────────────── */

export function NoteIndex({ notes, onOpen }: { notes: Note[]; onOpen: (index: number) => void }) {
  return (
    <div
      className="overflow-hidden"
      style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 22, boxShadow: "var(--v5-sh-2)" }}
    >
      {notes.map((note, i) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onOpen(i)}
          className="group grid w-full gap-x-6 px-7 py-6 text-left transition-colors hover:bg-[rgba(var(--v5-accent-rgb),0.05)] sm:grid-cols-[72px_minmax(0,1fr)]"
          style={{ borderTop: i === 0 ? "none" : "1px solid var(--v5-rule)" }}
        >
          <span className="hidden sm:block" style={{ fontFamily: SERIF, fontSize: 13, letterSpacing: "0.16em", color: "var(--v5-ink-mute)", paddingTop: 6 }}>
            No.{String(notes.length - i).padStart(2, "0")}
          </span>
          <span className="min-w-0">
            <span
              className="block transition-colors group-hover:text-[var(--v5-accent)]"
              style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, lineHeight: 1.35, color: "var(--v5-ink)" }}
            >
              {note.title}
            </span>
            <span
              className="mt-2 block"
              style={{
                fontFamily: SERIF,
                fontSize: 15,
                lineHeight: 1.85,
                color: "var(--v5-ink2)",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {note.content.replace(/\s+/g, " ")}
            </span>
            <span className="mt-3 flex items-center justify-between gap-4">
              <Meta note={note} />
              <span
                className="shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ fontFamily: SERIF, fontSize: 13.5, color: "var(--v5-accent)", letterSpacing: "0.06em" }}
              >
                阅读 →
              </span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

/* ── 全屏阅读页 ───────────────────────────────────────────────── */

export function NoteReader({
  notes,
  index,
  onIndexChange,
  onClose,
  onDelete,
}: {
  notes: Note[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const note = notes[index];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= notes.length) return;
      setConfirmDelete(false);
      onIndexChange(next);
    },
    [index, notes.length, onIndexChange],
  );

  // 换篇时回到顶部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);

  if (!note) return null;
  const blocks = toBlocks(note.content);
  const prev = notes[index - 1];
  const next = notes[index + 1];

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex justify-center"
      style={{ background: "rgba(var(--v5-shadow-rgb),0.35)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={note.title}
    >
      <div
        className="relative flex h-full w-full max-w-[860px] flex-col overflow-hidden sm:my-6 sm:h-[calc(100%-48px)] sm:rounded-[28px]"
        style={{
          background: "var(--v5-surface)",
          border: "1px solid var(--v5-rule)",
          boxShadow: "0 30px 80px rgba(var(--v5-shadow-rgb),0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 阅读进度 */}
        <div className="absolute inset-x-0 top-0 z-10 h-[2px]" style={{ background: "var(--v5-rule)" }}>
          <div style={{ height: "100%", width: `${progress * 100}%`, background: "var(--v5-accent)", transition: "width 120ms linear" }} />
        </div>

        {/* 顶栏 */}
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5 sm:px-10">
          <span className="v5-eyebrow">阅读笔记 · No.{String(notes.length - index).padStart(2, "0")}</span>
          <div className="flex items-center gap-1.5">
            {confirmDelete ? (
              <>
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-xs transition-opacity hover:opacity-85"
                  style={{ background: "var(--m-danger)", color: "var(--v5-surface)" }}
                  onClick={() => onDelete(note.id)}
                >
                  确认删除
                </button>
                <button
                  type="button"
                  className="rounded-full px-3 py-1.5 text-xs"
                  style={{ color: "var(--v5-ink3)" }}
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label="删除这篇笔记"
                className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[rgba(var(--v5-ink-rgb),0.06)]"
                style={{ color: "var(--v5-ink3)" }}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} />
              </button>
            )}
            <button
              type="button"
              aria-label="关闭"
              className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-[rgba(var(--v5-ink-rgb),0.06)]"
              style={{ color: "var(--v5-ink2)" }}
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 正文 */}
        <div
          ref={scrollRef}
          className="m-scroll-hidden flex-1 overflow-y-auto px-6 pb-16 sm:px-10"
          onScroll={(e) => {
            const el = e.currentTarget;
            const max = el.scrollHeight - el.clientHeight;
            setProgress(max > 0 ? el.scrollTop / max : 1);
          }}
        >
          <article key={note.id} className="note-reader-article mx-auto max-w-[640px] pt-6">
            <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: "clamp(28px, 3.4vw, 36px)", fontWeight: 600, lineHeight: 1.3, color: "var(--v5-ink)" }}>
              {note.title}
            </h1>
            <div className="mt-4">
              <Meta note={note} />
            </div>
            <div className="my-9 h-px w-16" style={{ background: "var(--v5-accent)", opacity: 0.5 }} />

            <div style={{ fontFamily: SERIF, fontSize: 17.5, lineHeight: 2.05, color: "var(--v5-ink)" }}>
              {blocks.map((block, i) => {
                if (block.kind === "quote") {
                  return (
                    <blockquote
                      key={i}
                      style={{
                        margin: "32px 0",
                        padding: "2px 0 2px 22px",
                        borderLeft: "2px solid rgba(var(--v5-accent-rgb),0.55)",
                        fontSize: 19,
                        fontStyle: "italic",
                        lineHeight: 1.9,
                        color: "var(--v5-ink)",
                      }}
                    >
                      {block.text}
                    </blockquote>
                  );
                }
                if (block.kind === "attribution") {
                  return (
                    <p key={i} className="text-right" style={{ margin: "-18px 0 28px", fontStyle: "italic", fontSize: 15, color: "var(--v5-ink3)" }}>
                      {block.text}
                    </p>
                  );
                }
                return (
                  <p key={i} style={{ margin: "0 0 1.15em" }}>
                    {block.text}
                  </p>
                );
              })}
            </div>

            {/* 上一篇 / 下一篇 */}
            <nav className="mt-16 grid grid-cols-2 gap-4 border-t pt-6" style={{ borderColor: "var(--v5-rule)" }}>
              <div>
                {prev && (
                  <button type="button" className="group text-left" onClick={() => go(-1)}>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--v5-ink3)" }}>
                      <ChevronLeft size={13} /> 上一篇
                    </span>
                    <span className="mt-1 block transition-colors group-hover:text-[var(--v5-accent)]" style={{ fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink2)" }}>
                      {prev.title}
                    </span>
                  </button>
                )}
              </div>
              <div className="text-right">
                {next && (
                  <button type="button" className="group text-right" onClick={() => go(1)}>
                    <span className="flex items-center justify-end gap-1 text-xs" style={{ color: "var(--v5-ink3)" }}>
                      下一篇 <ChevronRight size={13} />
                    </span>
                    <span className="mt-1 block transition-colors group-hover:text-[var(--v5-accent)]" style={{ fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink2)" }}>
                      {next.title}
                    </span>
                  </button>
                )}
              </div>
            </nav>
          </article>
        </div>
      </div>
    </div>,
    document.body,
  );
}
