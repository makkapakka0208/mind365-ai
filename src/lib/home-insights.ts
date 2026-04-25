/**
 * home-insights.ts
 *
 * Computes the small, factual one-liners that replace the poetic
 * card descriptions on the homepage, and the "next best action"
 * shown in the sidebar.
 */

import {
  computeSummary,
  getCurrentMonthLogs,
  getCurrentWeekLogs,
  getCurrentWeekQuotes,
  parseReadingHours,
  sortLogsByDate,
} from "@/lib/analytics";
import { getTodayISODate, parseISODate, toISODate } from "@/lib/date";
import type { DailyLog, Quote } from "@/types";

export const STUDY_WEEKLY_TARGET = 10;
export const READING_WEEKLY_TARGET = 7;

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOfPrevWeek(reference: Date = new Date()): { start: Date; end: Date } {
  const ref = new Date(reference);
  ref.setDate(ref.getDate() - 7);
  // align to Monday
  const day = ref.getDay() || 7; // Sunday → 7
  const start = new Date(ref);
  start.setDate(ref.getDate() - (day - 1));
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function logsBetween(logs: DailyLog[], start: Date, end: Date): DailyLog[] {
  const s = toISODate(start);
  const e = toISODate(end);
  return logs.filter((log) => log.date >= s && log.date <= e);
}

function daysSinceLastLog(logs: DailyLog[]): number {
  if (logs.length === 0) return Infinity;
  const sorted = sortLogsByDate(logs, "desc");
  const last = parseISODate(sorted[0].date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - last.getTime()) / 86_400_000));
}

// ── Streak insight ───────────────────────────────────────────────────────────

export function getStreakInsight(logs: DailyLog[], streak: number, allTimeBest: number): string {
  if (streak === 0) {
    const since = daysSinceLastLog(logs);
    if (!Number.isFinite(since)) return "还没开始记录，从今天点亮第一格";
    if (since === 1) return "昨天记过 · 今天再续上";
    return `已 ${since} 天没有记录`;
  }
  if (streak >= allTimeBest && streak >= 3) return "创造个人新纪录";
  if (streak >= 7) return `连续 ${streak} 天 · 节奏稳定`;
  return `连续 ${streak} 天 · 继续保持`;
}

