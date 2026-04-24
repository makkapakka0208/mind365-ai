"use client";

import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Flame,
  NotebookPen,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { FeaturedBookPreview } from "@/components/dashboard/featured-book-preview";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import {
  buildChartSeries,
  buildReadingChartSeries,
  computeSummary,
  getCurrentMonthLogs,
  getCurrentMonthQuotes,
  getCurrentWeekLogs,
  getCurrentWeekQuotes,
  parseReadingHours,
  sortLogsByDate,
} from "@/lib/analytics";
import { getTodayISODate, parseISODate, toISODate } from "@/lib/date";
import { useDailyLogsStore, useQuotesStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";

function getGreeting(date: Date) {
  const hour = date.getHours();

  if (hour < 6) return "星光静默 ";     // 原：夜深了
  if (hour < 9) return "晨曦微露 ";     // 原：早上好（偏清晨）
  if (hour < 12) return "早上好 ";    // 原：早上好（偏上午）
  if (hour < 14) return "中午好 ";    // 原：中午好
  if (hour < 18) return "下午好 ";    // 原：下午好
  if (hour < 21) return "晚上好 ";    // 原：晚上好
  return "月色入户，";
}

function getGreetingHeadline(date: Date) {
  const hour = date.getHours();

  if (hour < 6) return "夜色温柔，在静谧中听见生长的声音。"; 
  if (hour < 9) return "早上好，去执笔，去定义属于你的这一天。"; 
  if (hour < 12) return "上午好，专注当下，每一秒都在构筑未来。";
  if (hour < 14) return "中午好，给自己一个停顿，让灵魂稍作休憩。";
  if (hour < 18) return "下午好，于无声处积蓄破土的力量。";
  if (hour < 21) return "晚上好，在这一方天地，与自己重逢。";
  return "夜深了，在文字里，找到安放身心的角落。";
}

function formatHeaderDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getWeekdayShort(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(parseISODate(value)).toUpperCase();
}

function getConsecutiveStreak(logs: DailyLog[]) {
  const uniqueDates = [...new Set(sortLogsByDate(logs, "desc").map((log) => log.date))];

  if (uniqueDates.length === 0) {
    return 0;
  }

  const today = new Date();
  const todayIso = toISODate(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = toISODate(yesterday);

  if (uniqueDates[0] !== todayIso && uniqueDates[0] !== yesterdayIso) {
    return 0;
  }

  let expected = uniqueDates[0] === todayIso ? new Date(today) : yesterday;
  let streak = 0;

  for (const date of uniqueDates) {
    if (date !== toISODate(expected)) {
      break;
    }

    streak += 1;
    expected = new Date(expected);
    expected.setDate(expected.getDate() - 1);
  }

  return streak;
}

function splitThoughts(text: string) {
  const clean = text.trim().replace(/\s+/g, " ");

  if (!clean) {
    return {
      left: "今天还没有写下完整的思绪，先让这一页停在安静的留白里。",
      right: "等你下一次落笔时，这里会继续长出新的判断、感受和方向。",
    };
  }

  const midpoint = Math.ceil(clean.length / 2);

  return {
    left: clean.slice(0, midpoint),
    right: clean.slice(midpoint),
  };
}

function buildHeatmapDays(logs: DailyLog[], days = 28) {
  const counts = logs.reduce<Record<string, number>>((acc, log) => {
    acc[log.date] = (acc[log.date] ?? 0) + 1;
    return acc;
  }, {});

  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - index - 1));
    const iso = toISODate(date);
    return {
      date: iso,
      count: counts[iso] ?? 0,
    };
  });
}

function buildMoodSeries(logs: DailyLog[]) {
  const sorted = sortLogsByDate(logs, "asc");

  if (sorted.length === 0) {
    return [];
  }

  return sorted.map((log) => log.mood);
}

