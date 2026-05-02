"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PencilLine, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";

import { parseISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getWeekdayShort(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" })
    .format(parseISODate(value))
    .toUpperCase();
}

function formatTimestamp(date: string, createdAt: string) {
  const source = Number.isFinite(Date.parse(createdAt))
    ? new Date(createdAt)
    : parseISODate(date);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(source);
}

function getExcerpt(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) {
    return "今天还没有写下完整的思绪，先让这一页停在安静的留白里，等下次翻到这里时再继续。";
  }
  return clean;
}

function getBookmarkText(entry: DailyLog) {
  return entry.tags[0] ? `#${entry.tags[0]}` : "今日书签";
}

function getBookmarkSubline(entry: DailyLog) {
  return entry.tags[1] ? `#${entry.tags[1]}` : "留住这一页的心境与线索";
}

// ── Shared book inner layout ──────────────────────────────────────────────────

/**
 * The two-page spread. Used both by the homepage card and the modal.
 * `clampText`  – true for the homepage card (truncate to 10 lines),
 *               false for the modal (full scrollable text).
 * `userImage`  – if provided, replaces the default notebook illustration.
 */
function BookSpread({
  entry,
  clampText = true,
  userImage,
}: {
  entry: DailyLog;
  clampText?: boolean;
  userImage?: string | null;
}) {
  const excerpt = getExcerpt(entry.thoughts);
  const timestamp = formatTimestamp(entry.date, entry.createdAt);

  return (
    <div className="grid min-h-[390px] grid-cols-1 md:grid-cols-2">

      {/* ═══ 左页 ═══ */}
      <div className="relative flex flex-col justify-between px-6 py-5 md:pl-8 md:pr-10 md:py-6">
        {/* 时间戳 */}
        <div>
          <div
            className="flex items-center justify-between gap-3 border-b pb-3 text-[12px] tracking-[0.18em]"
            style={{
              borderColor: "rgba(139,94,60,0.1)",
              color: "var(--m-ink3)",
              fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <span>{timestamp}</span>
            <span>{getWeekdayShort(entry.date)}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { label: `日期 ${entry.date.slice(5).replace("-", ".")}`, color: "var(--m-accent)" },
              { label: `情绪 ${entry.mood}/10`, color: "var(--m-ink2)" },
              { label: `学习 ${entry.studyHours.toFixed(1)}h`, color: "var(--m-ink2)" },
            ].map((tag) => (
              <span
                key={tag.label}
                className="rounded-full px-3 py-1.5 text-[13px]"
                style={{
                  background: "rgba(139,94,60,0.08)",
                  color: tag.color,
                  fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
                }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        {/* 插画 / 用户图片 */}
        <div className="my-5 flex flex-1 items-center justify-center">
          {userImage ? (
            /* 拍立得风格的用户图片 */
            <div
              style={{
                background: "#fff",
                padding: "8px 8px 28px",
                borderRadius: 4,
                boxShadow: "0 6px 24px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.07)",
                transform: "rotate(-2deg)",
                maxWidth: 180,
                width: "100%",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="日记图片"
                src={userImage}
                style={{
                  display: "block",
                  width: "100%",
                  aspectRatio: "1",
                  objectFit: "cover",
                  borderRadius: 2,
                }}
              />
            </div>
          ) : (
            <Image
              alt="handbook illustration"
              className="h-auto w-full max-w-[208px] rotate-[-2deg] opacity-95 drop-shadow-[0_16px_28px_rgba(110,78,51,0.14)]"
              height={240}
              src="/illustrations/personal-notebook.svg"
              width={240}
            />
          )}
        </div>

        {/* Bookmark + Wax Seal */}
        <div className="flex justify-start">
          <div className="relative max-w-[300px] pr-16 pt-1">
            <div className="relative">
              <Image
                alt=""
                aria-hidden
                className="pointer-events-none h-auto w-[248px] select-none"
                height={127}
                src="/illustrations/bookmark-label.svg"
                width={248}
              />
              <div className="absolute inset-x-0 top-0 px-8 pb-5 pt-5">
                <div
                  className="flex items-center gap-1.5 text-[10px] tracking-[0.28em]"
                  style={{ color: "rgba(124,90,58,0.72)" }}
                >
                  <svg className="opacity-80" fill="currentColor" height="10" viewBox="0 0 8 10" width="8">
                    <path d="M0 0H8V10L4 7.5L0 10V0Z" />
                  </svg>
                  BOOKMARK
                </div>
                <div className="mt-3">
                  <p className="text-[15px] font-medium leading-tight" style={{ color: "rgba(79,55,39,0.96)" }}>
                    {getBookmarkText(entry)}
                  </p>
                  <p
                    className="mt-2 max-w-[146px] text-[12.5px] leading-relaxed tracking-wide"
                    style={{ color: "rgba(125,94,66,0.76)" }}
                  >
                    {getBookmarkSubline(entry)}
                  </p>
                </div>
              </div>
            </div>

            <Image
              alt=""
              aria-hidden
              className="pointer-events-none absolute bottom-[2px] right-[-2px] h-auto w-[86px] select-none opacity-[0.68] mix-blend-multiply"
              height={86}
              src="/illustrations/wax-seal.svg"
              width={86}
            />
          </div>
        </div>
      </div>

      {/* ═══ 右页：横线 + 正文 ═══ */}
      <div
        className="relative flex flex-col px-5 py-5 md:pl-12 md:pr-8 md:py-7"
        style={{
          backgroundImage:
            "repeating-linear-gradient(180deg, transparent, transparent 33px, rgba(139,94,60,0.08) 33px, rgba(139,94,60,0.08) 34px)",
        }}
      >
        <p
          className="text-[18px] leading-[1.9] tracking-[0.05em] text-[rgba(71,49,35,0.92)]"
          style={{
            fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
            ...(clampText
              ? {
                  display: "-webkit-box",
                  WebkitLineClamp: 10,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }
              : { whiteSpace: "pre-wrap" }),
          }}
        >
          {excerpt}
        </p>
      </div>

    </div>
  );
}

// ── Homepage card (Link wrapper) ──────────────────────────────────────────────

export function FeaturedBookPreview({ entry }: { entry: DailyLog }) {
  return (
    <Link className="group block" href={`/journal?id=${entry.id}`}>
      <div className="relative px-2 pb-4 pt-2 md:px-3 md:pb-5">
        <div className="relative overflow-hidden rounded-[40px]">
          <Image
            alt=""
            aria-hidden
            className="pointer-events-none select-none object-fill"
            fill
            src="/illustrations/book-cover-shell.svg"
          />
          <div className="relative z-10 px-[42px] pb-[42px] pt-[38px] md:px-[52px] md:pb-[52px] md:pt-[44px]">
            <div className="relative overflow-hidden rounded-[24px] transition-transform duration-300 group-hover:-translate-y-0.5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-6 left-1/2 z-10 hidden w-px -translate-x-1/2 md:block"
                style={{
                  background: "linear-gradient(180deg, transparent 0%, rgba(139,94,60,0.18) 50%, transparent 100%)",
                }}
              />
              <BookSpread entry={entry} clampText userImage={null} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function DiaryBookModal({
  entry,
  onClose,
}: {
  entry: DailyLog;
  onClose: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const userImage = entry.images?.[0] ?? null;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      style={{ background: "rgba(30,20,10,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full max-w-3xl"
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute -right-1 -top-1 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-opacity hover:opacity-80 sm:-right-3 sm:-top-3"
          style={{
            background: "var(--m-base-light)",
            border: "1px solid var(--m-rule)",
            color: "var(--m-ink2)",
          }}
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>

        {/* Book shell */}
        <div className="relative px-2 pb-4 pt-2 md:px-3 md:pb-5">
          <div className="relative overflow-hidden rounded-[40px]">
            <Image
              alt=""
              aria-hidden
              className="pointer-events-none select-none object-fill"
              fill
              src="/illustrations/book-cover-shell.svg"
            />
            <div className="relative z-10 px-[42px] pb-[42px] pt-[38px] md:px-[52px] md:pb-[52px] md:pt-[44px]">
              <div className="relative overflow-hidden rounded-[24px]">
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-6 left-1/2 z-10 hidden w-px -translate-x-1/2 md:block"
                  style={{
                    background:
                      "linear-gradient(180deg, transparent 0%, rgba(139,94,60,0.18) 50%, transparent 100%)",
                  }}
                />
                {/* Right page scrollable for long text */}
                <BookSpread entry={entry} clampText={false} userImage={userImage} />
              </div>
            </div>
          </div>
        </div>

        {/* Action row below the book */}
        <div className="mt-3 flex justify-end px-3">
          <Link
            href={`/journal?id=${entry.id}`}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: "var(--m-base-light)",
              border: "1px solid var(--m-rule)",
              color: "var(--m-ink2)",
              boxShadow: "var(--m-shadow-out)",
            }}
            onClick={onClose}
          >
            <PencilLine size={15} />
            编辑这篇日记
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── AnimatePresence wrapper (convenience) ─────────────────────────────────────

export function DiaryBookModalPortal({
  entry,
  onClose,
}: {
  entry: DailyLog | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {entry && <DiaryBookModal entry={entry} onClose={onClose} />}
    </AnimatePresence>
  );
}
