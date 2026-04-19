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
  return entry.tags[0] ? `#${entry.tags[0]}` : "今日书签";
}

function getBookmarkSubline(entry: DailyLog) {
  return entry.tags[1] ? `#${entry.tags[1]}` : "留住这一页的心境与线索";
}

export function FeaturedBookPreview({ entry }: { entry: DailyLog }) {
  const excerpt = getExcerpt(entry.thoughts);
  const timestamp = formatTimestamp(entry.date, entry.createdAt);

  return (
    <Link className="group block" href={`/journal?id=${entry.id}`}>
      <div className="relative px-2 pb-4 pt-2 md:px-3 md:pb-5">
        {/* 外层 SVG 手账壳（包含封面/纸张/皮边/叠层/中缝） */}
        <div className="relative overflow-hidden rounded-[40px]">
          <Image
            alt=""
            aria-hidden
            className="pointer-events-none select-none object-fill"
            fill
            src="/illustrations/book-cover-shell.svg"
          />

          {/* 内容层：完全透明，直接透出 SVG 纸张 */}
          <div className="relative z-10 px-[42px] pb-[42px] pt-[38px] md:px-[52px] md:pb-[52px] md:pt-[44px]">
            <div className="relative overflow-hidden rounded-[24px] transition-transform duration-300 group-hover:-translate-y-0.5">
              {/* 中缝分割线：极简单一层 */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-6 left-1/2 z-10 hidden w-px -translate-x-1/2 md:block"
                style={{
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(139,94,60,0.18) 50%, transparent 100%)",
                }}
              />

              <div className="grid min-h-[390px] grid-cols-1 md:grid-cols-2">

                {/* ═══ 左页 ═══ */}
                <div className="relative flex flex-col justify-between px-6 py-5 md:pl-8 md:pr-10 md:py-6">
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

                  {/* 插画 */}
                  <div className="my-5 flex flex-1 items-center justify-center">
                    <Image
                      alt="handbook illustration"
                      className="h-auto w-full max-w-[208px] rotate-[-2deg] opacity-95 drop-shadow-[0_16px_28px_rgba(110,78,51,0.14)]"
                      height={240}
                      src="/illustrations/personal-notebook.svg"
                      width={240}
                    />
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
                            <svg
                              className="opacity-80"
                              fill="currentColor"
                              height="10"
                              viewBox="0 0 8 10"
                              width="8"
                            >
                              <path d="M0 0H8V10L4 7.5L0 10V0Z" />
                            </svg>
                            BOOKMARK
                          </div>
                          <div className="mt-3">
                            <p
                              className="text-[15px] font-medium leading-tight"
                              style={{ color: "rgba(79,55,39,0.96)" }}
                            >
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

                {/* ═══ 右页：透明背景 + 横线（写字线）═══ */}
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