function HeatmapMini({ logs }: { logs: DailyLog[] }) {
  const cells = useMemo(() => buildHeatmapDays(logs), [logs]);

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {cells.map((cell) => {
        const background =
          cell.count === 0
            ? "rgba(139,94,60,0.06)"
            : cell.count === 1
              ? "rgba(165,106,67,0.3)"
              : "rgba(165,106,67,0.75)";

        return (
          <div
            className="h-5 rounded-[6px] border"
            key={cell.date}
            style={{
              background,
              borderColor: "rgba(139,94,60,0.08)",
            }}
            title={`${cell.date} · ${cell.count} 条记录`}
          />
        );
      })}
    </div>
  );
}

function MoodSparkline({ values }: { values: number[] }) {
  if (values.length === 0) {
    return (
      <div
        className="flex h-20 items-end rounded-[14px] border border-dashed px-3 py-3 text-sm"
        style={{ borderColor: "rgba(139,94,60,0.14)", color: "var(--m-ink3)" }}
      >
        本周还没有情绪轨迹，写下今天的记录后，这里会开始亮起来。
      </div>
    );
  }

  const width = 220;
  const height = 72;
  const max = 10;
  const min = 0;
  const points = values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / (max - min || 1)) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg className="h-20 w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        points={points}
        stroke="rgba(165,106,67,0.85)"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      {values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
        const y = height - ((value - min) / (max - min || 1)) * height;
        return <circle cx={x} cy={y} fill="rgba(165,106,67,1)" key={`${value}-${index}`} r="3.5" />;
      })}
    </svg>
  );
}

function ProgressRing({
  current,
  target,
  label,
}: {
  current: number;
  target: number;
  label: string;
}) {
  const progress = Math.max(0, Math.min(100, Math.round((current / target) * 100)));

  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-[76px] w-[76px] place-items-center rounded-full"
        style={{
          background: `conic-gradient(var(--m-accent) ${progress * 3.6}deg, rgba(139,94,60,0.08) 0deg)`,
        }}
      >
        <div className="grid h-[58px] w-[58px] place-items-center rounded-full bg-[var(--m-base-light)]">
          <span className="text-sm font-semibold" style={{ color: "var(--m-ink)" }}>
            {progress}%
          </span>
        </div>
      </div>

      <div>
        <div className="text-sm font-medium" style={{ color: "var(--m-ink)" }}>
          {label}
        </div>
        <div className="mt-1 text-sm" style={{ color: "var(--m-ink3)" }}>
          本周目标 {target}h
        </div>
      </div>
    </div>
  );
}

