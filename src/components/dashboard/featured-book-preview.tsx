"use client";

import Image from "next/image";
import Link from "next/link";

import { parseISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

function getWeekdayShort(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parseISODate(value)).toUpperCase();
}

function formatTimestamp(date: string, createdAt: string) {
  const source = Number.isFinite(Date.parse(createdAt)) ? new Date(createdAt) : parseISODate(date);
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
  if (entry.tags[0]) {
    return `#${entry.tags[0]}`;
  }

  return "今日书签";
}

function getBookmarkSubline(entry: DailyLog) {
  if (entry.tags[1]) {
    return `#${entry.tags[1]}`;
  }

  return "留住这一页的心境与线索";
}

export function FeaturedBookPreview({ entry }: { entry: DailyLog }) {
  const excerpt = getExcerpt(entry.thoughts);
  const timestamp = formatTimestamp(entry.date, entry.createdAt);

  return (
    <Link className="group block" href={`/journal?id=${entry.id}`}>
      <div className="relative px-2 pb-4 pt-2 md:px-3 md:pb-5">
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-3 left-6 right-3 top-5 rounded-[32px]"
          style={{
            background: "rgba(221, 204, 180, 0.42)",
            boxShadow: "0 0 0 1px rgba(139,94,60,0.04)",
            transform: "translate(4px, 4px)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-1 left-8 right-1 top-7 rounded-[32px]"
          style={{
            background: "rgba(205, 187, 164, 0.28)",
            boxShadow: "0 0 0 1px rgba(139,94,60,0.03)",
            transform: "translate(8px, 8px)",
          }}
        />

        <div
          className="relative overflow-hidden rounded-[30px] border p-5 transition-transform duration-300 group-hover:-translate-y-0.5 md:p-6"
          style={{
            borderColor: "rgba(139,94,60,0.1)",
            background: "linear-gradient(180deg, rgba(255,252,248,0.98), rgba(248,240,227,0.98))",
            boxShadow: "0 22px 40px rgba(164, 137, 104, 0.12)",
          }}
        >
          {/* Paper grain — multi-layer noise at varying pitches */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: 0.048,
              backgroundImage: [
                "radial-gradient(circle at 12% 18%, rgba(84,59,40,0.95) 0.55px, transparent 0.75px)",
                "radial-gradient(circle at 67% 38%, rgba(84,59,40,0.8)  0.6px,  transparent 0.8px)",
                "radial-gradient(circle at 34% 72%, rgba(84,59,40,0.9)  0.5px,  transparent 0.7px)",
                "radial-gradient(circle at 89% 62%, rgba(84,59,40,0.75) 0.6px,  transparent 0.82px)",
                "radial-gradient(circle at 45% 14%, rgba(84,59,40,0.85) 0.45px, transparent 0.65px)",
                "radial-gradient(circle at 78% 85%, rgba(84,59,40,0.88) 0.55px, transparent 0.75px)",
                "radial-gradient(circle at 22% 54%, rgba(84,59,40,0.7)  0.5px,  transparent 0.7px)",
                "radial-gradient(circle at 55% 47%, rgba(84,59,40,0.82) 0.45px, transparent 0.65px)",
              ].join(", "),
              backgroundSize: "14px 14px, 21px 21px, 27px 27px, 17px 17px, 33px 33px, 19px 19px, 25px 25px, 30px 30px",
              mixBlendMode: "multiply",
            }}
          />
          {/* Horizontal paper-fibre lines */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: 0.018,
              backgroundImage: "repeating-linear-gradient(180deg, transparent 0px, transparent 3px, rgba(84,59,40,0.6) 3px, rgba(84,59,40,0.6) 3.4px)",
              mixBlendMode: "multiply",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-5 left-1/2 z-10 w-24 -translate-x-1/2 blur-xl"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(111,84,58,0.015) 18%, rgba(111,84,58,0.055) 38%, rgba(111,84,58,0.1) 50%, rgba(111,84,58,0.055) 62%, rgba(111,84,58,0.015) 82%, transparent 100%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-16 w-16"
            style={{
              background:
                "linear-gradient(135deg, transparent 0 48%, rgba(232,218,197,0.96) 53%, rgba(246,238,225,0.98) 74%, rgba(233,219,198,1) 100%)",
              clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
              filter: "drop-shadow(-8px -8px 10px rgba(113,83,55,0.12))",
            }}
          />

          <div className="grid min-h-[390px] grid-cols-1 overflow-hidden rounded-[24px] md:grid-cols-[0.92fr_1.08fr]">
            <div
              className="relative flex flex-col justify-between px-4 py-5 md:px-6 md:py-6"
              style={{
                background: "linear-gradient(180deg, rgba(255,253,249,0.98), rgba(247,239,228,0.96))",
              }}
            >
              <div>
                <div
                  className="flex items-center justify-between gap-3 border-b pb-3 text-[12px] tracking-[0.18em]"
                  style={{
                    borderColor: "rgba(139,94,60,0.1)",
                    color: "var(--m-ink3)",
                    fontFamily:
                      'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  <span>{timestamp}</span>
                  <span>{getWeekdayShort(entry.date)}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span
                    className="rounded-full px-3 py-1.5 text-[13px]"
                    style={{
                      background: "rgba(139,94,60,0.08)",
                      color: "var(--m-accent)",
                      fontFamily:
                         '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
                    }}
                  >
                    日期 {entry.date.slice(5).replace("-", ".")}
                  </span>
                  <span
                    className="rounded-full px-3 py-1.5 text-[13px]"
                    style={{
                      background: "rgba(139,94,60,0.08)",
                      color: "var(--m-ink2)",
                      fontFamily:
                        '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
                    }}
                  >
                    情绪 {entry.mood}/10
                  </span>
                  <span
                    className="rounded-full px-3 py-1.5 text-[13px]"
                    style={{
                      background: "rgba(139,94,60,0.08)",
                      color: "var(--m-ink2)",
                      fontFamily:
                        '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
                    }}
                  >
                    学习 {entry.studyHours.toFixed(1)}h
                  </span>
                </div>
              </div>

              <div className="my-5 flex flex-1 items-center justify-center">
                <div className="relative w-full max-w-[208px]">
                  <div
                    aria-hidden
                    className="absolute inset-x-6 top-3 h-6 rounded-full"
                    style={{
                      background: "rgba(218, 201, 179, 0.9)",
                      boxShadow: "0 6px 14px rgba(122,79,43,0.08)",
                      transform: "rotate(-5deg)",
                    }}
                  />
                  <div
                    aria-hidden
                    className="absolute -left-1 top-10 h-16 w-16 rounded-full blur-2xl"
                    style={{ background: "rgba(194, 164, 125, 0.2)" }}
                  />
                  <Image
                    alt="handbook illustration"
                    className="relative mx-auto h-auto w-full rotate-[-2deg] opacity-95 drop-shadow-[0_16px_28px_rgba(110,78,51,0.14)]"
                    height={240}
                    src="/illustrations/personal-notebook.svg"
                    width={240}
                  />
                </div>
              </div>

              {/* Stamp + wax-seal bookmark */}
              <div className="flex items-stretch gap-3 transition-all duration-300 hover:-translate-y-0.5">
                {/* Postage-stamp body */}
                <div
                  className="relative flex-1 px-4 py-4"
                  style={{
                    background: "linear-gradient(155deg, rgba(254,250,244,0.99) 0%, rgba(241,231,216,0.96) 100%)",
                    borderRadius: "5px",
                    border: "1px solid rgba(139,94,60,0.16)",
                    outline: "1.5px dashed rgba(139,94,60,0.22)",
                    outlineOffset: "3px",
                    boxShadow: "0 3px 10px rgba(122,79,43,0.09), inset 0 1px 0 rgba(255,255,255,0.65)",
                  }}
                >
                  {/* BOOKMARK label row */}
                  <div
                    className="flex items-center gap-1.5 text-[9px] tracking-[0.3em]"
                    style={{ color: "rgba(139,94,60,0.45)" }}
                  >
                    <svg fill="currentColor" height="9" viewBox="0 0 8 10" width="8">
                      <path d="M0 0H8V10L4 7.5L0 10V0Z" />
                    </svg>
                    BOOKMARK
                  </div>

                  {/* Main tag */}
                  <p
                    className="mt-2.5 text-[14px] font-semibold leading-snug"
                    style={{
                      color: "var(--m-ink)",
                      fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
                    }}
                  >
                    {getBookmarkText(entry)}
                  </p>

                  {/* Subline */}
                  <p
                    className="mt-1.5 text-[11px] leading-relaxed"
                    style={{ color: "rgba(139,94,60,0.60)" }}
                  >
                    {getBookmarkSubline(entry)}
                  </p>
                </div>

                {/* Wax seal — 印章 */}
                <div className="flex shrink-0 flex-col items-center justify-center gap-1">
                  <div
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
                    style={{
                      background: "radial-gradient(circle at 36% 30%, #D4A875 0%, #9B6840 48%, #6E3F1E 100%)",
                      boxShadow: "0 4px 12px rgba(122,79,43,0.42), inset 0 1.5px 3px rgba(230,180,120,0.24), inset 0 -1px 2px rgba(0,0,0,0.18)",
                    }}
                  >
                    <span
                      className="text-[11px] font-bold"
                      style={{
                        color: "rgba(255,245,228,0.92)",
                        textShadow: "0 1px 2px rgba(0,0,0,0.22)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {entry.mood}/10
                    </span>
                  </div>
                  <p
                    className="text-[9px] uppercase tracking-[0.12em]"
                    style={{ color: "rgba(139,94,60,0.38)" }}
                  >
                    mood
                  </p>
                </div>
              </div>
            </div>

            <div
              className="relative flex flex-col px-5 py-5 md:px-10 md:py-7"
              style={{
                background:
                  "linear-gradient(180deg, rgba(255,250,242,0.98), rgba(247,238,224,0.96)), repeating-linear-gradient(180deg, transparent, transparent 33px, rgba(139,94,60,0.08) 33px, rgba(139,94,60,0.08) 34px)",
              }}
            >
              <div className="relative h-full overflow-hidden">
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

                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(247,238,224,0) 0%, rgba(247,238,224,0.26) 42%, rgba(247,238,224,0.72) 72%, rgba(247,238,224,1) 100%)",
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
