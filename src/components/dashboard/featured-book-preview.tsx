"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  ImagePlus,
  MoreHorizontal,
  PencilLine,
  Smile,
  Type,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { parseISODate } from "@/lib/date";
import type { DailyLog, TimeEntry } from "@/types";

// ── TimeEntry helpers (used in modal) ─────────────────────────────────────────

function sumEntryHours(entries: TimeEntry[], date: string, type: TimeEntry["type"]) {
  return entries
    .filter((e) => e.date === date && e.type === type)
    .reduce((sum, e) => sum + e.hours, 0);
}

function readingNotesForDate(entries: TimeEntry[], date: string): string[] {
  return entries
    .filter((e) => e.date === date && e.type === "reading" && e.note?.trim())
    .map((e) => e.note!.trim());
}

function studyNotesForDate(entries: TimeEntry[], date: string): string[] {
  return entries
    .filter((e) => e.date === date && e.type === "study" && e.note?.trim())
    .map((e) => e.note!.trim());
}

function formatHours(h: number) {
  if (h <= 0) return "—";
  if (h < 1) return `${Math.round(h * 60)} 分钟`;
  return `${h % 1 === 0 ? h : h.toFixed(1)} h`;
}

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

// ── Modal-only helpers ────────────────────────────────────────────────────────

function getTimeOfDay(createdAt: string): string {
  const d = Number.isFinite(Date.parse(createdAt)) ? new Date(createdAt) : new Date();
  const h = d.getHours();
  if (h < 6) return "深夜";
  if (h < 9) return "早晨";
  if (h < 12) return "上午";
  if (h < 14) return "中午";
  if (h < 17) return "下午";
  if (h < 19) return "傍晚";
  if (h < 22) return "晚上";
  return "深夜";
}

function formatTimeHM(createdAt: string): string {
  const d = Number.isFinite(Date.parse(createdAt)) ? new Date(createdAt) : new Date();
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function getMoodMeta(score: number): { label: string; color: string; bg: string } {
  if (score >= 8) return { label: "心情很好", color: "#4A9B6F", bg: "rgba(74,155,111,0.10)" };
  if (score >= 6) return { label: "状态平稳", color: "#C8962A", bg: "rgba(200,150,42,0.10)" };
  if (score >= 4) return { label: "有些疲惫", color: "#C07A3A", bg: "rgba(192,122,58,0.10)" };
  return { label: "心情低落", color: "#C0392B", bg: "rgba(192,57,43,0.10)" };
}

// ── Mood Spirit ───────────────────────────────────────────────────────────────

function MoodSpirit({ score, size = 36 }: { score: number; size?: number }) {
  const { label, type } = score >= 8
    ? { label: "心情很好", type: "sun" }
    : score >= 6
    ? { label: "状态平稳", type: "moon" }
    : score >= 4
    ? { label: "有些疲惫", type: "cloud" }
    : { label: "心情低落", type: "rain" };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
        style={{ lineHeight: 0 }}
      >
        {type === "sun" && (
          <svg viewBox="0 0 44 44" width={size} height={size} fill="none">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
              const r = (deg * Math.PI) / 180;
              return (
                <line key={deg}
                  x1={22 + 14 * Math.cos(r)} y1={22 + 14 * Math.sin(r)}
                  x2={22 + 20 * Math.cos(r)} y2={22 + 20 * Math.sin(r)}
                  stroke="#F5C030" strokeWidth="2.4" strokeLinecap="round"
                />
              );
            })}
            <circle cx="22" cy="22" r="12" fill="#FFD93D" stroke="#E8B820" strokeWidth="1.2" />
            <ellipse cx="17" cy="24" rx="2.5" ry="1.5" fill="rgba(255,130,80,0.35)" />
            <ellipse cx="27" cy="24" rx="2.5" ry="1.5" fill="rgba(255,130,80,0.35)" />
            <circle cx="18.5" cy="20" r="1.8" fill="#7A4A08" />
            <circle cx="25.5" cy="20" r="1.8" fill="#7A4A08" />
            <circle cx="19.2" cy="19.3" r="0.6" fill="rgba(255,255,255,0.8)" />
            <circle cx="26.2" cy="19.3" r="0.6" fill="rgba(255,255,255,0.8)" />
            <path d="M17.5 25 Q22 29.5 26.5 25" stroke="#7A4A08" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
        {type === "moon" && (
          <svg viewBox="0 0 44 44" width={size} height={size} fill="none">
            <path d="M27 7 A15 15 0 1 0 27 37 A10 10 0 1 1 27 7Z" fill="#D6C8F0" stroke="#9B8BC4" strokeWidth="0.9" />
            <circle cx="33" cy="11" r="1.3" fill="#C4AEED" />
            <circle cx="36" cy="21" r="0.9" fill="#C4AEED" />
            <circle cx="31" cy="30" r="1.1" fill="#C4AEED" />
            <circle cx="19.5" cy="20" r="1.5" fill="#7060A0" />
            <circle cx="25.5" cy="20" r="1.5" fill="#7060A0" />
            <path d="M18.5 25 Q22 26.5 25.5 25" stroke="#7060A0" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        )}
        {type === "cloud" && (
          <svg viewBox="0 0 44 44" width={size} height={size} fill="none">
            <path d="M7 31 Q7 22 15 21 Q15 13 23 13 Q30 13 32 19 Q38 18 38 25 Q40 32 35 33 Q7 35 7 31Z"
              fill="#C8D8E8" stroke="#8AABB8" strokeWidth="1" />
            <path d="M16.5 26 Q18.5 24 20.5 26" stroke="#5A8898" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M23 26 Q25 24 27 26" stroke="#5A8898" strokeWidth="1.6" strokeLinecap="round" />
            <text x="32" y="18" fontSize="5" fill="rgba(100,140,160,0.6)" fontFamily="ui-sans-serif">z</text>
            <text x="35" y="14" fontSize="4" fill="rgba(100,140,160,0.45)" fontFamily="ui-sans-serif">z</text>
          </svg>
        )}
        {type === "rain" && (
          <svg viewBox="0 0 44 48" width={size} height={Math.round(size * 48 / 44)} fill="none">
            <path d="M6 28 Q6 19 14 18 Q14 10 22 10 Q30 10 32 17 Q38 16 38 23 Q40 30 35 31 Q6 33 6 28Z"
              fill="#A8B8C8" stroke="#7090A0" strokeWidth="1" />
            <path d="M15 24.5 Q17.5 22 20 24.5" stroke="#50808C" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M23 24.5 Q25.5 22 28 24.5" stroke="#50808C" strokeWidth="1.6" strokeLinecap="round" />
            {[13, 21, 29].map((x) => (
              <g key={x}>
                <line x1={x} y1="36" x2={x - 1} y2="42" stroke="#7AAABB" strokeWidth="1.4" strokeLinecap="round" />
              </g>
            ))}
          </svg>
        )}
      </motion.div>
      <span style={{ fontSize: 10, color: "rgba(100,70,42,0.6)", fontFamily: "ui-sans-serif,sans-serif" }}>
        {label}
      </span>
    </div>
  );
}