function DashboardCard({
  eyebrow,
  title,
  value,
  unit,
  description,
  icon: Icon,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  value: string;
  unit?: string;
  description: string;
  icon: typeof Flame;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="h-full p-5 md:p-6" interactive>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em]" style={{ color: "var(--m-ink3)" }}>
            {eyebrow}
          </p>
          <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
            {title}
          </h3>
        </div>

        <span
          className="flex h-10 w-10 items-center justify-center rounded-[14px]"
          style={{
            background: "rgba(139,94,60,0.08)",
            color: "var(--m-accent)",
          }}
        >
          <Icon size={18} />
        </span>
      </div>

      <div className="mt-5 flex items-end gap-1">
        <span className="text-[2.8rem] font-semibold leading-none tracking-[-0.05em]" style={{ color: "var(--m-ink)" }}>
          {value}
        </span>
        {unit ? (
          <span className="pb-1 text-sm font-medium" style={{ color: "var(--m-ink3)" }}>
            {unit}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
        {description}
      </p>

      {children ? <div className="mt-5">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </Panel>
  );
}

function BookPreview({ entry }: { entry: DailyLog }) {
  const readingHours = parseReadingHours(entry.reading);
  const thoughts = splitThoughts(entry.thoughts);

  return (
    <Link className="block" href={`/journal?id=${entry.id}`}>
      <div className="relative overflow-hidden rounded-[28px] bg-[#fbf3e7] p-4 md:p-5">
        <div className="pointer-events-none absolute inset-y-8 left-1/2 z-10 w-4 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(112,72,43,0.92),rgba(192,151,106,0.86),rgba(112,72,43,0.92))]" />
        <div className="pointer-events-none absolute inset-y-7 left-1/2 z-0 w-14 -translate-x-1/2 bg-[radial-gradient(circle,rgba(122,79,43,0.08),transparent_70%)]" />

        <div className="grid min-h-[360px] grid-cols-1 overflow-hidden rounded-[24px] border border-[rgba(139,94,60,0.12)] bg-[#fffaf1] md:grid-cols-2">
          <div
            className="relative flex flex-col justify-between px-7 py-7 md:px-8"
            style={{
              background: "linear-gradient(180deg, rgba(255,251,244,0.98), rgba(248,240,226,0.96))",
              boxShadow: "inset -12px 0 24px rgba(122,79,43,0.05)",
            }}
          >
            <div>
              <div className="text-[2.1rem] leading-none tracking-[-0.06em]" style={{ color: "var(--m-ink)" }}>
                {entry.date.slice(5).replace("-", "/")}
              </div>
              <div className="mt-2 text-xs tracking-[0.24em]" style={{ color: "var(--m-ink3)" }}>
                {getWeekdayShort(entry.date)}
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <span
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ background: "rgba(139,94,60,0.12)", color: "var(--m-accent)" }}
                >
                  情绪 {entry.mood}/10
                </span>
                <span
                  className="rounded-full px-3 py-1 text-xs"
                  style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-ink2)" }}
                >
                  学习 {entry.studyHours.toFixed(1)}h
                </span>
              </div>
            </div>

            <div className="mt-8 border-t border-dashed pt-4" style={{ borderColor: "rgba(139,94,60,0.18)" }}>
              <div className="text-[11px] tracking-[0.26em]" style={{ color: "var(--m-ink3)" }}>
                READING
              </div>
              <p className="mt-3 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                {entry.reading.trim() || "今天还没有补充阅读记录，这一页先替你留出位置。"}
              </p>
              {readingHours > 0 ? (
                <p className="mt-2 text-xs" style={{ color: "var(--m-ink3)" }}>
                  已阅读 {readingHours.toFixed(1)} 小时
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {entry.tags.slice(0, 4).map((tag) => (
                  <span
                    className="rounded-full px-3 py-1 text-xs"
                    key={`${entry.id}-${tag}`}
                    style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-ink2)" }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div
            className="relative flex flex-col px-7 py-7 md:px-8"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,250,242,0.98), rgba(247,238,224,0.96)), repeating-linear-gradient(180deg, transparent, transparent 33px, rgba(139,94,60,0.12) 33px, rgba(139,94,60,0.12) 34px)",
              boxShadow: "inset 12px 0 24px rgba(122,79,43,0.05)",
             
            }}
          >
            <div>
              <div className="text-[11px] tracking-[0.28em]" style={{ color: "var(--m-ink3)" }}>
                JOURNAL
              </div>
              <p className="mt-4 text-[15px] leading-8 md:text-base" style={{ color: "rgba(71,49,35,0.92)" }}>
                {thoughts.left}
              </p>

              <div className="mt-8 text-[11px] tracking-[0.28em]" style={{ color: "var(--m-ink3)" }}>
                CONTINUED
              </div>
              <p className="mt-4 text-[15px] leading-8 md:text-base" style={{ color: "rgba(71,49,35,0.92)" }}>
                {thoughts.right || "这一页保留一点空白，给下一次翻阅时的你。"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

const SERIF = '"Noto Serif SC", "Songti SC", serif';

function useYearProgress() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 5, 0);
    const ms = tomorrow.getTime() - Date.now();
    const t = setTimeout(() => setNow(new Date()), Math.max(1000, ms));
    return () => clearTimeout(t);
  }, [now]);
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const nextStart = new Date(year + 1, 0, 1);
  const DAY = 86400000;
  const daysInYear = Math.round((nextStart.getTime() - start.getTime()) / DAY);
  const daysPassed = Math.max(0, Math.min(daysInYear, Math.floor((now.getTime() - start.getTime()) / DAY) + 1));
  const daysRemaining = Math.max(0, daysInYear - daysPassed);
  const pct = Math.round((daysPassed / daysInYear) * 100);
  return { year, daysPassed, daysRemaining, pct };
}

