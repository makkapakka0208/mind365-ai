"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, PencilLine, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  return clean || "今天还没有写下完整的思绪，先让这一页停在安静的留白里，等下次翻到这里时再继续。";
}

function getBookmarkText(entry: DailyLog) {
  return entry.tags[0] ? `#${entry.tags[0]}` : "今日书签";
}

function getBookmarkSubline(entry: DailyLog) {
  return entry.tags[1] ? `#${entry.tags[1]}` : "留住这一页的心境与线索";
}

/**
 * Split text into pages at roughly `charsPerPage` characters,
 * preferring to break at sentence-ending punctuation (。！？\n).
 */
function splitIntoPages(text: string, charsPerPage = 180): string[] {
  const raw = text.trim();
  if (!raw) return [""];
  if (raw.length <= charsPerPage) return [raw];

  const pages: string[] = [];
  let remaining = raw;

  while (remaining.length > 0) {
    if (remaining.length <= charsPerPage) {
      pages.push(remaining);
      break;
    }

    // Scan up to charsPerPage + small look-ahead for a sentence boundary
    const window = remaining.slice(0, charsPerPage + 30);
    let splitAt = charsPerPage;

    // Find the last sentence-end before (or near) charsPerPage
    for (let i = Math.min(charsPerPage + 29, window.length - 1); i >= charsPerPage - 40; i--) {
      const ch = window[i];
      if (ch === "。" || ch === "！" || ch === "？" || ch === "\n") {
        splitAt = i + 1;
        break;
      }
    }

    pages.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }

  return pages.filter((p) => p.length > 0);
}

// ── Left page (shared) ────────────────────────────────────────────────────────

function LeftPage({
  entry,
  userImage,
}: {
  entry: DailyLog;
  userImage?: string | null;
}) {
  const timestamp = formatTimestamp(entry.date, entry.createdAt);

  return (
    <div className="relative flex flex-col justify-between px-6 py-5 md:pl-8 md:pr-10 md:py-6">
      {/* 时间戳 + 统计徽章 */}
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
              style={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 2 }}
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
              alt="" aria-hidden
              className="pointer-events-none h-auto w-[248px] select-none"
              height={127} src="/illustrations/bookmark-label.svg" width={248}
            />
            <div className="absolute inset-x-0 top-0 px-8 pb-5 pt-5">
              <div className="flex items-center gap-1.5 text-[10px] tracking-[0.28em]" style={{ color: "rgba(124,90,58,0.72)" }}>
                <svg className="opacity-80" fill="currentColor" height="10" viewBox="0 0 8 10" width="8">
                  <path d="M0 0H8V10L4 7.5L0 10V0Z" />
                </svg>
                BOOKMARK
              </div>
              <div className="mt-3">
                <p className="text-[15px] font-medium leading-tight" style={{ color: "rgba(79,55,39,0.96)" }}>
                  {getBookmarkText(entry)}
                </p>
                <p className="mt-2 max-w-[146px] text-[12.5px] leading-relaxed tracking-wide" style={{ color: "rgba(125,94,66,0.76)" }}>
                  {getBookmarkSubline(entry)}
                </p>
              </div>
            </div>
          </div>
          <Image
            alt="" aria-hidden
            className="pointer-events-none absolute bottom-[2px] right-[-2px] h-auto w-[86px] select-none opacity-[0.68] mix-blend-multiply"
            height={86} src="/illustrations/wax-seal.svg" width={86}
          />
        </div>
      </div>
    </div>
  );
}

// ── Right page with pagination ────────────────────────────────────────────────