// ── Hourglass stat (拟物化沙漏) ──────────────────────────────────────────────

function HourglassStat({ hours }: { hours: number }) {
  const uid = useId();
  const fill = Math.min(Math.max(hours / 8, 0), 1);

  const topDome = "M11 10 C5 24 21 44 24 48 L28 48 C31 44 47 24 41 10 Z";
  const botDome = "M24 48 C21 52 5 72 11 86 L41 86 C47 72 31 52 28 48 Z";

  const topSandY = 10 + fill * 38;
  const botSandY = 86 - fill * 38;

  const label = hours <= 0 ? "0h" : hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 52 96" width="34" height="62" fill="none">
        <defs>
          <clipPath id={`${uid}-t`}><path d={topDome} /></clipPath>
          <clipPath id={`${uid}-b`}><path d={botDome} /></clipPath>
        </defs>
        <rect x="7"  y="10" width="5" height="76" rx="2.5" fill="#5C3A1E" />
        <rect x="40" y="10" width="5" height="76" rx="2.5" fill="#5C3A1E" />
        <rect x="8"  y="10" width="1.5" height="76" rx="0.75" fill="rgba(200,160,110,0.22)" />
        <rect x="41" y="10" width="1.5" height="76" rx="0.75" fill="rgba(200,160,110,0.22)" />
        <path d={topDome} fill="rgba(180,140,100,0.10)" stroke="#7A5535" strokeWidth="1.1" />
        <path d={botDome} fill="rgba(180,140,100,0.10)" stroke="#7A5535" strokeWidth="1.1" />
        <rect x="0" y={topSandY} width="52" height={Math.max(48 - topSandY, 0)}
          fill="rgba(148,100,55,0.90)" clipPath={`url(#${uid}-t)`} />
        {fill < 0.97 && topSandY < 47 && (
          <rect x="0" y={topSandY} width="52" height="1.6"
            fill="rgba(185,138,85,0.50)" clipPath={`url(#${uid}-t)`} />
        )}
        <rect x="0" y={botSandY} width="52" height={Math.max(86 - botSandY, 0)}
          fill="rgba(148,100,55,0.90)" clipPath={`url(#${uid}-b)`} />
        {fill > 0.03 && botSandY > 49 && (
          <rect x="0" y={botSandY} width="52" height="1.6"
            fill="rgba(185,138,85,0.50)" clipPath={`url(#${uid}-b)`} />
        )}
        {fill > 0.03 && fill < 0.97 && (
          <>
            <line x1="26" y1="48" x2="26" y2="53"
              stroke="rgba(140,90,45,0.50)" strokeWidth="1.4" strokeLinecap="round" />
            <ellipse cx="26" cy="51" rx="1.5" ry="1" fill="rgba(150,100,55,0.75)" />
          </>
        )}
        <path d="M14 13 C11 24 20 38 22 46"
          stroke="rgba(255,245,230,0.26)" strokeWidth="4" strokeLinecap="round" />
        <path d="M38 13 C41 24 33 38 30 46"
          stroke="rgba(40,20,5,0.06)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M14 51 C11 62 13 74 16 84"
          stroke="rgba(255,245,230,0.18)" strokeWidth="3.5" strokeLinecap="round" />
        <rect x="4" y="0" width="44" height="11" rx="4.5" fill="#5C3A1E" />
        <rect x="5" y="1" width="42" height="4"  rx="3"   fill="rgba(200,160,110,0.20)" />
        <rect x="6" y="1.5" width="18" height="1.5" rx="0.75" fill="rgba(220,185,145,0.22)" />
        <circle cx="12" cy="5.5" r="3.2" fill="#3E2208" stroke="rgba(180,135,85,0.45)" strokeWidth="0.9" />
        <line x1="9.8"  y1="5.5" x2="14.2" y2="5.5" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
        <line x1="12"   y1="3.3" x2="12"   y2="7.7" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
        <circle cx="40" cy="5.5" r="3.2" fill="#3E2208" stroke="rgba(180,135,85,0.45)" strokeWidth="0.9" />
        <line x1="37.8" y1="5.5" x2="42.2" y2="5.5" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
        <line x1="40"   y1="3.3" x2="40"   y2="7.7" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
        <rect x="4" y="85" width="44" height="11" rx="4.5" fill="#5C3A1E" />
        <rect x="5" y="91" width="42" height="4"  rx="3"   fill="rgba(30,15,5,0.20)" />
        <rect x="6" y="85.5" width="18" height="1.5" rx="0.75" fill="rgba(220,185,145,0.18)" />
        <circle cx="12" cy="90.5" r="3.2" fill="#3E2208" stroke="rgba(180,135,85,0.45)" strokeWidth="0.9" />
        <line x1="9.8"  y1="90.5" x2="14.2" y2="90.5" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
        <line x1="12"   y1="88.3" x2="12"   y2="92.7" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
        <circle cx="40" cy="90.5" r="3.2" fill="#3E2208" stroke="rgba(180,135,85,0.45)" strokeWidth="0.9" />
        <line x1="37.8" y1="90.5" x2="42.2" y2="90.5" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
        <line x1="40"   y1="88.3" x2="40"   y2="92.7" stroke="rgba(100,60,20,0.65)" strokeWidth="1.1" />
      </svg>

      <div style={{ textAlign: "center", lineHeight: 1.2 }}>
        <div style={{ fontSize: 8, letterSpacing: "0.12em", color: "rgba(110,78,40,0.48)", fontFamily: "ui-sans-serif,sans-serif", textTransform: "uppercase" }}>Learn</div>
        <div style={{ fontSize: 13, fontFamily: '"Ma Shan Zheng","STKaiti",serif', color: "rgba(88,58,28,0.9)" }}>{label}</div>
      </div>
    </div>
  );
}