function MobileYearWidget() {
  const { year, daysPassed, daysRemaining, pct } = useYearProgress();

  // Arc: semicircle left→top→right, dot at pct position
  const cx = 52, cy = 52, r = 38;
  const angleDeg = 180 + (pct / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotX = cx + r * Math.cos(angleRad);
  const dotY = cy + r * Math.sin(angleRad);
  const lx = cx - r, ly = cy, rx = cx + r, ry = cy;
  const largeArc = pct > 50 ? 1 : 0;

  return (
    <div
      className="rounded-[24px] p-5"
      style={{
        background: "linear-gradient(180deg, rgba(255,250,242,0.96), rgba(240,230,211,0.88))",
        border: "1px solid rgba(139,94,60,0.1)",
        boxShadow: "0 8px 24px rgba(180,150,110,0.12)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: numbers */}
        <div className="flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[2.2rem] font-semibold leading-none tracking-tight" style={{ color: "var(--m-ink)", fontFamily: SERIF }}>
              {year}
            </span>
            <span className="text-sm" style={{ color: "var(--m-ink3)" }}>年</span>
          </div>
          <div className="mt-3 flex items-center gap-4">
            <div>
              <span className="block text-xl font-semibold" style={{ color: "var(--m-accent)", fontFamily: SERIF }}>{daysPassed}</span>
              <span className="mt-0.5 block text-[11px]" style={{ color: "var(--m-ink3)" }}>天已过</span>
            </div>
            <div className="h-6 w-px" style={{ background: "rgba(139,94,60,0.14)" }} />
            <div>
              <span className="block text-xl font-light" style={{ color: "var(--m-ink)", fontFamily: SERIF }}>{daysRemaining}</span>
              <span className="mt-0.5 block text-[11px]" style={{ color: "var(--m-ink3)" }}>天未至</span>
            </div>
          </div>
        </div>

        {/* Right: arc SVG */}
        <svg aria-hidden fill="none" style={{ width: 88, flexShrink: 0 }} viewBox="8 12 88 46" xmlns="http://www.w3.org/2000/svg">
          <path d={`M ${lx},${ly} A ${r},${r} 0 0 0 ${rx},${ry}`}
            stroke="rgba(139,94,60,0.12)" strokeLinecap="round" strokeWidth="2.5" />
          {pct > 1 && (
            <path d={`M ${lx},${ly} A ${r},${r} 0 ${largeArc} 0 ${dotX},${dotY}`}
              stroke="rgba(139,94,60,0.5)" strokeLinecap="round" strokeWidth="2.5" />
          )}
          <circle cx={dotX} cy={dotY} fill="var(--m-accent)" opacity="0.8" r="5" />
          <circle cx={dotX} cy={dotY} fill="rgba(255,250,242,0.9)" r="2.2" />
          <text dominantBaseline="middle" fill="rgba(139,94,60,0.45)" fontFamily="system-ui"
            fontSize="10" textAnchor="middle" x={cx} y={cy - r + 16}>{pct}%</text>
        </svg>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="h-px w-full overflow-hidden" style={{ background: "rgba(139,94,60,0.1)" }}>
          <div className="h-full transition-all duration-1000"
            style={{ width: `${pct}%`, background: "rgba(139,94,60,0.5)" }} />
        </div>
        <div className="mt-1.5 flex justify-between">
          <span className="text-[10px]" style={{ color: "rgba(139,94,60,0.4)" }}>1 月</span>
          <span className="text-[10px]" style={{ color: "rgba(139,94,60,0.4)" }}>已走完 {pct}%</span>
          <span className="text-[10px]" style={{ color: "rgba(139,94,60,0.4)" }}>12 月</span>
        </div>
      </div>

      {/* Link */}
      <div className="mt-4 border-t border-dashed pt-3" style={{ borderColor: "rgba(139,94,60,0.1)" }}>
        <Link className="text-xs" href="/timeline" style={{ color: "var(--m-accent)" }}>
          翻开旧日记忆 →
        </Link>
      </div>
    </div>
  );
}

export default function HomePage() {
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();
  const [now, setNow] = useState(() => new Date());
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const recentLogs = useMemo(() => sortLogsByDate(logs, "desc").slice(0, 6), [logs]);
  const monthLogs = useMemo(() => sortLogsByDate(getCurrentMonthLogs(logs), "desc"), [logs]);
  const monthQuotes = useMemo(() => getCurrentMonthQuotes(quotes), [quotes]);
  const todayLog = useMemo(() => recentLogs.find((log) => log.date === getTodayISODate()) ?? null, [recentLogs]);
  const weeklyLogs = useMemo(() => getCurrentWeekLogs(logs), [logs]);
  const weeklyQuotes = useMemo(() => getCurrentWeekQuotes(quotes), [quotes]);
  const weeklySummary = useMemo(() => computeSummary(weeklyLogs, weeklyQuotes), [weeklyLogs, weeklyQuotes]);
  const monthlySummary = useMemo(() => computeSummary(monthLogs, monthQuotes), [monthLogs, monthQuotes]);
  const streak = useMemo(() => getConsecutiveStreak(logs), [logs]);
  const moodSeries = useMemo(() => buildMoodSeries(weeklyLogs), [weeklyLogs]);
  const moodTrendSeries = useMemo(() => buildChartSeries(logs, (log) => log.mood), [logs]);
  const studyTrendSeries = useMemo(() => buildChartSeries(logs, (log) => log.studyHours), [logs]);
  const readingTrendSeries = useMemo(() => buildReadingChartSeries(logs, quotes), [logs, quotes]);
  const safeIndex = recentLogs.length === 0 ? 0 : Math.min(activeIndex, recentLogs.length - 1);
  const activeEntry = recentLogs[safeIndex] ?? null;

  useEffect(() => {
    if (recentLogs.length === 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex > recentLogs.length - 1) {
      setActiveIndex(0);
    }
  }, [activeIndex, recentLogs.length]);

  const turnPage = (direction: "prev" | "next") => {
    if (recentLogs.length <= 1) {
      return;
    }

    setActiveIndex((current) => {
      if (direction === "prev") {
        return current === 0 ? recentLogs.length - 1 : current - 1;
      }

      return current === recentLogs.length - 1 ? 0 : current + 1;
    });
  };

  return (
    <PageTransition>
      <div className="w-full">
        <section className="md:hidden">
          <div
            className="rounded-[34px] px-4 py-5 sm:px-6"
            style={{
              background: "linear-gradient(180deg, rgba(253,246,235,0.98), rgba(240,230,211,0.94))",
              border: "1px solid var(--m-rule)",
              boxShadow: "0 24px 60px rgba(180,150,110,0.18)",
            }}
          >
            <div className="flex items-center justify-between">
              <div className="text-[2rem] font-semibold leading-none" style={{ color: "var(--m-ink)" }}>
                {formatClock(now)}
              </div>
              <div className="flex items-center gap-3">
                <Link
                  className="flex h-12 w-12 items-center justify-center rounded-[16px]"
                  href="/library"
                  style={{
                    background: "rgba(255,248,238,0.9)",
                    border: "1px solid rgba(139,94,60,0.12)",
                    boxShadow: "var(--m-shadow-out)",
                  }}
                >
                  <BookOpen size={18} style={{ color: "var(--m-accent)" }} />
                </Link>
                <Link
                  className="flex h-12 w-12 items-center justify-center rounded-[16px]"
                  href="/review"
                  style={{
                    background: "rgba(255,248,238,0.9)",
                    border: "1px solid rgba(139,94,60,0.12)",
                    boxShadow: "var(--m-shadow-out)",
                  }}
                >
                  <Sparkles size={18} style={{ color: "var(--m-accent)" }} />
                </Link>
              </div>
            </div>

            <div className="mt-3 text-[15px]" style={{ color: "var(--m-ink3)" }}>
              {formatHeaderDate(now)}
            </div>

            <div className="mt-3 text-[2.35rem] leading-none tracking-[-0.06em]" style={{ color: "var(--m-ink)" }}>
              {getGreeting(now)}
            </div>

            <Link
              className="mt-6 block rounded-[24px] border px-5 py-4"
              href="/record"
              style={{
                background: "rgba(246,233,212,0.82)",
                borderColor: "rgba(139,94,60,0.14)",
                boxShadow: "0 18px 35px rgba(180,150,110,0.16)",
              }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
                  style={{ background: "rgba(255,248,238,0.8)", color: "var(--m-accent)" }}
                >
                  <NotebookPen size={20} />
                </span>
                <div>
                  <div className="text-[1.35rem] font-semibold" style={{ color: "var(--m-ink)" }}>
                    {todayLog ? "今天已经记录" : "今日还未记录"}
                  </div>
                  <div className="mt-1 text-sm" style={{ color: "var(--m-ink2)" }}>
                    {todayLog ? "补充一点细节，AI 会继续帮你整理。" : "写点什么，AI 来帮你整理。"}
                  </div>
                </div>
              </div>
            </Link>

            <div className="mt-5 flex items-center gap-2" style={{ color: "var(--m-accent)" }}>
              <Flame size={18} />
              <span className="text-sm sm:text-base">已连续记录 {streak} 天</span>
            </div>

            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold tracking-[0.12em]" style={{ color: "var(--m-ink2)" }}>
                  时间摆
                </div>
                <Link className="text-xs" href="/timeline" style={{ color: "var(--m-ink3)" }}>
                  去年今日 →
                </Link>
              </div>
              <MobileYearWidget />
            </div>
          </div>

          {/* 4 stat cards — mirrors the desktop dashboard row, stacked 2×2 on mobile */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <DashboardCard
              action={
                streak === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    从今天开始点亮热力图
                  </Link>
                ) : null
              }
              description="日子被点亮的瞬间，都藏在这些深浅不一的色块里。"
              eyebrow="STREAK"
              icon={Flame}
              title="连续记录"
              unit="天"
              value={String(streak)}
            >
              <HeatmapMini logs={logs} />
            </DashboardCard>

            <DashboardCard
              action={
                weeklySummary.entries === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    写下今天的情绪切片
                  </Link>
                ) : null
              }
              description="感知心里的天气。无论晴雨，每一个瞬间的感受都值得被珍藏。"
              eyebrow="MOOD"
              icon={Sparkles}
              title="本周情绪"
              unit="/10"
              value={weeklySummary.entries ? weeklySummary.averageMood.toFixed(1) : "--"}
            >
              <MoodSparkline values={moodSeries} />
            </DashboardCard>

            <DashboardCard
              action={
                weeklySummary.totalStudyHours === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    给今天记一点学习时间
                  </Link>
                ) : null
              }
              description="推开外界的嘈杂，在方寸之间，找回掌控生活的主动权。"
              eyebrow="FOCUS"
              icon={NotebookPen}
              title="学习时长"
              unit="h"
              value={weeklySummary.totalStudyHours.toFixed(1)}
            >
              <ProgressRing current={weeklySummary.totalStudyHours} label="专注进度" target={10} />
            </DashboardCard>

            <DashboardCard
              action={
                weeklySummary.totalReadingHours === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    记录一次阅读片刻
                  </Link>
                ) : null
              }
              description="哪怕只是片刻的沉浸，也能在灵魂深处唤醒新的共鸣。"
              eyebrow="READING"
              icon={BookOpen}
              title="阅读时长"
              unit="h"
              value={weeklySummary.totalReadingHours.toFixed(1)}
            >
              <ProgressRing current={weeklySummary.totalReadingHours} label="阅读进度" target={7} />
            </DashboardCard>
          </div>
        </section>

        <section className="hidden md:block space-y-6">
          <Panel className="px-8 py-8 lg:px-10">
            <div className="flex flex-wrap items-start justify-between gap-6 border-b border-dashed pb-6" style={{ borderColor: "rgba(139,94,60,0.12)" }}>
              <div className="max-w-4xl">
                <p className="text-xs font-medium tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  DAILY SYSTEM · {formatHeaderDate(now)}
                </p>
                <h1 className="mt-3 text-[2rem] font-semibold leading-tight tracking-[-0.05em]" style={{ color: "var(--m-ink)" }}>
                  {getGreetingHeadline(now)}
                </h1>
                <p className="mt-4 max-w-3xl text-[15px] leading-8" style={{ color: "var(--m-ink2)" }}>
                  愿你在喧嚣之外，拥有一片自由呼吸的自留地。
                </p>
              </div>

              <div
                className="flex h-14 w-14 items-center justify-center rounded-[16px]"
                style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
              >
                <TrendingUp size={22} />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/record">
                <Button size="lg" variant="primary">
                  写一条新记录
                </Button>
              </Link>
              <Link href="/review">
                <Button size="lg" variant="ghost">
                  进入周 / 月复盘
                </Button>
              </Link>
              <Link href="/timeline">
                <Button size="lg" variant="ghost">
                  浏览所有日记
                </Button>
              </Link>

              <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-full border px-3 py-2" style={{ borderColor: "rgba(139,94,60,0.12)", color: "var(--m-ink2)" }}>
                  本周 {weeklySummary.entries} 条记录
                </span>
                <span className="rounded-full border px-3 py-2" style={{ borderColor: "rgba(139,94,60,0.12)", color: "var(--m-ink2)" }}>
                  本月 {monthlySummary.entries} 条沉淀
                </span>
              </div>
            </div>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4 xl:gap-6">
            <DashboardCard
              action={
                streak === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    从今天开始点亮热力图
                  </Link>
                ) : null
              }
              description="日子被点亮的瞬间，都藏在这些深浅不一的色块里。"
              eyebrow="STREAK"
              icon={Flame}
              title="连续记录"
              unit="天"
              value={String(streak)}
            >
              <HeatmapMini logs={logs} />
            </DashboardCard>

            <DashboardCard
              action={
                weeklySummary.entries === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    写下今天的情绪切片
                  </Link>
                ) : null
              }
              description="感知心里的天气。无论晴雨，每一个瞬间的感受都值得被珍藏。"
              eyebrow="MOOD"
              icon={Sparkles}
              title="本周情绪"
              unit="/10"
              value={weeklySummary.entries ? weeklySummary.averageMood.toFixed(1) : "--"}
            >
              <MoodSparkline values={moodSeries} />
            </DashboardCard>

            <DashboardCard
              action={
                weeklySummary.totalStudyHours === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    给今天记一点学习时间
                  </Link>
                ) : null
              }
              description="推开外界的嘈杂，在方寸之间，找回掌控生活的主动权。"
              eyebrow="FOCUS"
              icon={NotebookPen}
              title="学习时长"
              unit="h"
              value={weeklySummary.totalStudyHours.toFixed(1)}
            >
              <ProgressRing current={weeklySummary.totalStudyHours} label="专注进度" target={10} />
            </DashboardCard>

            <DashboardCard
              action={
                weeklySummary.totalReadingHours === 0 ? (
                  <Link className="text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    记录一次阅读片刻
                  </Link>
                ) : null
              }
              description="哪怕只是片刻的沉浸，也能在灵魂深处唤醒新的共鸣。"
              eyebrow="READING"
              icon={BookOpen}
              title="阅读时长"
              unit="h"
              value={weeklySummary.totalReadingHours.toFixed(1)}
            >
              <ProgressRing current={weeklySummary.totalReadingHours} label="阅读进度" target={7} />
            </DashboardCard>
          </div>

          <Panel className="p-7 lg:p-8">
            <div className="flex items-center justify-between border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.12)" }}>
              <div>
                <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  FEATURED · 书页摘录
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">精选记录</h3>
              </div>

              {recentLogs.length > 1 ? (
                <div className="hidden items-center gap-2">
                  <button
                    aria-label="上一页"
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] border"
                    onClick={() => turnPage("prev")}
                    style={{
                      background: "var(--m-base-light)",
                      borderColor: "rgba(139,94,60,0.12)",
                      color: "var(--m-accent)",
                    }}
                    type="button"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button
                    aria-label="下一页"
                    className="flex h-10 w-10 items-center justify-center rounded-[14px] border"
                    onClick={() => turnPage("next")}
                    style={{
                      background: "var(--m-base-light)",
                      borderColor: "rgba(139,94,60,0.12)",
                      color: "var(--m-accent)",
                    }}
                    type="button"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              {activeEntry ? (
                <>
                  <FeaturedBookPreview entry={activeEntry} />
                  <div className="mt-5 flex items-center justify-between gap-4 px-3">
                    <div
                      className="text-sm tracking-[0.28em]"
                      style={{
                        color: "var(--m-ink2)",
                        fontFamily: '"Playfair Display", "Noto Serif SC", serif',
                      }}
                    >
                      {String(safeIndex + 1).padStart(2, "0")} / {String(recentLogs.length).padStart(2, "0")}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        aria-label="上一页"
                        className="flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={recentLogs.length <= 1}
                        onClick={() => turnPage("prev")}
                        style={{
                          background: "rgba(255,248,238,0.78)",
                          borderColor: "rgba(139,94,60,0.12)",
                          color: "var(--m-accent)",
                        }}
                        type="button"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        aria-label="下一页"
                        className="flex h-9 w-9 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={recentLogs.length <= 1}
                        onClick={() => turnPage("next")}
                        style={{
                          background: "rgba(255,248,238,0.78)",
                          borderColor: "rgba(139,94,60,0.12)",
                          color: "var(--m-accent)",
                        }}
                        type="button"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-[22px] border border-dashed px-6 py-10 text-center" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
                  <p className="text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                    还没有可以展示的精选记录。
                  </p>
                  <Link className="mt-4 inline-flex text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                    去写今天的第一条记录
                  </Link>
                </div>
              )}
            </div>
          </Panel>

          <Panel className="p-7 lg:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.12)" }}>
              <div className="max-w-3xl">
                <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  TRENDS · 长期趋势
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
                  长期趋势概览
                </h3>
                <p className="mt-3 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  将情绪波动、专注投入与阅读节奏整合为连续曲线，帮助你在时间跨度中发现规律、识别转折，看见真实的成长轨迹。
                </p>
              </div>

              <div className="rounded-full border px-4 py-2 text-sm" style={{ borderColor: "rgba(139,94,60,0.12)", color: "var(--m-ink2)" }}>
                累计 {logs.length} 条记录
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="mt-6 rounded-[22px] border border-dashed px-6 py-10 text-center" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
                <p className="text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  先连续记录几天，成长概览里的长期趋势图就会自动长出来。
                </p>
                <Link className="mt-4 inline-flex text-sm font-medium" href="/record" style={{ color: "var(--m-accent)" }}>
                  去写今天的记录
                </Link>
              </div>
            ) : (
              <div className="mt-6 space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <LineChartCard
                    data={moodTrendSeries.data}
                    datasetLabel="情绪"
                    description="把每天的心情连成一条线，更容易看见起伏和回稳。"
                    labels={moodTrendSeries.labels}
                    title="情绪趋势"
                  />
                  <BarChartCard
                    data={studyTrendSeries.data}
                    datasetLabel="学习"
                    description="观察每一段专注投入是怎样累积起来的。"
                    labels={studyTrendSeries.labels}
                    title="学习时长趋势"
                  />
                </div>

                <LineChartCard
                  data={readingTrendSeries.data}
                  datasetLabel="阅读"
                  description="把阅读习惯留在成长概览里，方便一起对照你的长期节奏。"
                  labels={readingTrendSeries.labels}
                  title="阅读趋势"
                />
              </div>
            )}
          </Panel>
        </section>
      </div>
    </PageTransition>
  );
}
