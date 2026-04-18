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
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.028]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 18% 24%, rgba(84,59,40,0.9) 0.7px, transparent 0.9px), radial-gradient(circle at 74% 32%, rgba(84,59,40,0.78) 0.7px, transparent 0.95px), radial-gradient(circle at 36% 74%, rgba(84,59,40,0.85) 0.65px, transparent 0.9px)",
              backgroundSize: "18px 18px, 24px 24px, 30px 30px",
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

              <div className="flex justify-start">
  <div
    className="relative max-w-[240px] overflow-hidden rounded-[20px] border px-5 py-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
    style={{
      borderColor: "rgba(139,94,60,0.12)",
      // 微微的暖色纸张渐变
      background: "linear-gradient(135deg, rgba(253,250,245,0.95) 0%, rgba(240,235,225,0.85) 100%)",
      // 增加白色内发光，模拟厚纸板的边缘光泽
      boxShadow: "0 10px 24px rgba(122,79,43,0.06), inset 0 2px 0 rgba(255,255,255,0.7)",
    }}
  >
  

    <div className="flex items-center gap-1.5 text-[10px] tracking-[0.28em]" style={{ color: "rgba(139,94,60,0.6)" }}>
      {/* 纯代码画的一个迷你书签丝带小图标，增加精致感 */}
      <svg width="8" height="10" viewBox="0 0 8 10" fill="currentColor" className="opacity-80">
        <path d="M0 0H8V10L4 7.5L0 10V0Z" />
      </svg>
      BOOKMARK
    </div>

    <div className="mt-3.5">
      <p 
        className="text-[15px] font-medium leading-tight" 
        style={{ color: "var(--m-ink)" }}
      >
        {getBookmarkText(entry)}
      </p>
      
      <p 
        className="mt-2 text-[12.5px] leading-relaxed tracking-wide" 
        style={{ color: "rgba(139,94,60,0.65)" }}
      >
        {getBookmarkSubline(entry)}
      </p>
    </div>
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
