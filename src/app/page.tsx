"use client";

import {
  BookOpen,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Flame,
  NotebookPen,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { CombinedTrendChart } from "@/components/charts/combined-trend-chart";
import { DiaryBookModalPortal, FeaturedBookPreview } from "@/components/dashboard/featured-book-preview";
import { TimePendulum } from "@/components/dashboard/time-pendulum";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import {
  computeSummary,
  getCurrentMonthLogs,
  getCurrentMonthQuotes,
  getCurrentMonthTimeEntries,
  getCurrentWeekLogs,
  getCurrentWeekQuotes,
  getCurrentWeekTimeEntries,
  parseReadingHours,
  sortLogsByDate,
} from "@/lib/analytics";
import { getTodayISODate, parseISODate, toISODate } from "@/lib/date";
import {
  getAllTimeBestStreak,
  getFocusInsight,
  getMonthEndPrompt,
  getMoodInsight,
  getReadingInsight,
  getReviewBadge,
  getStreakInsight,
} from "@/lib/home-insights";
import { saveTimeEntry } from "@/lib/storage";
import { useDailyLogsStore, useQuotesStore, useTimeEntriesStore } from "@/lib/storage-store";
import type { DailyLog, Quote, TimeEntry } from "@/types";
import type { LucideIcon } from "lucide-react";

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

function TimeEntryDialog({
  type,
  onClose,
}: {
  type: TimeEntry["type"];
  onClose: () => void;
}) {
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const title = type === "study" ? "给今天记一点学习时间" : "记录一次阅读片刻";

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number(hours);
    if (!Number.isFinite(value) || value <= 0) return;
    void saveTimeEntry({
      date: getTodayISODate(),
      type,
      hours: value,
      note,
    });
    onClose();
  };

  return (
    <Dialog onClose={onClose} open title={title}>
      <form className="grid gap-4" onSubmit={onSubmit}>
        <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
          时长
          <Input
            autoFocus
            min={0}
            onChange={(event) => setHours(event.target.value)}
            placeholder="0.5"
            step={0.5}
            type="number"
            value={hours}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
          一句话备注
          <Input
            onChange={(event) => setNote(event.target.value)}
            placeholder={type === "study" ? "今天学了什么？" : "今天读到了什么？"}
            type="text"
            value={note}
          />
        </label>
        <div className="flex items-center justify-end gap-3">
          <Button onClick={onClose} type="button" variant="ghost">
            取消
          </Button>
          <Button disabled={!Number.isFinite(Number(hours)) || Number(hours) <= 0} type="submit" variant="primary">
            写下来
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function TimeTextButton({
  done,
  children,
  onClick,
}: {
  done: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className="text-left text-sm font-medium transition-opacity hover:opacity-75"
      onClick={onClick}
      style={{ color: done ? "var(--m-ink3)" : "var(--m-accent)" }}
      type="button"
    >
      {done ? "今日已达标" : children}
    </button>
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

        {/* Right: vintage clock + pendulum */}
        <div className="shrink-0" style={{ width: 92 }}>
          <TimePendulum />
        </div>
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

/* ── v5 helpers ────────────────────────────────────────────────────── */

function getDailyQuote(quotes: Quote[]): Quote | null {
  if (quotes.length === 0) return null;
  const today = parseISODate(getTodayISODate());
  const startOfYear = new Date(today.getFullYear(), 0, 0);
  const dayNumber = Math.floor((today.getTime() - startOfYear.getTime()) / 86400000);
  return quotes[dayNumber % quotes.length] ?? null;
}

function formatShortDate(date: Date) {
  return `${date.getMonth() + 1}/${String(date.getDate()).padStart(2, "0")}`;
}

/* ── v5 KPI card ───────────────────────────────────────────────────── */

interface V5KpiCardProps {
  eyebrow: string;
  title: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  description: string;
  footerAction?: { label: string; href?: string; onClick?: () => void };
  children?: React.ReactNode;
}

function V5KpiCard({ eyebrow, title, value, unit, icon: Icon, description, footerAction, children }: V5KpiCardProps) {
  const [hov, setHov] = useState(false);
  const accent = "var(--v5-accent)";
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "var(--v5-card)",
        border: "1px solid var(--v5-rule)",
        borderRadius: "var(--v5-r-lg)",
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        boxShadow: hov ? "var(--v5-sh-hover)" : "var(--v5-sh-2)",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        transition: "transform var(--v5-dur) var(--v5-ease-out), box-shadow var(--v5-dur) var(--v5-ease-out)",
      }}
    >
      {/* accent corner glow */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          width: 96,
          height: 96,
          background: `radial-gradient(circle at top right, rgba(139,94,60,0.13) 0%, transparent 70%)`,
          opacity: hov ? 1 : 0.6,
          transition: "opacity var(--v5-dur) var(--v5-ease)",
          pointerEvents: "none",
        }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="v5-eyebrow" style={{ marginBottom: 6 }}>{eyebrow}</div>
          <div
            style={{
              fontSize: 16,
              fontFamily: "var(--v5-serif)",
              fontWeight: 500,
              color: "var(--v5-ink)",
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </div>
        </div>
        <span
          className="grid place-items-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(139,94,60,0.10)",
            color: accent,
            transform: hov ? "scale(1.08) rotate(-4deg)" : "scale(1) rotate(0)",
            transition: "transform var(--v5-dur) var(--v5-ease-spring)",
          }}
        >
          <Icon size={16} />
        </span>
      </div>

      <div className="flex items-baseline" style={{ gap: 6 }}>
        <span
          className="v5-numeral"
          style={{
            fontSize: 48,
            fontVariationSettings: '"opsz" 144, "wght" 400',
            color: "var(--v5-ink)",
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              paddingBottom: 6,
              fontSize: 14,
              fontFamily: "var(--v5-sans)",
              color: "var(--v5-ink3)",
            }}
          >
            {unit}
          </span>
        )}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontFamily: "var(--v5-sans)",
          lineHeight: 1.65,
          color: "var(--v5-ink2)",
        }}
      >
        {description}
      </p>

      {children && (
        <div
          style={{
            marginTop: "auto",
            transform: hov ? "translateY(-2px)" : "translateY(0)",
            transition: "transform var(--v5-dur) var(--v5-ease-out)",
          }}
        >
          {children}
        </div>
      )}

      {footerAction &&
        (footerAction.href ? (
          <Link
            className="inline-flex items-center self-start"
            href={footerAction.href}
            style={{
              gap: hov ? 8 : 4,
              fontFamily: "var(--v5-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: accent,
              transition: "gap var(--v5-dur) var(--v5-ease)",
            }}
          >
            {footerAction.label} <span style={{ fontSize: 14 }}>→</span>
          </Link>
        ) : (
          <button
            className="inline-flex items-center self-start border-0 bg-transparent p-0"
            onClick={footerAction.onClick}
            type="button"
            style={{
              gap: hov ? 8 : 4,
              fontFamily: "var(--v5-sans)",
              fontSize: 13,
              fontWeight: 500,
              color: accent,
              cursor: "pointer",
              transition: "gap var(--v5-dur) var(--v5-ease)",
            }}
          >
            {footerAction.label} <span style={{ fontSize: 14 }}>→</span>
          </button>
        ))}
    </div>
  );
}

