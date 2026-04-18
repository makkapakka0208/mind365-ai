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
        <div className="relative overflow-hidden rounded-[40px]">
          <Image
            alt=""
            aria-hidden
            className="pointer-events-none select-none object-fill"
            fill
            src="/illustrations/book-cover-shell.svg"
          />

          <div className="relative z-10 px-[30px] pb-[30px] pt-[26px] md:px-[38px] md:pb-[38px] md:pt-[30px]">
            <div
          className="relative overflow-hidden rounded-[30px] border p-5 transition-transform duration-300 group-hover:-translate-y-0.5 md:p-6"
          style={{
            borderColor: "rgba(139,94,60,0.1)",
            background:
              "linear-gradient(180deg, rgba(255,252,248,0.985), rgba(248,240,227,0.975)), radial-gradient(circle at top left, rgba(255,255,255,0.45), transparent 36%), radial-gradient(circle at bottom right, rgba(197,169,134,0.06), transparent 32%)",
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
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(112deg, rgba(126,92,61,0.08) 0 1px, transparent 1px 8px), repeating-linear-gradient(18deg, rgba(255,255,255,0.62) 0 1px, transparent 1px 11px), radial-gradient(circle at 14% 18%, rgba(145,111,79,0.12) 0.7px, transparent 1.4px), radial-gradient(circle at 79% 68%, rgba(145,111,79,0.09) 0.7px, transparent 1.3px)",
              backgroundSize: "100% 100%, 100% 100%, 22px 22px, 28px 28px",
              mixBlendMode: "multiply",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-5 left-1/2 z-10 w-24 -translate-x-1/2 blur-xl"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(111,84,58,0.024) 14%, rgba(111,84,58,0.102) 34%, rgba(111,84,58,0.192) 50%, rgba(111,84,58,0.102) 66%, rgba(111,84,58,0.024) 86%, transparent 100%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-9 left-1/2 z-10 w-8 -translate-x-1/2"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(96,67,43,0.18) 0%, rgba(96,67,43,0.08) 34%, rgba(247,239,228,0) 76%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-6 left-1/2 z-10 w-[2px] -translate-x-1/2"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,250,241,0) 0%, rgba(255,250,241,0.38) 12%, rgba(255,250,241,0.52) 48%, rgba(255,250,241,0.38) 88%, rgba(255,250,241,0) 100%)",
              boxShadow: "0 0 6px rgba(255,248,236,0.18)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-16 w-16"
            style={{
              background:
                "linear-gradient(135deg, transparent 0 48%, rgba(232,218,197,0.96) 53%, rgba(246,238,225,0.98) 74%, rgba(233,219,198,1) 100%)",
              clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
              filter: "drop-shadow(-10px -10px 12px rgba(113,83,55,0.2))",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[6px] right-[6px] h-12 w-12"
            style={{
              background:
                "linear-gradient(135deg, transparent 0 42%, rgba(108,75,47,0.16) 62%, rgba(108,75,47,0.04) 100%)",
              clipPath: "polygon(100% 0, 0 100%, 100% 100%)",
              filter: "blur(3px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[-6px] right-[-4px] h-20 w-24"
            style={{
              background:
                "radial-gradient(ellipse at top left, rgba(102,71,45,0.24) 0%, rgba(102,71,45,0.16) 22%, rgba(102,71,45,0.08) 42%, rgba(102,71,45,0.02) 62%, rgba(102,71,45,0) 74%)",
              transform: "rotate(-10deg)",
              filter: "blur(7px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[5px] rounded-[28px]"
            style={{
              boxShadow:
                "inset 0 0 0 6px rgba(128,83,48,0.82), inset 0 0 0 7px rgba(221,193,160,0.18), inset 0 0 0 9px rgba(103,65,37,0.32)",
              backgroundImage:
                "linear-gradient(135deg, rgba(255,255,255,0.04), transparent 18%, transparent 82%, rgba(75,45,22,0.08)), repeating-linear-gradient(90deg, rgba(253,239,219,0.03) 0 2px, rgba(112,72,42,0.03) 2px 4px)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-[13px] rounded-[22px]"
            style={{
              border: "1px dashed rgba(240,217,188,0.42)",
              boxShadow:
                "inset 0 1px 0 rgba(255,245,230,0.14), 0 0 0 1px rgba(104,67,39,0.08)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[18px] right-[15px] w-[12px] rounded-r-[18px]"
            style={{
              boxShadow:
                "inset -1px 0 0 rgba(109,73,45,0.22), inset -3px 0 0 rgba(245,233,215,0.62), inset -5px 0 0 rgba(146,110,78,0.12), inset -7px 0 0 rgba(249,243,233,0.78), inset -9px 0 0 rgba(130,96,66,0.08)",
              opacity: 0.9,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[18px] left-[15px] w-[12px] rounded-l-[18px]"
            style={{
              boxShadow:
                "inset 1px 0 0 rgba(109,73,45,0.18), inset 3px 0 0 rgba(246,235,217,0.54), inset 5px 0 0 rgba(140,106,74,0.1), inset 7px 0 0 rgba(250,244,234,0.72), inset 9px 0 0 rgba(127,93,63,0.06)",
              opacity: 0.82,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[16px] left-[18px] right-[18px] h-[8px] rounded-b-[18px]"
            style={{
              boxShadow:
                "inset 0 -1px 0 rgba(111,77,50,0.16), inset 0 -3px 0 rgba(241,227,208,0.5), inset 0 -5px 0 rgba(132,97,66,0.08)",
              opacity: 0.7,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[150px] w-[20px] -translate-x-1/2 -translate-y-1/2"
          >
            <svg className="h-full w-full" fill="none" viewBox="0 0 20 150">
              <path d="M6.5 12C6.5 9.515 8.515 7.5 11 7.5C13.485 7.5 15.5 9.515 15.5 12V19C15.5 21.485 13.485 23.5 11 23.5C8.515 23.5 6.5 21.485 6.5 19V12Z" stroke="rgba(160,132,104,0.82)" strokeWidth="1.1"/>
              <path d="M5.5 48C5.5 45.515 7.515 43.5 10 43.5C12.485 43.5 14.5 45.515 14.5 48V55C14.5 57.485 12.485 59.5 10 59.5C7.515 59.5 5.5 57.485 5.5 55V48Z" stroke="rgba(160,132,104,0.74)" strokeWidth="1.1"/>
              <path d="M5.5 84C5.5 81.515 7.515 79.5 10 79.5C12.485 79.5 14.5 81.515 14.5 84V91C14.5 93.485 12.485 95.5 10 95.5C7.515 95.5 5.5 93.485 5.5 91V84Z" stroke="rgba(160,132,104,0.68)" strokeWidth="1.1"/>
              <path d="M6.5 120C6.5 117.515 8.515 115.5 11 115.5C13.485 115.5 15.5 117.515 15.5 120V127C15.5 129.485 13.485 131.5 11 131.5C8.515 131.5 6.5 129.485 6.5 127V120Z" stroke="rgba(160,132,104,0.62)" strokeWidth="1.1"/>
              <path d="M4.5 26.5H15.5" stroke="rgba(115,84,56,0.12)" strokeLinecap="round" strokeWidth="1"/>
              <path d="M4.5 62.5H15.5" stroke="rgba(115,84,56,0.11)" strokeLinecap="round" strokeWidth="1"/>
              <path d="M4.5 98.5H15.5" stroke="rgba(115,84,56,0.1)" strokeLinecap="round" strokeWidth="1"/>
            </svg>
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-[14px] left-1/2 z-20 h-4 w-10 -translate-x-1/2 rounded-t-[999px]"
            style={{
              background:
                "radial-gradient(ellipse at center bottom, rgba(105,71,45,0.2) 0%, rgba(105,71,45,0.12) 42%, rgba(247,239,228,0) 72%)",
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
                      fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
                    }}
                  >
                    日期 {entry.date.slice(5).replace("-", ".")}
                  </span>
                  <span
                    className="rounded-full px-3 py-1.5 text-[13px]"
                    style={{
                      background: "rgba(139,94,60,0.08)",
                      color: "var(--m-ink2)",
                      fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
                    }}
                  >
                    情绪 {entry.mood}/10
                  </span>
                  <span
                    className="rounded-full px-3 py-1.5 text-[13px]"
                    style={{
                      background: "rgba(139,94,60,0.08)",
                      color: "var(--m-ink2)",
                      fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", cursive',
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
                <div className="relative max-w-[300px] pr-16 pt-1">
                  <div className="relative transition-transform duration-300 group-hover:-translate-y-0.5">
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
                    className="pointer-events-none absolute bottom-[2px] right-[-2px] h-auto w-[86px] select-none opacity-68 mix-blend-multiply"
                    height={86}
                    src="/illustrations/wax-seal.svg"
                    width={86}
                  />
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
        </div>
      </div>
    </Link>
  );
}
