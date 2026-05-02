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
  return clean || "今天还没有写下完整的思绪，先让这一页停在安静的留白里。";
}

function getBookmarkText(entry: DailyLog) {
  return entry.tags[0] ? `#${entry.tags[0]}` : "今日书签";
}
function getBookmarkSubline(entry: DailyLog) {
  return entry.tags[1] ? `#${entry.tags[1]}` : "留住这一页的心境与线索";
}

// ── Page splitting ────────────────────────────────────────────────────────────

/**
 * Split at sentence boundaries near every `charsPerPage` characters.
 * 130 chars ≈ ~10 lines at 18 px / 1.9 lh in a ~300 px wide column.
 */
function splitIntoPages(text: string, charsPerPage = 130): string[] {
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
    // Look for a sentence end in the window [charsPerPage-40 … charsPerPage+20]
    const window = remaining.slice(0, charsPerPage + 20);
    let splitAt = charsPerPage;
    for (let i = Math.min(charsPerPage + 19, window.length - 1); i >= Math.max(0, charsPerPage - 40); i--) {
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

// ── Left page ─────────────────────────────────────────────────────────────────

function LeftPage({ entry, userImage }: { entry: DailyLog; userImage?: string | null }) {
  const timestamp = formatTimestamp(entry.date, entry.createdAt);

  return (
    /* overflow-hidden keeps everything inside the SVG frame */
    <div className="relative flex h-full flex-col overflow-hidden px-5 py-4 md:pl-7 md:pr-8 md:py-5">

      {/* ① 时间戳行 */}
      <div
        className="flex shrink-0 items-center justify-between border-b pb-2 text-[11px] tracking-[0.16em]"
        style={{ borderColor: "rgba(139,94,60,0.1)", color: "var(--m-ink3)", fontFamily: 'ui-sans-serif, sans-serif' }}
      >
        <span>{timestamp}</span>
        <span>{getWeekdayShort(entry.date)}</span>
      </div>

      {/* ② 统计徽章 */}
      <div className="mt-2.5 flex shrink-0 flex-wrap gap-1.5">
        {[
          { label: `日期 ${entry.date.slice(5).replace("-", ".")}`, color: "var(--m-accent)" },
          { label: `情绪 ${entry.mood}/10`,                          color: "var(--m-ink2)" },
          { label: `学习 ${entry.studyHours.toFixed(1)}h`,           color: "var(--m-ink2)" },
        ].map((tag) => (
          <span
            key={tag.label}
            className="rounded-full px-2.5 py-1 text-[12px]"
            style={{
              background: "rgba(139,94,60,0.08)",
              color: tag.color,
              fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",cursive',
            }}
          >
            {tag.label}
          </span>
        ))}
      </div>

      {/* ③ 插画 / 用户图片 — flex-1 自动填充剩余空间，但不超出 */}
      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        {userImage ? (
          <div
            style={{
              background: "#fff",
              padding: "6px 6px 22px",
              borderRadius: 3,
              boxShadow: "0 4px 18px rgba(0,0,0,0.12)",
              transform: "rotate(-1.8deg)",
              maxWidth: 150,
              width: "100%",
              flexShrink: 0,
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
            className="h-auto w-full rotate-[-2deg] opacity-95 drop-shadow-[0_12px_22px_rgba(110,78,51,0.13)]"
            style={{ maxWidth: 160 }}
            height={200}
            src="/illustrations/personal-notebook.svg"
            width={200}
          />
        )}
      </div>

      {/* ④ Bookmark — shrink-0 保持底部对齐 */}
      <div className="relative shrink-0">
        {/* bookmark label SVG */}
        <div className="relative" style={{ width: 200 }}>
          <Image
            alt="" aria-hidden
            className="pointer-events-none select-none"
            src="/illustrations/bookmark-label.svg"
            width={200} height={102}
            style={{ width: "100%", height: "auto" }}
          />
          <div className="absolute inset-x-0 top-0 px-6 pb-3 pt-4">
            <div
              className="flex items-center gap-1 text-[9px] tracking-[0.26em]"
              style={{ color: "rgba(124,90,58,0.72)" }}
            >
              <svg fill="currentColor" height="9" viewBox="0 0 8 10" width="8" className="opacity-80">
                <path d="M0 0H8V10L4 7.5L0 10V0Z" />
              </svg>
              BOOKMARK
            </div>
            <p className="mt-2 text-[14px] font-medium leading-tight" style={{ color: "rgba(79,55,39,0.96)" }}>
              {getBookmarkText(entry)}
            </p>
            <p className="mt-1 text-[11.5px] leading-snug" style={{ color: "rgba(125,94,66,0.76)", maxWidth: 120 }}>
              {getBookmarkSubline(entry)}
            </p>
          </div>
        </div>

        {/* Wax seal — anchored to bottom-right of the bookmark */}
        <Image
          alt="" aria-hidden
          className="pointer-events-none absolute select-none opacity-[0.68] mix-blend-multiply"
          src="/illustrations/wax-seal.svg"
          width={68} height={68}
          style={{ width: 68, height: "auto", bottom: 0, right: -4 }}
        />
      </div>
    </div>
  );
}

// ── Right page ────────────────────────────────────────────────────────────────

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
  direction: number;
}) {
  const total = pages.length;

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden px-5 py-5 md:pl-10 md:pr-7 md:py-5"
      style={{
        backgroundImage:
          "repeating-linear-gradient(180deg,transparent,transparent 33px,rgba(139,94,60,0.08) 33px,rgba(139,94,60,0.08) 34px)",
      }}
    >
      {/* 正文：占满剩余空间，overflow-hidden 防溢出 */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={currentPage}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction > 0 ? -24 : 24 }}
            initial={{ opacity: 0, x: direction > 0 ? 24 : -24 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="h-full text-[17px] leading-[1.95] tracking-[0.04em]"
            style={{
              color: "rgba(71,49,35,0.92)",
              fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif',
              whiteSpace: "pre-wrap",
            }}
          >
            {pages[currentPage] ?? ""}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* 翻页控件 */}
      {total > 1 && (
        <div
          className="mt-2 flex shrink-0 items-center justify-between pt-2"
          style={{ borderTop: "1px solid rgba(139,94,60,0.10)" }}
        >
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={onPrev}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-opacity disabled:opacity-20"
            style={{ background: "rgba(139,94,60,0.08)", color: "rgba(79,55,39,0.8)" }}
          >
            <ChevronLeft size={15} />
          </button>
          <span
            className="text-[11px] tracking-[0.14em]"
            style={{ color: "rgba(125,94,66,0.6)", fontFamily: "ui-sans-serif,sans-serif" }}
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
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Homepage card ─────────────────────────────────────────────────────────────

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
                style={{ background: "linear-gradient(180deg,transparent 0%,rgba(139,94,60,0.18) 50%,transparent 100%)" }}
              />
              <div className="grid min-h-[390px] grid-cols-1 md:grid-cols-2">
                <LeftPage entry={entry} userImage={null} />
                <div
                  className="relative flex flex-col px-5 py-5 md:pl-10 md:pr-7 md:py-5"
                  style={{ backgroundImage: "repeating-linear-gradient(180deg,transparent,transparent 33px,rgba(139,94,60,0.08) 33px,rgba(139,94,60,0.08) 34px)" }}
                >
                  <p
                    className="text-[17px] leading-[1.95] tracking-[0.04em]"
                    style={{
                      color: "rgba(71,49,35,0.92)",
                      fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif',
                      display: "-webkit-box",
                      WebkitLineClamp: 10,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
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

export function DiaryBookModal({ entry, onClose }: { entry: DailyLog; onClose: () => void }) {
  const userImage = entry.images?.[0] ?? null;
  const pages = splitIntoPages(entry.thoughts?.trim() || "");
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(1);

  const goNext = () => {
    if (currentPage < pages.length - 1) { setDirection(1); setCurrentPage((p) => p + 1); }
  };
  const goPrev = () => {
    if (currentPage > 0) { setDirection(-1); setCurrentPage((p) => p - 1); }
  };

  useEffect(() => { setCurrentPage(0); }, [entry.id]);

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
      style={{ background: "rgba(30,20,10,0.60)", backdropFilter: "blur(5px)" }}
      onClick={onClose}
      transition={{ duration: 0.22 }}
    >
      <motion.div
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="relative w-full"
        style={{ maxWidth: 880 }}
        exit={{ scale: 0.94, opacity: 0, y: 16 }}
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
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
                  style={{ background: "linear-gradient(180deg,transparent 0%,rgba(139,94,60,0.18) 50%,transparent 100%)" }}
                />

                {/*
                  固定高度：确保内容不溢出 SVG 书页框
                  移动端单列各自固定高度，桌面双列共用同一高度
                */}
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ height: 480 }}>
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
        <div className="mt-2 flex items-center justify-between px-3">
          {pages.length > 1 && (
            <p className="text-xs" style={{ color: "rgba(125,94,66,0.50)", fontFamily: "ui-sans-serif,sans-serif" }}>
              ← → 方向键翻页
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

// ── Portal wrapper ────────────────────────────────────────────────────────────

export function DiaryBookModalPortal({ entry, onClose }: { entry: DailyLog | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {entry && <DiaryBookModal entry={entry} onClose={onClose} />}
    </AnimatePresence>
  );
}