/* ── v5 Hero panel ─────────────────────────────────────────────────── */

interface V5HeroPanelProps {
  now: Date;
  greeting: string;
  weekEntries: number;
  monthEntries: number;
  avgMood: number;
  hasMood: boolean;
  reviewBadge: string | null;
  dailyQuote: Quote | null;
}

function V5HeroPanel({ now, greeting, weekEntries, monthEntries, avgMood, hasMood, reviewBadge, dailyQuote }: V5HeroPanelProps) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 32,
        padding: "44px 48px",
        background: "linear-gradient(135deg, #fff 0%, #fef7e8 50%, #f6e5c8 100%)",
        boxShadow: "var(--v5-sh-3)",
      }}
    >
      {/* breathing decoration */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{ right: -180, top: "50%", transform: "translateY(-50%)", width: 540, height: 540, opacity: 0.35 }}
      >
        <svg viewBox="0 0 480 480" width="100%" height="100%">
          <defs>
            <radialGradient cx="50%" cy="50%" id="v5-hero-rg" r="50%">
              <stop offset="0%" stopColor="#e8a87c" stopOpacity="0.42" />
              <stop offset="60%" stopColor="#e8a87c" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#e8a87c" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="240" cy="240" fill="url(#v5-hero-rg)" r="240">
            <animate attributeName="r" dur="6s" repeatCount="indefinite" values="240;260;240" />
            <animate attributeName="opacity" dur="6s" repeatCount="indefinite" values="1;0.7;1" />
          </circle>
          <circle cx="240" cy="240" fill="#fff" opacity="0.4" r="160">
            <animate attributeName="r" dur="6s" repeatCount="indefinite" values="160;180;160" />
          </circle>
        </svg>
      </div>

      <div
        className="relative grid items-center"
        style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 48 }}
      >
        {/* LEFT */}
        <div>
          <div className="v5-eyebrow" style={{ marginBottom: 16 }}>
            DAILY SYSTEM · {now.getMonth() + 1}月{now.getDate()}日 星期{"日一二三四五六"[now.getDay()]}
          </div>
          <h1
            className="v5-display"
            style={{
              margin: 0,
              fontSize: "clamp(40px, 4.4vw, 56px)",
              fontVariationSettings: '"opsz" 144, "SOFT" 80',
              fontWeight: 400,
              color: "var(--v5-ink)",
            }}
          >
            {greeting}，
          </h1>
          <p
            style={{
              margin: "24px 0 0",
              fontFamily: "var(--v5-serif)",
              fontVariationSettings: '"opsz" 14',
              fontSize: 16,
              lineHeight: 1.7,
              color: "var(--v5-ink2)",
              fontStyle: "italic",
              maxWidth: 480,
            }}
          >
            愿你在喧嚣之外，拥有一片自由呼吸的自留地。
          </p>

          <div className="mt-9 flex flex-wrap" style={{ gap: 12 }}>
            <Link
              className="inline-flex items-center justify-center"
              href="/daily-log"
              style={{
                fontFamily: "var(--v5-sans)",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 22px",
                borderRadius: 999,
                background: "var(--v5-ink)",
                color: "#fff",
                boxShadow: "0 4px 12px rgba(33,22,17,0.18)",
                transition: "transform var(--v5-dur) var(--v5-ease), background var(--v5-dur) var(--v5-ease)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.background = "var(--v5-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.background = "var(--v5-ink)";
              }}
            >
              写一条新记录
            </Link>
            <Link
              className="inline-flex items-center"
              href="/review"
              style={{
                fontFamily: "var(--v5-sans)",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 22px",
                borderRadius: 999,
                border: "1px solid var(--v5-rule-strong)",
                background: "transparent",
                color: "var(--v5-ink2)",
                gap: 8,
                transition: "background var(--v5-dur) var(--v5-ease)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(75,51,27,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              进入周 / 月复盘
              {reviewBadge && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
                  style={{ background: "#C0392B", color: "#fff", fontSize: 10, fontWeight: 600 }}
                >
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
                  {reviewBadge}
                </span>
              )}
            </Link>
            <Link
              href="/week-plan"
              style={{
                fontFamily: "var(--v5-sans)",
                fontSize: 14,
                fontWeight: 500,
                padding: "12px 22px",
                borderRadius: 999,
                background: "transparent",
                color: "var(--v5-ink2)",
                transition: "background var(--v5-dur) var(--v5-ease)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(75,51,27,0.06)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              本周主线
            </Link>
          </div>

          {/* Inline stats */}
          <div className="mt-7 flex" style={{ gap: 32, fontFamily: "var(--v5-sans)" }}>
            {[
              { label: "This week", value: String(weekEntries), unit: "篇" },
              { label: "This month", value: String(monthEntries), unit: "篇" },
              { label: "Avg mood", value: hasMood ? avgMood.toFixed(1) : "--", unit: "/ 10" },
            ].map((stat, i) => (
              <div className="flex items-stretch" key={stat.label} style={{ gap: 32 }}>
                {i > 0 && <div style={{ width: 1, background: "var(--v5-rule)" }} />}
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      color: "var(--v5-ink3)",
                      textTransform: "uppercase",
                    }}
                  >
                    {stat.label}
                  </div>
                  <div
                    className="v5-numeral mt-1"
                    style={{ fontSize: 26, color: "var(--v5-ink)" }}
                  >
                    {stat.value}{" "}
                    <span style={{ fontSize: 13, color: "var(--v5-ink3)", marginLeft: 2 }}>{stat.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Today's Reflection */}
        <div
          className="relative flex min-w-0 flex-col"
          style={{
            background: "rgba(255, 251, 240, 0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid rgba(139, 94, 60, 0.10)",
            borderRadius: 24,
            padding: "32px 32px 28px",
            boxShadow: "0 2px 12px rgba(139, 94, 60, 0.06)",
            gap: 18,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="v5-eyebrow" style={{ fontSize: 10 }}>Today&apos;s Reflection</span>
            <span
              style={{
                fontFamily: "var(--v5-mono)",
                fontSize: 10.5,
                color: "var(--v5-ink3)",
                letterSpacing: "0.08em",
              }}
            >
              {formatShortDate(now)}
            </span>
          </div>

          <p
            className="relative"
            style={{
              margin: 0,
              fontFamily: "var(--v5-serif)",
              fontVariationSettings: '"opsz" 144, "SOFT" 60',
              fontSize: 22,
              lineHeight: 1.42,
              color: "var(--v5-ink)",
              letterSpacing: "-0.015em",
              paddingLeft: 18,
            }}
          >
            <span
              aria-hidden
              className="absolute"
              style={{
                left: 0,
                top: -8,
                fontFamily: "var(--v5-serif)",
                fontVariationSettings: '"opsz" 144, "wght" 500',
                fontSize: 56,
                lineHeight: 1,
                color: "var(--v5-accent)",
                opacity: 0.5,
              }}
            >
              “
            </span>
            {dailyQuote?.text ?? "重要的不是被给予了什么，而是如何去使用被给予的东西。"}
          </p>

          <div className="flex items-center" style={{ gap: 12 }}>
            <span style={{ width: 24, height: 1, background: "var(--v5-rule-strong)" }} />
            <span
              style={{
                fontFamily: "var(--v5-serif)",
                fontStyle: "italic",
                fontSize: 13,
                color: "var(--v5-ink2)",
                fontVariationSettings: '"opsz" 14',
              }}
            >
              {dailyQuote
                ? `${dailyQuote.author || "佚名"}${dailyQuote.book ? ` · ${dailyQuote.book}` : ""}`
                : "阿德勒 · 被讨厌的勇气"}
            </span>
          </div>

          {/* Footer */}
          <div
            className="mt-1 flex items-center justify-between"
            style={{
              paddingTop: 16,
              borderTop: "1px dashed var(--v5-rule)",
              fontFamily: "var(--v5-sans)",
            }}
          >
            <span
              className="inline-flex items-center"
              style={{ gap: 6, fontSize: 11.5, color: "var(--v5-ink3)" }}
            >
              <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--v5-accent)" }} />
              {dailyQuote?.book ? `今日阅读 · 《${dailyQuote.book}》` : "今日还没有摘录"}
            </span>
            <Link
              className="v5-quote-link"
              href="/library"
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "var(--v5-accent)",
              }}
            >
              书库 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();
  const timeEntries = useTimeEntriesStore();
  const [now, setNow] = useState(() => new Date());
  const [activeIndex, setActiveIndex] = useState(0);
  const [timeDialogType, setTimeDialogType] = useState<TimeEntry["type"] | null>(null);
  const [diaryModalId, setDiaryModalId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const allLogsSorted = useMemo(() => sortLogsByDate(logs, "desc"), [logs]);
  const recentLogs = useMemo(() => allLogsSorted.slice(0, 6), [allLogsSorted]);
  const monthLogs = useMemo(() => sortLogsByDate(getCurrentMonthLogs(logs), "desc"), [logs]);
  const monthQuotes = useMemo(() => getCurrentMonthQuotes(quotes), [quotes]);
  const monthTimeEntries = useMemo(() => getCurrentMonthTimeEntries(timeEntries), [timeEntries]);
  const todayLog = useMemo(() => recentLogs.find((log) => log.date === getTodayISODate()) ?? null, [recentLogs]);
  const weeklyLogs = useMemo(() => getCurrentWeekLogs(logs), [logs]);
  const weeklyQuotes = useMemo(() => getCurrentWeekQuotes(quotes), [quotes]);
  const weeklyTimeEntries = useMemo(() => getCurrentWeekTimeEntries(timeEntries), [timeEntries]);
  const weeklySummary = useMemo(() => computeSummary(weeklyLogs, weeklyQuotes, weeklyTimeEntries), [weeklyLogs, weeklyQuotes, weeklyTimeEntries]);
  const monthlySummary = useMemo(() => computeSummary(monthLogs, monthQuotes, monthTimeEntries), [monthLogs, monthQuotes, monthTimeEntries]);
  const todayStudyHours = useMemo(
    () => timeEntries.filter((entry) => entry.date === getTodayISODate() && entry.type === "study").reduce((sum, entry) => sum + entry.hours, 0),
    [timeEntries],
  );
  const todayReadingHours = useMemo(
    () => timeEntries.filter((entry) => entry.date === getTodayISODate() && entry.type === "reading").reduce((sum, entry) => sum + entry.hours, 0),
    [timeEntries],
  );
  const streak = useMemo(() => getConsecutiveStreak(logs), [logs]);
  const moodSeries = useMemo(() => buildMoodSeries(weeklyLogs), [weeklyLogs]);
  const dailyQuote = useMemo(() => getDailyQuote(quotes), [quotes]);

  // ── Smart factual insights replacing the previous poetic descriptions
  const allTimeBest = useMemo(() => getAllTimeBestStreak(logs), [logs]);
  const streakInsight = useMemo(() => getStreakInsight(logs, streak, allTimeBest), [logs, streak, allTimeBest]);
  const moodInsight = useMemo(() => getMoodInsight(logs), [logs]);
  const focusInsight = useMemo(() => getFocusInsight(logs, timeEntries), [logs, timeEntries]);
  const readingInsight = useMemo(() => getReadingInsight(logs, quotes, timeEntries), [logs, quotes, timeEntries]);
  const reviewBadge = useMemo(() => getReviewBadge(now), [now]);
  const monthEndPrompt = useMemo(() => getMonthEndPrompt(logs, 20, now), [logs, now]);
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
      {timeDialogType ? (
        <TimeEntryDialog
          onClose={() => setTimeDialogType(null)}
          type={timeDialogType}
        />
      ) : null}
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
                  href="/week-plan"
                  style={{
                    background: "rgba(255,248,238,0.9)",
                    border: "1px solid rgba(139,94,60,0.12)",
                    boxShadow: "var(--m-shadow-out)",
                  }}
                >
                  <CalendarRange size={18} style={{ color: "var(--m-accent)" }} />
                </Link>
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
                    {todayLog ? "点击查看或补充今天的记录。" : "记录一下今天的感受与想法。"}
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
              description={streakInsight}
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
              description={moodInsight}
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
                <TimeTextButton done={todayStudyHours > 0} onClick={() => setTimeDialogType("study")}>
                  给今天记一点学习时间
                </TimeTextButton>
              }
              description={focusInsight}
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
                <TimeTextButton done={todayReadingHours > 0} onClick={() => setTimeDialogType("reading")}>
                  记录一次阅读片刻
                </TimeTextButton>
              }
              description={readingInsight}
              eyebrow="READING"
              icon={BookOpen}
              title="阅读时长"
              unit="h"
              value={weeklySummary.totalReadingHours.toFixed(1)}
            >
              <ProgressRing current={weeklySummary.totalReadingHours} label="阅读进度" target={7} />
            </DashboardCard>
          </div>

          {/* Mobile featured journal entry */}
          {recentLogs.length > 0 && activeEntry && (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between px-1">
                <div className="text-sm font-semibold tracking-[0.12em]" style={{ color: "var(--m-ink2)" }}>
                  精选记录
                </div>
                <div className="flex items-center gap-2">
                  {recentLogs.length > 1 && (
                    <>
                      <button
                        aria-label="上一条"
                        className="flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-40"
                        onClick={() => turnPage("prev")}
                        style={{ background: "rgba(255,248,238,0.78)", borderColor: "rgba(139,94,60,0.12)", color: "var(--m-accent)" }}
                        type="button"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span className="text-xs tabular-nums" style={{ color: "var(--m-ink3)" }}>
                        {safeIndex + 1}/{recentLogs.length}
                      </span>
                      <button
                        aria-label="下一条"
                        className="flex h-8 w-8 items-center justify-center rounded-full border transition disabled:opacity-40"
                        onClick={() => turnPage("next")}
                        style={{ background: "rgba(255,248,238,0.78)", borderColor: "rgba(139,94,60,0.12)", color: "var(--m-accent)" }}
                        type="button"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <button
                className="block w-full rounded-[24px] text-left transition-transform active:scale-[0.98]"
                onClick={() => setDiaryModalId(activeEntry.id)}
                type="button"
                style={{
                  background: "linear-gradient(135deg, rgba(255,250,240,0.95), rgba(245,235,218,0.88))",
                  border: "1px solid var(--m-rule)",
                  boxShadow: "0 4px 16px rgba(139,94,60,0.08)",
                }}
              >
                <div className="relative overflow-hidden rounded-[24px] bg-[#fbf3e7] p-4">
                  {/* Book spine effect */}
                  <div className="pointer-events-none absolute inset-y-6 left-1/2 z-10 w-3 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,rgba(112,72,43,0.82),rgba(192,151,106,0.76),rgba(112,72,43,0.82))]" />

                  <div className="grid min-h-[200px] grid-cols-2 overflow-hidden rounded-[18px] border border-[rgba(139,94,60,0.12)] bg-[#fffaf1]">
                    {/* Left page */}
                    <div
                      className="flex flex-col justify-between px-4 py-5"
                      style={{
                        background: "linear-gradient(180deg, rgba(255,251,244,0.98), rgba(248,240,226,0.96))",
                        boxShadow: "inset -8px 0 16px rgba(122,79,43,0.04)",
                      }}
                    >
                      <div>
                        <div className="text-2xl font-bold leading-none" style={{ color: "var(--m-ink)" }}>
                          {activeEntry.date.slice(5).replace("-", "/")}
                        </div>
                        <div className="mt-1.5 text-[11px] tracking-[0.2em]" style={{ color: "var(--m-ink3)" }}>
                          {(() => { const d = new Date(activeEntry.date + "T00:00:00"); return ["周日","周一","周二","周三","周四","周五","周六"][d.getDay()]; })()}
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <span className="text-lg">
                          {activeEntry.mood >= 8 ? "😊" : activeEntry.mood >= 6 ? "🙂" : activeEntry.mood >= 4 ? "😐" : "😔"}
                        </span>
                        <span className="text-sm font-medium" style={{ color: "var(--m-ink2)" }}>
                          {activeEntry.mood}/10
                        </span>
                      </div>
                    </div>

                    {/* Right page */}
                    <div className="px-4 py-5" style={{ background: "repeating-linear-gradient(180deg, transparent, transparent 27px, rgba(139,94,60,0.04) 27px, rgba(139,94,60,0.04) 28px)" }}>
                      <p
                        className="text-[13px] leading-7"
                        style={{
                          color: "var(--m-ink2)",
                          fontFamily: '"Noto Serif SC", "Songti SC", serif',
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical" as const,
                          WebkitLineClamp: 6,
                          overflow: "hidden",
                        }}
                      >
                        {activeEntry.thoughts}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex gap-1.5">
                    {activeEntry.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full px-2.5 py-0.5 text-[11px]"
                        style={{ background: "rgba(139,94,60,0.06)", color: "var(--m-accent)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: "var(--m-ink3)" }}>
                    点击翻阅 →
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Mobile trends entry */}
          <div className="mt-5">
            <a
              className="group block rounded-[24px] p-5 transition-transform active:scale-[0.98]"
              href="#mobile-trends"
              onClick={(e) => {
                e.preventDefault();
                const el = document.getElementById("mobile-trends");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              style={{
                background: "linear-gradient(135deg, rgba(255,250,240,0.95), rgba(245,235,218,0.88))",
                border: "1px solid var(--m-rule)",
                boxShadow: "0 4px 16px rgba(139,94,60,0.08)",
              }}
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px]"
                  style={{ background: "rgba(139,94,60,0.10)", color: "var(--m-accent)" }}
                >
                  <TrendingUp size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
                    长期趋势概览
                  </div>
                  <div className="mt-0.5 text-sm" style={{ color: "var(--m-ink2)" }}>
                    {logs.length > 0
                      ? `已积累 ${logs.length} 条记录，查看情绪 · 学习 · 阅读趋势`
                      : "开始记录后，这里会长出你的成长曲线"}
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-[var(--m-ink3)] transition-transform group-hover:translate-x-0.5" />
              </div>

              {logs.length > 0 && (
                <div className="mt-4 flex gap-3">
                  <div className="flex-1 rounded-[14px] px-3 py-2.5 text-center" style={{ background: "rgba(139,94,60,0.06)" }}>
                    <div className="text-lg font-bold" style={{ color: "var(--m-ink)" }}>
                      {weeklySummary.entries ? weeklySummary.averageMood.toFixed(1) : "--"}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--m-ink3)" }}>情绪</div>
                  </div>
                  <div className="flex-1 rounded-[14px] px-3 py-2.5 text-center" style={{ background: "rgba(74,155,111,0.06)" }}>
                    <div className="text-lg font-bold" style={{ color: "var(--m-ink)" }}>
                      {weeklySummary.totalStudyHours.toFixed(1)}h
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--m-ink3)" }}>学习</div>
                  </div>
                  <div className="flex-1 rounded-[14px] px-3 py-2.5 text-center" style={{ background: "rgba(180,140,80,0.06)" }}>
                    <div className="text-lg font-bold" style={{ color: "var(--m-ink)" }}>
                      {weeklySummary.totalReadingHours.toFixed(1)}h
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--m-ink3)" }}>阅读</div>
                  </div>
                </div>
              )}
            </a>
          </div>

          {/* Mobile trends section (scroll target) */}
          {logs.length > 0 && (
            <div className="mt-5" id="mobile-trends">
              <CombinedTrendChart logs={logs} quotes={quotes} timeEntries={timeEntries} />
            </div>
          )}
        </section>

        <section className="mx-auto hidden md:block" style={{ maxWidth: 1240 }}>
          <div className="grid" style={{ gap: 32 }}>
            <V5HeroPanel
              avgMood={weeklySummary.entries ? weeklySummary.averageMood : 0}
              dailyQuote={dailyQuote}
              greeting={getGreeting(now)}
              hasMood={weeklySummary.entries > 0}
              monthEntries={monthlySummary.entries}
              now={now}
              reviewBadge={reviewBadge}
              weekEntries={weeklySummary.entries}
            />

            {monthEndPrompt && (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
                style={{
                  background: "rgba(200,137,58,0.08)",
                  color: "#7A5F00",
                  border: "1px solid rgba(200,137,58,0.22)",
                  fontFamily: "var(--v5-sans)",
                }}
              >
                <span>📌 {monthEndPrompt}</span>
              </div>
            )}

            {/* 4 KPI cards */}
            <div className="grid" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 18 }}>
              <V5KpiCard
                description={streakInsight}
                eyebrow="STREAK"
                footerAction={streak === 0 ? { label: "点亮热力图", href: "/daily-log" } : undefined}
                icon={Flame}
                title="连续记录"
                unit="天"
                value={String(streak)}
              >
                <HeatmapMini logs={logs} />
              </V5KpiCard>

              <V5KpiCard
                description={moodInsight}
                eyebrow="MOOD"
                footerAction={weeklySummary.entries === 0 ? { label: "写下今天的情绪", href: "/daily-log" } : undefined}
                icon={Sparkles}
                title="本周情绪"
                unit="/10"
                value={weeklySummary.entries ? weeklySummary.averageMood.toFixed(1) : "--"}
              >
                <MoodSparkline values={moodSeries} />
              </V5KpiCard>

              <V5KpiCard
                description={focusInsight}
                eyebrow="FOCUS"
                footerAction={{ label: todayStudyHours > 0 ? "再记一点" : "记录学习时间", onClick: () => setTimeDialogType("study") }}
                icon={NotebookPen}
                title="学习时长"
                unit="h"
                value={weeklySummary.totalStudyHours.toFixed(1)}
              >
                <ProgressRing current={weeklySummary.totalStudyHours} label="专注进度" target={10} />
              </V5KpiCard>

              <V5KpiCard
                description={readingInsight}
                eyebrow="READING"
                footerAction={{ label: todayReadingHours > 0 ? "再记一段" : "记录阅读片刻", onClick: () => setTimeDialogType("reading") }}
                icon={BookOpen}
                title="阅读时长"
                unit="h"
                value={weeklySummary.totalReadingHours.toFixed(1)}
              >
                <ProgressRing current={weeklySummary.totalReadingHours} label="阅读进度" target={7} />
              </V5KpiCard>
            </div>

            {/* Featured — original Panel-based layout (per user request) */}
            <Panel className="p-7 lg:p-8">
              <div className="flex items-center justify-between border-b border-dashed pb-5" style={{ borderColor: "rgba(139,94,60,0.12)" }}>
                <div>
                  <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                    FEATURED · 书页摘录
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">精选记录</h3>
                </div>
              </div>

              <div className="mt-6">
                {activeEntry ? (
                  <>
                    <FeaturedBookPreview entry={activeEntry} onClick={() => setDiaryModalId(activeEntry.id)} />
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
                    <Link className="mt-4 inline-flex text-sm font-medium" href="/daily-log" style={{ color: "var(--m-accent)" }}>
                      去写今天的第一条记录
                    </Link>
                  </div>
                )}
              </div>
            </Panel>

            {/* Trends · 长期趋势 */}
            <section className="grid" id="trends" style={{ gap: 20 }}>
              <div className="max-w-3xl">
                <div className="v5-eyebrow">TRENDS · 长期趋势</div>
                <h3
                  className="v5-display mt-2"
                  style={{ fontSize: 30, fontVariationSettings: '"opsz" 144', fontWeight: 400 }}
                >
                  长期趋势概览
                </h3>
                <p
                  className="mt-3"
                  style={{ fontFamily: "var(--v5-sans)", fontSize: 14, lineHeight: 1.7, color: "var(--v5-ink2)" }}
                >
                  将情绪波动、专注投入与阅读节奏整合为连续曲线，帮助你在时间跨度中发现规律、识别转折，看见真实的成长轨迹。
                </p>
              </div>

              {logs.length === 0 ? (
                <div
                  className="rounded-[28px] border border-dashed px-6 py-10 text-center"
                  style={{ borderColor: "var(--v5-rule-strong)", background: "var(--v5-card)" }}
                >
                  <p className="text-sm leading-7" style={{ color: "var(--v5-ink2)" }}>
                    先连续记录几天，成长概览里的长期趋势图就会自动长出来。
                  </p>
                  <Link
                    className="mt-4 inline-flex text-sm font-medium"
                    href="/daily-log"
                    style={{ color: "var(--v5-accent)" }}
                  >
                    去写今天的记录
                  </Link>
                </div>
              ) : (
                <CombinedTrendChart logs={logs} quotes={quotes} timeEntries={timeEntries} />
              )}
            </section>
          </div>
        </section>
      </div>

      <DiaryBookModalPortal
        entries={allLogsSorted}
        entryId={diaryModalId}
        timeEntries={timeEntries}
        onClose={() => setDiaryModalId(null)}
        onEdit={(entry) => {
          setDiaryModalId(null);
          window.location.href = `/daily-log?date=${entry.date}`;
        }}
      />
    </PageTransition>
  );
}