function RightPage({
  pages,
  currentPage,
  onPrev,
  onNext,
  direction,
}: {
  pages: string[];
  currentPage: number;
  onPrev: () => void;
  onNext: () => void;
  direction: number; // +1 forward, -1 backward
}) {
  const total = pages.length;
  const text = pages[currentPage] ?? "";

  return (
    <div
      className="relative flex flex-col px-5 py-5 md:pl-12 md:pr-8 md:py-7"
      style={{
        backgroundImage:
          "repeating-linear-gradient(180deg, transparent, transparent 33px, rgba(139,94,60,0.08) 33px, rgba(139,94,60,0.08) 34px)",
      }}
    >
      {/* 正文（动画切换） */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={currentPage}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -30 : 30 }}
            initial={{ opacity: 0, x: direction > 0 ? 30 : -30 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="text-[18px] leading-[1.9] tracking-[0.05em] text-[rgba(71,49,35,0.92)]"
            style={{
              fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
              whiteSpace: "pre-wrap",
            }}
          >
            {text}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* 翻页控件（仅多页时显示） */}
      {total > 1 && (
        <div className="mt-4 flex items-center justify-between pt-2" style={{ borderTop: "1px solid rgba(139,94,60,0.1)" }}>
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={onPrev}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity disabled:opacity-20"
            style={{ background: "rgba(139,94,60,0.08)", color: "rgba(79,55,39,0.8)" }}
          >
            <ChevronLeft size={16} />
          </button>

          <span
            className="text-[12px] tracking-[0.15em]"
            style={{ color: "rgba(125,94,66,0.65)", fontFamily: 'ui-sans-serif, sans-serif' }}
          >
            {currentPage + 1} / {total}
          </span>

          <button
            type="button"
            disabled={currentPage === total - 1}
            onClick={onNext}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity disabled:opacity-20"
            style={{ background: "rgba(139,94,60,0.08)", color: "rgba(79,55,39,0.8)" }}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Homepage card (Link, clamp text) ──────────────────────────────────────────

export function FeaturedBookPreview({ entry }: { entry: DailyLog }) {
  const excerpt = getExcerpt(entry.thoughts);

  return (
    <Link className="group block" href={`/journal?id=${entry.id}`}>
      <div className="relative px-2 pb-4 pt-2 md:px-3 md:pb-5">
        <div className="relative overflow-hidden rounded-[40px]">
          <Image alt="" aria-hidden className="pointer-events-none select-none object-fill" fill src="/illustrations/book-cover-shell.svg" />
          <div className="relative z-10 px-[42px] pb-[42px] pt-[38px] md:px-[52px] md:pb-[52px] md:pt-[44px]">
            <div className="relative overflow-hidden rounded-[24px] transition-transform duration-300 group-hover:-translate-y-0.5">
              <div aria-hidden className="pointer-events-none absolute inset-y-6 left-1/2 z-10 hidden w-px -translate-x-1/2 md:block"
                style={{ background: "linear-gradient(180deg, transparent 0%, rgba(139,94,60,0.18) 50%, transparent 100%)" }}
              />
              <div className="grid min-h-[390px] grid-cols-1 md:grid-cols-2">
                <LeftPage entry={entry} userImage={null} />
                {/* 首页卡片：静态裁断文字 */}
                <div
                  className="relative flex flex-col px-5 py-5 md:pl-12 md:pr-8 md:py-7"
                  style={{ backgroundImage: "repeating-linear-gradient(180deg, transparent, transparent 33px, rgba(139,94,60,0.08) 33px, rgba(139,94,60,0.08) 34px)" }}
                >
                  <p
                    className="text-[18px] leading-[1.9] tracking-[0.05em] text-[rgba(71,49,35,0.92)]"
                    style={{
                      fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
                      display: "-webkit-box",
                      WebkitLineClamp: 10,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {excerpt}
                  </p>
                </div>
              </div>
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
  const userImage = entry.images?.[0] ?? null;
  const pages = splitIntoPages(entry.thoughts?.trim() || "");
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    if (currentPage < pages.length - 1) {
      setDirection(1);
      setCurrentPage((p) => p + 1);
    }
  };
  const goPrev = () => {
    if (currentPage > 0) {
      setDirection(-1);
      setCurrentPage((p) => p - 1);
    }
  };

  // Reset page when entry changes
  useEffect(() => {
    setCurrentPage(0);
  }, [entry.id]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pages.length, onClose]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      style={{ background: "rgba(30,20,10,0.6)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
      transition={{ duration: 0.22 }}
    >
      {/* Book container — wider than before */}
      <motion.div
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full"
        style={{ maxWidth: 900 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute -right-1 -top-1 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-md transition-opacity hover:opacity-80 sm:-right-3 sm:-top-3"
          style={{ background: "var(--m-base-light)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)" }}
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>

        {/* Book shell */}
        <div className="relative px-2 pb-4 pt-2 md:px-3 md:pb-5">
          <div className="relative overflow-hidden rounded-[40px]">
            <Image alt="" aria-hidden className="pointer-events-none select-none object-fill" fill src="/illustrations/book-cover-shell.svg" />
            <div className="relative z-10 px-[42px] pb-[42px] pt-[38px] md:px-[52px] md:pb-[52px] md:pt-[44px]">
              <div className="relative overflow-hidden rounded-[24px]">
                <div aria-hidden className="pointer-events-none absolute inset-y-6 left-1/2 z-10 hidden w-px -translate-x-1/2 md:block"
                  style={{ background: "linear-gradient(180deg, transparent 0%, rgba(139,94,60,0.18) 50%, transparent 100%)" }}
                />
                {/* 双页展开：高度放大 */}
                <div className="grid min-h-[480px] grid-cols-1 md:grid-cols-2">
                  <LeftPage entry={entry} userImage={userImage} />
                  <RightPage
                    pages={pages}
                    currentPage={currentPage}
                    direction={direction}
                    onNext={goNext}
                    onPrev={goPrev}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center justify-between px-3">
          {pages.length > 1 && (
            <p className="text-xs" style={{ color: "rgba(125,94,66,0.55)", fontFamily: "ui-sans-serif, sans-serif" }}>
              ← → 方向键也可翻页
            </p>
          )}
          <div className="ml-auto">
            <Link
              href={`/journal?id=${entry.id}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
              style={{ background: "var(--m-base-light)", border: "1px solid var(--m-rule)", color: "var(--m-ink2)", boxShadow: "var(--m-shadow-out)" }}
              onClick={onClose}
            >
              <PencilLine size={15} />
              编辑这篇日记
            </Link>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── AnimatePresence wrapper ───────────────────────────────────────────────────

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