/** All-time longest streak (used to detect personal records). */
export function getAllTimeBestStreak(logs: DailyLog[]): number {
  if (logs.length === 0) return 0;
  const dates = [...new Set(logs.map((l) => l.date))].sort();
  let best = 1;
  let cur = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = parseISODate(dates[i - 1]);
    const today = parseISODate(dates[i]);
    const gap = Math.round((today.getTime() - prev.getTime()) / 86_400_000);
    if (gap === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

// ── Mood insight ─────────────────────────────────────────────────────────────

export function getMoodInsight(logs: DailyLog[]): string {
  const thisWeek = getCurrentWeekLogs(logs);
  if (thisWeek.length === 0) return "本周还没有情绪记录";

  const thisAvg = thisWeek.reduce((s, l) => s + l.mood, 0) / thisWeek.length;
  const { start, end } = startOfPrevWeek();
  const prev = logsBetween(logs, start, end);
  if (prev.length === 0) {
    return `本周平均 ${thisAvg.toFixed(1)} / 10`;
  }
  const prevAvg = prev.reduce((s, l) => s + l.mood, 0) / prev.length;
  const delta = thisAvg - prevAvg;
  if (Math.abs(delta) < 0.15) return "和上周持平";
  return delta > 0
    ? `比上周平均高 ${delta.toFixed(1)}`
    : `比上周平均低 ${Math.abs(delta).toFixed(1)}`;
}

// ── Focus (study) insight ────────────────────────────────────────────────────

const WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function getFocusInsight(logs: DailyLog[]): string {
  const thisWeek = getCurrentWeekLogs(logs);
  const total = thisWeek.reduce((s, l) => s + l.studyHours, 0);
  if (total === 0) return "本周还未投入学习时长";

  if (total >= STUDY_WEEKLY_TARGET) return `已超过本周目标 ${STUDY_WEEKLY_TARGET}h`;

  // Find peak weekday
  const byDay = new Map<string, number>();
  for (const log of thisWeek) {
    byDay.set(log.date, (byDay.get(log.date) ?? 0) + log.studyHours);
  }
  let peakDate = "";
  let peakValue = 0;
  for (const [date, value] of byDay.entries()) {
    if (value > peakValue) {
      peakDate = date;
      peakValue = value;
    }
  }
  if (peakValue > 0 && peakDate) {
    const wd = WEEKDAY_CN[parseISODate(peakDate).getDay()];
    return `${wd}最投入 (${peakValue.toFixed(1)}h) · 还差 ${(STUDY_WEEKLY_TARGET - total).toFixed(1)}h`;
  }
  return `还差 ${(STUDY_WEEKLY_TARGET - total).toFixed(1)}h 达本周目标`;
}

// ── Reading insight ──────────────────────────────────────────────────────────

export function getReadingInsight(logs: DailyLog[], quotes: Quote[]): string {
  const weekLogs = getCurrentWeekLogs(logs);
  const weekQuotes = getCurrentWeekQuotes(quotes);
  const summary = computeSummary(weekLogs, weekQuotes);
  const total = summary.totalReadingHours;

  if (total === 0) return "本周还未开始阅读";
  const pct = Math.round((total / READING_WEEKLY_TARGET) * 100);
  if (pct >= 100) return `已超过本周目标 (${pct}%)`;
  const remaining = READING_WEEKLY_TARGET - total;
  return `已完成 ${pct}% · 距达标只剩 ${remaining.toFixed(1)}h`;
}

// ── Review reminders ─────────────────────────────────────────────────────────

/** Sun (0) or Mon (1) → weekly review window. */
export function isWeeklyReviewDue(reference: Date = new Date()): boolean {
  const day = reference.getDay();
  return day === 0 || day === 1;
}

/** Last 3 days of the month → monthly review window. */
export function isMonthlyReviewDue(reference: Date = new Date()): boolean {
  const ref = new Date(reference);
  const lastDay = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  return ref.getDate() >= lastDay - 2;
}

/** Returns the badge label or null when there's nothing to nudge. */
export function getReviewBadge(reference: Date = new Date()): string | null {
  if (isWeeklyReviewDue(reference)) return "本周待复盘";
  if (isMonthlyReviewDue(reference)) return "本月待复盘";
  return null;
}

/** End-of-month nudge: how far the user is from their monthly entry baseline. */
export function getMonthEndPrompt(logs: DailyLog[], targetEntries = 20, reference: Date = new Date()): string | null {
  if (!isMonthlyReviewDue(reference)) return null;
  const monthLogs = getCurrentMonthLogs(logs, reference);
  if (monthLogs.length >= targetEntries) return null;
  const diff = targetEntries - monthLogs.length;
  const lastDay = new Date(reference.getFullYear(), reference.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - reference.getDate();
  return `本月还差 ${diff} 条达成 ${targetEntries} 条记录目标 · 剩余 ${daysLeft} 天`;
}

// ── Smart next action ────────────────────────────────────────────────────────

export interface NextAction {
  message: string;
  ctaLabel: string;
  ctaHref: string;
  /** Cosmetic accent color for the card. */
  tone: "warm" | "alert" | "info";
}

/**
 * Picks the single most relevant next action based on current state.
 * Priority order:
 *   1. No log today and gap >= 1 day  → 写一条
 *   2. Weekly review window           → 进入复盘
 *   3. Study target far behind        → 进入专注时刻
 *   4. Reading target far behind      → 进入书库
 *   5. Default                        → 写一条新记录
 */
export function getNextAction(logs: DailyLog[], quotes: Quote[], reference: Date = new Date()): NextAction {
  const todayIso = getTodayISODate();
  const todayLog = logs.find((l) => l.date === todayIso);
  const gap = daysSinceLastLog(logs);

  // 1. Long gap
  if (!todayLog) {
    if (gap === Infinity) {
      return {
        message: "你还没有第一条记录",
        ctaLabel: "现在写一条 →",
        ctaHref: "/record",
        tone: "warm",
      };
    }
    if (gap >= 3) {
      return {
        message: `你已经 ${gap} 天没写日记了`,
        ctaLabel: "现在写一条 →",
        ctaHref: "/record",
        tone: "alert",
      };
    }
    if (gap >= 1) {
      return {
        message: gap === 1 ? "今天还没记 · 别让节奏断在这一天" : `已经 ${gap} 天没写了`,
        ctaLabel: "现在写一条 →",
        ctaHref: "/record",
        tone: "warm",
      };
    }
  }

  // 2. Review window
  if (isWeeklyReviewDue(reference)) {
    return {
      message: "本周到了复盘时间",
      ctaLabel: "进入周复盘 →",
      ctaHref: "/weekly-review",
      tone: "info",
    };
  }
  if (isMonthlyReviewDue(reference)) {
    return {
      message: "本月接近尾声，回顾一下",
      ctaLabel: "进入月复盘 →",
      ctaHref: "/monthly-review",
      tone: "info",
    };
  }

  // 3. Study far behind (more than 60% remaining mid/late week)
  const weekLogs = getCurrentWeekLogs(logs);
  const weekday = reference.getDay() || 7;
  if (weekday >= 3) {
    const studyTotal = weekLogs.reduce((s, l) => s + l.studyHours, 0);
    const studyRemaining = STUDY_WEEKLY_TARGET - studyTotal;
    if (studyRemaining >= 6) {
      return {
        message: `本周学习还差 ${studyRemaining.toFixed(1)}h 达标`,
        ctaLabel: "进入专注时刻 →",
        ctaHref: "/record",
        tone: "warm",
      };
    }
  }

  // 4. Reading far behind
  if (weekday >= 4) {
    const weekQuotes = getCurrentWeekQuotes(quotes);
    const summary = computeSummary(weekLogs, weekQuotes);
    const readingRemaining = READING_WEEKLY_TARGET - summary.totalReadingHours;
    if (readingRemaining >= 4) {
      return {
        message: `本周阅读还差 ${readingRemaining.toFixed(1)}h 达标`,
        ctaLabel: "翻开灵感书库 →",
        ctaHref: "/library",
        tone: "info",
      };
    }
  }

  // 5. Default — already on track
  if (todayLog) {
    return {
      message: "今日已记录 · 节奏正稳",
      ctaLabel: "看看本周主线 →",
      ctaHref: "/week-plan",
      tone: "info",
    };
  }
  return {
    message: "记一段今天的状态",
    ctaLabel: "现在写一条 →",
    ctaHref: "/record",
    tone: "warm",
  };
}

// Re-export for components that don't already import it.
export { parseReadingHours };