// ── Book stat (阅读时长小书本图标) ────────────────────────────────────────────

function BookStat({ reading }: { reading: string }) {
  const display = reading && reading !== "0" && reading !== "" ? reading : "—";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 44 34" width="40" height="30" fill="none">
        <path d="M21 4 Q22 3 23 4 L23 30 Q22 31 21 30 Z" fill="rgba(100,65,25,0.18)" />
        <path d="M3 6 Q12 3 21 5 L21 30 Q12 28 3 29 Z"
          fill="#F0E6D0" stroke="#A08050" strokeWidth="0.9" strokeLinejoin="round" />
        <line x1="6"  y1="11" x2="18" y2="10" stroke="rgba(130,95,55,0.25)" strokeWidth="0.7" />
        <line x1="6"  y1="14" x2="18" y2="13" stroke="rgba(130,95,55,0.22)" strokeWidth="0.7" />
        <line x1="6"  y1="17" x2="18" y2="16" stroke="rgba(130,95,55,0.22)" strokeWidth="0.7" />
        <line x1="6"  y1="20" x2="15" y2="19.5" stroke="rgba(130,95,55,0.18)" strokeWidth="0.7" />
        <path d="M23 5 Q32 3 41 6 L41 29 Q32 28 23 30 Z"
          fill="#EDE0C4" stroke="#A08050" strokeWidth="0.9" strokeLinejoin="round" />
        <line x1="26" y1="10" x2="38" y2="11" stroke="rgba(130,95,55,0.25)" strokeWidth="0.7" />
        <line x1="26" y1="13" x2="38" y2="14" stroke="rgba(130,95,55,0.22)" strokeWidth="0.7" />
        <line x1="26" y1="16" x2="38" y2="17" stroke="rgba(130,95,55,0.22)" strokeWidth="0.7" />
        <line x1="26" y1="19.5" x2="35" y2="20" stroke="rgba(130,95,55,0.18)" strokeWidth="0.7" />
        <line x1="22" y1="5" x2="22" y2="30" stroke="rgba(160,120,65,0.50)" strokeWidth="1.2" />
        <path d="M3 6 Q12 2.5 22 4.5 Q32 2.5 41 6"
          stroke="rgba(200,165,100,0.35)" strokeWidth="0.8" fill="none" />
      </svg>
      <div style={{ textAlign: "center", lineHeight: 1.2 }}>
        <div style={{ fontSize: 8, letterSpacing: "0.12em", color: "rgba(110,78,40,0.48)", fontFamily: "ui-sans-serif,sans-serif", textTransform: "uppercase" }}>Read</div>
        <div style={{ fontSize: 13, fontFamily: '"Ma Shan Zheng","STKaiti",serif', color: "rgba(88,58,28,0.9)" }}>{display}</div>
      </div>
    </div>
  );
}

// ── Left page (homepage card) ─────────────────────────────────────────────────

function LeftPage({ entry, userImage }: { entry: DailyLog; userImage?: string | null }) {
  const timestamp = formatTimestamp(entry.date, entry.createdAt);
  const dateLabel = entry.date.slice(5).replace("-", ".");

  const caption = (() => {
    const t = entry.thoughts.trim();
    if (!t) return `${dateLabel} 无言`;
    const end = t.search(/[。！？\n]/);
    const snippet = end > 0 && end <= 14 ? t.slice(0, end) : t.slice(0, 12);
    return `${dateLabel}  ${snippet}${t.length > snippet.length ? "…" : ""}`;
  })();

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-6 py-4 md:pl-8 md:pr-7 md:py-6">
      <div
        className="flex shrink-0 items-center justify-between border-b pb-2 pl-2 text-[12px] tracking-[0.16em]"
        style={{ borderColor: "rgba(139,94,60,0.1)", color: "var(--m-ink3)", fontFamily: "ui-sans-serif, sans-serif" }}
      >
        <span>{timestamp}</span>
        <span>{getWeekdayShort(entry.date)}</span>
      </div>
      <div
        className="mx-auto my-auto flex shrink-0 items-center justify-center"
        style={{ maxHeight: 230, maxWidth: "100%" }}
      >
        {userImage ? (
          <div style={{ transform: "rotate(-2.2deg)", maxWidth: 195, width: "100%" }}>
            <div
              style={{
                background: "#fff",
                padding: "7px 7px 0",
                borderRadius: 3,
                boxShadow: [
                  "0 1px 0 1px #e8e0d4",
                  "0 2px 0 1px #ddd6c8",
                  "0 3px 0 1px #d2c8ba",
                  "0 4px 0 1px #c8bfaf",
                  "0 10px 22px rgba(0,0,0,0.18)",
                  "0 3px 8px rgba(0,0,0,0.10)",
                ].join(", "),
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="日记图片"
                src={userImage}
                style={{ display: "block", width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 1 }}
              />
              <div
                style={{
                  padding: "6px 8px 9px",
                  fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",cursive',
                  fontSize: 11.5,
                  color: "rgba(70,52,36,0.50)",
                  letterSpacing: "0.04em",
                  lineHeight: 1.4,
                  textAlign: "center",
                  textShadow: "0.3px 0.3px 0 rgba(0,0,0,0.06)",
                }}
              >
                {caption}
              </div>
            </div>
          </div>
        ) : (
          <Image
            alt="handbook illustration"
            className="h-auto w-full rotate-[-2deg] opacity-95 drop-shadow-[0_12px_22px_rgba(110,78,51,0.13)]"
            style={{ maxWidth: 210 }}
            height={230}
            src="/illustrations/personal-notebook.svg"
            width={230}
          />
        )}
      </div>
      <div className="relative mt-auto shrink-0 pl-2 pt-1">
        <div className="relative" style={{ width: 250 }}>
          <Image
            alt="" aria-hidden
            className="pointer-events-none select-none"
            src="/illustrations/bookmark-label.svg"
            width={250} height={127}
            style={{ width: "100%", height: "auto" }}
          />
          <div className="absolute inset-x-0 top-0 pl-10 pr-6 pb-3 pt-4">
            <div
              className="flex items-center gap-1 text-[9px] tracking-[0.26em]"
              style={{ color: "rgba(124,90,58,0.72)" }}
            >
              <svg fill="currentColor" height="9" viewBox="0 0 8 10" width="9" className="opacity-80">
                <path d="M0 0H8V10L4 7.5L0 10V0Z" />
              </svg>
              BOOKMARK
            </div>
            <p className="mt-1.5 text-[14px] font-medium leading-tight" style={{ color: "rgba(79,55,39,0.96)" }}>
              {getBookmarkText(entry)}
            </p>
            <p className="mt-1 text-[11px] leading-snug" style={{ color: "rgba(125,94,66,0.76)", maxWidth: 136 }}>
              {getBookmarkSubline(entry)}
            </p>
          </div>
        </div>
        <Image
          alt="" aria-hidden
          className="pointer-events-none absolute select-none opacity-[0.68] mix-blend-multiply"
          src="/illustrations/wax-seal.svg"
          width={70} height={70}
          style={{ width: 70, height: "auto", bottom: 0, right: -4 }}
        />
      </div>
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
              <div className="grid min-h-[480px] grid-cols-1 md:grid-cols-2">
                <LeftPage entry={entry} userImage={null} />
                <div
                  className="relative flex flex-col overflow-hidden px-5 py-4 md:pl-10 md:pr-7 md:py-6"
                  style={{ backgroundImage: "repeating-linear-gradient(180deg,transparent,transparent 33px,rgba(139,94,60,0.08) 33px,rgba(139,94,60,0.08) 34px)" }}
                >
                  <p
                    className="text-[16px] leading-[1.95] tracking-[0.04em]"
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

// ── Image Lightbox ────────────────────────────────────────────────────────────

function ImageLightbox({
  images,
  initialIndex,
  onClose,
}: {
  images: string[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const total = images.length;
  const canPrev = index > 0;
  const canNext = index < total - 1;

  const goPrev = useCallback(() => { if (canPrev) setIndex((i) => i - 1); }, [canPrev]);
  const goNext = useCallback(() => { if (canNext) setIndex((i) => i + 1); }, [canNext]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ background: "rgba(8,4,2,0.82)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        aria-label="关闭"
        className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        onClick={onClose}
      >
        <X size={22} />
      </button>

      {/* Prev */}
      {total > 1 && (
        <button
          type="button"
          aria-label="上一张"
          disabled={!canPrev}
          className="absolute left-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20"
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Image */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={index}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.18 }}
          className="relative max-h-[85vh] max-w-[90vw]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`日记图片 ${index + 1}`}
            src={images[index]}
            style={{
              display: "block",
              maxWidth: "90vw",
              maxHeight: "85vh",
              objectFit: "contain",
              borderRadius: 8,
              boxShadow: "0 24px 60px rgba(0,0,0,0.4)",
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Next */}
      {total > 1 && (
        <button
          type="button"
          aria-label="下一张"
          disabled={!canNext}
          className="absolute right-4 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-20"
          onClick={(e) => { e.stopPropagation(); goNext(); }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Counter */}
      {total > 1 && (
        <div
          className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-medium text-white/80"
          style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)" }}
        >
          {index + 1} / {total}
        </div>
      )}
    </motion.div>
  );
}

// ── Slide variants for entry transition ──────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 280 : -280,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -280 : 280,
    opacity: 0,
  }),
};

// ── Modal (Notion-style with navigation + lightbox) ──────────────────────────

export function DiaryBookModal({
  entries,
  initialEntryId,
  timeEntries = [],
  onClose,
}: {
  entries: DailyLog[];
  initialEntryId: string;
  timeEntries?: TimeEntry[];
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, entries.findIndex((e) => e.id === initialEntryId)),
  );
  const [slideDir, setSlideDir] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState<number | null>(null);

  const entry = entries[currentIndex];

  // Navigation
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < entries.length - 1;

  const goNext = useCallback(() => {
    if (currentIndex < entries.length - 1) {
      setSlideDir(1);
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, entries.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setSlideDir(-1);
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  // Swipe / drag detection
  const dragRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore non-primary mouse buttons
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, t: Date.now() };
    // Capture the pointer so pointerup fires even if cursor leaves the element
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    const dt = Date.now() - dragRef.current.t;
    dragRef.current = null;
    // ≥60px horizontal, more horizontal than vertical, within 450ms
    if (Math.abs(dx) >= 60 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 450) {
      if (dx < 0) goNext();
      else goPrev();
    }
  }, [goNext, goPrev]);

  const onPointerCancel = useCallback(() => { dragRef.current = null; }, []);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, goNext, goPrev]);

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (!entry) return null;

  const userImage = entry.images?.[0] ?? null;
  const allImages = entry.images ?? [];
  const timeOfDay = getTimeOfDay(entry.createdAt);
  const timeHM = formatTimeHM(entry.createdAt);
  const mood = getMoodMeta(entry.mood);
  const [mm, dd] = entry.date.slice(5).split("-");
  const dateDisplay = `${mm}月${dd}日`;

  // Aggregate TimeEntry data for this day
  const teStudyHours = sumEntryHours(timeEntries, entry.date, "study");
  const teReadingHours = sumEntryHours(timeEntries, entry.date, "reading");
  const totalStudyHours = entry.studyHours + teStudyHours;
  const totalReadingHours = teReadingHours; // TimeEntry-based reading hours
  const studyLabel = formatHours(totalStudyHours);
  const readingHoursLabel = formatHours(totalReadingHours);

  // Reading list: TimeEntry notes + legacy DailyLog.reading string
  const readingNotes = readingNotesForDate(timeEntries, entry.date);
  const studyNotes = studyNotesForDate(timeEntries, entry.date);
  const legacyReading = entry.reading?.trim();
  const hasReadingList = readingNotes.length > 0 || !!legacyReading;
  const hasStudyNotes = studyNotes.length > 0;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      style={{ background: "rgba(20,12,6,0.58)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      transition={{ duration: 0.2 }}
    >
      {/* Extra horizontal padding on desktop gives the outside arrows room */}
      <div className="flex min-h-full items-center justify-center px-4 py-10 sm:px-6 md:px-20">

        {/* Position wrapper — NOT overflow-hidden; gives arrows their relative context */}
        <div
          className="relative w-full"
          style={{ maxWidth: 960 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Desktop arrows: live OUTSIDE the card so overflow-hidden can't clip them */}
          {entries.length > 1 && (
            <>
              <button
                type="button"
                aria-label="上一篇日记"
                disabled={!canPrev}
                className="absolute -left-14 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
                style={{ color: "#6B4832" }}
                onClick={goPrev}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                aria-label="下一篇日记"
                disabled={!canNext}
                className="absolute -right-14 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition-all hover:bg-white disabled:pointer-events-none disabled:opacity-0 md:flex"
                style={{ color: "#6B4832" }}
                onClick={goNext}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          {/* The card — overflow-hidden for slide animation; pointer events for swipe */}
          <motion.div
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="relative w-full overflow-hidden"
            style={{
              borderRadius: 16,
              background: "#FAF7F0",
              boxShadow: "0 32px 80px rgba(0,0,0,0.22), 0 8px 24px rgba(0,0,0,0.10)",
              userSelect: "none",
            }}
            exit={{ scale: 0.95, opacity: 0, y: 16 }}
            initial={{ scale: 0.95, opacity: 0, y: 16 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
          {/* Close button */}
          <button
            className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-black/5"
            style={{ color: "#A08060" }}
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            aria-label="关闭"
          >
            <X size={17} />
          </button>

          {/* Mobile arrows: inside the card, md:hidden */}
          {entries.length > 1 && (
            <>
              <button
                type="button"
                aria-label="上一篇日记"
                disabled={!canPrev}
                className="absolute left-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-all disabled:pointer-events-none disabled:opacity-0 md:hidden"
                style={{ color: "#6B4832" }}
                onClick={(e) => { e.stopPropagation(); goPrev(); }}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                aria-label="下一篇日记"
                disabled={!canNext}
                className="absolute right-3 top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 shadow-md transition-all disabled:pointer-events-none disabled:opacity-0 md:hidden"
                style={{ color: "#6B4832" }}
                onClick={(e) => { e.stopPropagation(); goNext(); }}
              >
                <ChevronRight size={18} />
              </button>
            </>
          )}

          {/* Content area with slide animation */}
          <AnimatePresence mode="wait" initial={false} custom={slideDir}>
            <motion.div
              key={entry.id}
              custom={slideDir}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="grid min-h-[600px] grid-cols-1 md:grid-cols-[2fr_3fr]">

                {/* ── LEFT PANE ── */}
                <div
                  className="flex flex-col gap-5 p-6 md:p-7"
                  style={{ background: "#F3EDE4", borderRight: "1px solid #E8DDD0" }}
                >
                  {/* Date + time + mood */}
                  <div className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span style={{ fontSize: 26, fontWeight: 700, color: "#2D1811", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
                        {dateDisplay}
                      </span>
                      <span style={{ fontSize: 13, color: "#A08060" }}>
                        {timeOfDay} {timeHM}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
                        style={{ background: mood.bg, color: mood.color }}
                      >
                        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: mood.color, flexShrink: 0 }} />
                        {mood.label} · {entry.mood}/10
                      </span>
                    </div>
                  </div>

                  {/* Stats cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1 rounded-xl p-3.5" style={{ background: "#FAF7F0", border: "1px solid #E8DDD0" }}>
                      <BookOpen size={15} style={{ color: "#A08060" }} />
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#2D1811", lineHeight: 1.2, marginTop: 4 }}>
                        {readingHoursLabel}
                      </div>
                      <div style={{ fontSize: 11, color: "#A08060" }}>阅读时长</div>
                    </div>
                    <div className="flex flex-col gap-1 rounded-xl p-3.5" style={{ background: "#FAF7F0", border: "1px solid #E8DDD0" }}>
                      <GraduationCap size={15} style={{ color: "#A08060" }} />
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#2D1811", lineHeight: 1.2, marginTop: 4 }}>
                        {studyLabel}
                      </div>
                      <div style={{ fontSize: 11, color: "#A08060" }}>学习时长</div>
                    </div>
                  </div>

                  {/* Image card — clickable */}
                  {userImage && (
                    <button
                      type="button"
                      className="group/img relative overflow-hidden rounded-xl text-left"
                      style={{ aspectRatio: "4/3", border: "1px solid #E8DDD0" }}
                      onClick={() => setLightboxOpen(0)}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="日记图片"
                        src={userImage}
                        className="transition-transform duration-200 group-hover/img:scale-[1.03]"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                      {/* Hover overlay */}
                      <div
                        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors duration-200 group-hover/img:bg-black/10"
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="opacity-0 transition-opacity duration-200 group-hover/img:opacity-80 drop-shadow-md"
                        >
                          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /><path d="M11 8v6" /><path d="M8 11h6" />
                        </svg>
                      </div>
                      {/* Multi-image badge */}
                      {allImages.length > 1 && (
                        <div
                          className="absolute bottom-2 right-2 rounded-md px-2 py-0.5 text-[11px] font-medium text-white/90"
                          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
                        >
                          1/{allImages.length}
                        </div>
                      )}
                    </button>
                  )}

                  {/* Tags */}
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs"
                          style={{ background: "rgba(45,24,17,0.06)", color: "#6B4832", border: "1px solid rgba(45,24,17,0.08)" }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Edit link */}
                  <div className="mt-auto">
                    <Link
                      href={`/journal?id=${entry.id}`}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-opacity hover:opacity-75"
                      style={{ background: "#2D1811", color: "#FAF7F0" }}
                      onClick={onClose}
                    >
                      <PencilLine size={14} />
                      编辑这篇日记
                    </Link>
                  </div>
                </div>

                {/* ── RIGHT PANE ── */}
                <div className="flex min-h-0 flex-col" style={{ background: "#FAF7F0" }}>
                  <div className="flex shrink-0 items-center justify-between px-7 pb-4 pt-6" style={{ borderBottom: "1px solid #E8DDD0" }}>
                    <div className="flex items-center gap-2.5">
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#C07A3A", flexShrink: 0 }} />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#2D1811", letterSpacing: "0.04em" }}>
                        今日记录
                      </span>
                    </div>
                    {/* Navigation counter */}
                    {entries.length > 1 && (
                      <span style={{ fontSize: 12, color: "#B89878", fontFamily: "ui-sans-serif,sans-serif" }}>
                        {currentIndex + 1} / {entries.length}
                      </span>
                    )}
                  </div>

                  <div
                    className="flex-1 overflow-y-auto px-7 py-6"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(180deg,transparent,transparent 37px,rgba(160,128,96,0.07) 37px,rgba(160,128,96,0.07) 38px)",
                      minHeight: 0,
                    }}
                  >
                    {/* ── 日记正文 ── */}
                    {entry.thoughts.trim() ? (
                      <p
                        style={{
                          fontSize: 17,
                          lineHeight: "2.18",
                          color: "rgba(45,24,17,0.90)",
                          fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif',
                          whiteSpace: "pre-wrap",
                          letterSpacing: "0.03em",
                        }}
                      >
                        {entry.thoughts.trim()}
                      </p>
                    ) : (
                      <p style={{ fontSize: 15, color: "#C0A882", fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif', lineHeight: 2 }}>
                        （这一天只留下了一段安静的空白）
                      </p>
                    )}

                    {/* ── 阅读书单 ── */}
                    {hasReadingList && (
                      <div
                        className="mt-7 rounded-xl px-4 py-4"
                        style={{ background: "rgba(250,245,237,0.7)", border: "1px solid #E8DDD0" }}
                      >
                        <p
                          className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                          style={{ color: "#B89070" }}
                        >
                          <BookOpen size={12} />
                          今日阅读
                        </p>
                        <ul className="space-y-2">
                          {legacyReading && (
                            <li className="flex items-start gap-2">
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C8A07A", marginTop: 8, flexShrink: 0 }} />
                              <span style={{ fontSize: 14, color: "rgba(45,24,17,0.80)", fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif', lineHeight: 1.8 }}>
                                {legacyReading}
                              </span>
                            </li>
                          )}
                          {readingNotes.map((note, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C8A07A", marginTop: 8, flexShrink: 0 }} />
                              <span style={{ fontSize: 14, color: "rgba(45,24,17,0.80)", fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif', lineHeight: 1.8 }}>
                                {note}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* ── 学习笔记 ── */}
                    {hasStudyNotes && (
                      <div
                        className="mt-4 rounded-xl px-4 py-4"
                        style={{ background: "rgba(245,240,250,0.6)", border: "1px solid #E0D8EC" }}
                      >
                        <p
                          className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]"
                          style={{ color: "#9078B0" }}
                        >
                          <GraduationCap size={12} />
                          今日学习
                        </p>
                        <ul className="space-y-2">
                          {studyNotes.map((note, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#9878C0", marginTop: 8, flexShrink: 0 }} />
                              <span style={{ fontSize: 14, color: "rgba(45,24,17,0.80)", fontFamily: '"Ma Shan Zheng","STKaiti","KaiTi",serif', lineHeight: 1.8 }}>
                                {note}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 px-5 py-3" style={{ borderTop: "1px solid #E8DDD0" }}>
                    {[
                      { icon: <Smile size={17} />, label: "表情" },
                      { icon: <ImagePlus size={17} />, label: "图片" },
                      { icon: <Type size={17} />, label: "样式" },
                      { icon: <MoreHorizontal size={17} />, label: "更多" },
                    ].map(({ icon, label }) => (
                      <button
                        key={label}
                        type="button"
                        aria-label={label}
                        className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/5"
                        style={{ color: "#B89070" }}
                      >
                        {icon}
                      </button>
                    ))}
                    {/* Swipe hint (mobile) */}
                    {entries.length > 1 && (
                      <span className="ml-auto text-[11px] md:hidden" style={{ color: "#C8B098" }}>
                        ← 滑动切换 →
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          </motion.div>{/* end card */}
        </div>{/* end position wrapper */}
      </div>

      {/* Image lightbox */}
      <AnimatePresence>
        {lightboxOpen !== null && allImages.length > 0 && (
          <ImageLightbox
            images={allImages}
            initialIndex={lightboxOpen}
            onClose={() => setLightboxOpen(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Portal wrapper ────────────────────────────────────────────────────────────

export function DiaryBookModalPortal({
  entries,
  entryId,
  timeEntries = [],
  onClose,
}: {
  entries: DailyLog[];
  entryId: string | null;
  timeEntries?: TimeEntry[];
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {entryId && entries.length > 0 && (
        <DiaryBookModal entries={entries} initialEntryId={entryId} timeEntries={timeEntries} onClose={onClose} />
      )}
    </AnimatePresence>
  );
}
