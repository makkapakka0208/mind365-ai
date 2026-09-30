"use client";

import { useMemo, useSyncExternalStore } from "react";

import { ACCOUNT_STORAGE_EVENT } from "@/lib/account-storage";
import { getTodayISODate, parseISODate, toISODate } from "@/lib/date";
import { loadGoals, loadHabitLogs, loadHabits, readGoalsRaw, readHabitLogsRaw, readHabitsRaw, saveGoals, saveHabitLogs, saveHabits } from "@/lib/life-path-storage";
import { upsertTimeEntryById } from "@/lib/storage";
import type { Habit, HabitLog, HabitUnit, UserGoal } from "@/types/life-path";

/**
 * 习惯打卡。
 * - 每周目标天数（默认 5 天）：偶尔错过一天不算失败
 * - 最近 7 天可以补记，补记会如实标注
 * - 「已坚持 N 天」只有连续两天都没做才重新计数；休息日不算错过
 * - 关联目标：打卡量 × goalFactor 计入目标进度；可同时计入阅读 / 学习时长
 */

export const BACKFILL_DAYS = 7;

function subscribe(cb: () => void) {
  window.addEventListener("mind365:storage", cb);
  window.addEventListener(ACCOUNT_STORAGE_EVENT, cb);
  return () => {
    window.removeEventListener("mind365:storage", cb);
    window.removeEventListener(ACCOUNT_STORAGE_EVENT, cb);
  };
}

export function useParsedList<T>(read: () => string | null): T[] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  return useMemo(() => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }, [raw]);
}

export const useHabits = () => useParsedList<Habit>(readHabitsRaw);
export const useHabitLogs = () => useParsedList<HabitLog>(readHabitLogsRaw);
/** 目标列表（打卡会改进度，用这个保证界面跟着更新） */
export const useGoals = () => useParsedList<UserGoal>(readGoalsRaw);

// ── 习惯的增改 ───────────────────────────────────────────────────

/** 打卡单位 → 目标单位的换算：分钟打卡计入「XX 小时」目标时按 1/60 */
export function suggestGoalFactor(unit: HabitUnit, goal?: UserGoal): number {
  if (!goal) return 1;
  if (unit === "分钟" && /小时|h\b/i.test(goal.title)) return 1 / 60;
  if (unit === "小时" && /分钟/.test(goal.title)) return 60;
  return 1;
}

export function describeFactor(unit: HabitUnit, factor: number) {
  if (Math.abs(factor - 1 / 60) < 1e-9) return `按 ${unit} → 小时换算`;
  if (factor === 60) return `按 ${unit} → 分钟换算`;
  if (factor === 1) return "按 1 : 1 计入";
  return `每 1 ${unit}计入 ${Number(factor.toFixed(3))}`;
}

export function saveHabit(input: Omit<Habit, "id" | "createdAt"> & { id?: string }) {
  const habits = loadHabits();
  if (input.id) {
    saveHabits(habits.map((h) => (h.id === input.id ? { ...h, ...input, id: h.id, createdAt: h.createdAt } : h)));
  } else {
    saveHabits([...habits, { ...input, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }
}

export function archiveHabit(id: string) {
  saveHabits(loadHabits().map((h) => (h.id === id ? { ...h, archivedAt: new Date().toISOString() } : h)));
}

// ── 打卡 ───────────────────────────────────────────────────────

export function canEditDate(date: string, today = getTodayISODate()) {
  const d = parseISODate(today);
  d.setDate(d.getDate() - BACKFILL_DAYS);
  return date <= today && date >= toISODate(d);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 设置某一天的打卡：amount 为数字 → 打卡 / 改量；\"rest\" → 休息日；null → 清除。
 * 同步调整关联目标进度与阅读 / 学习时长（按差值，不会重复累加）。
 */
export async function setHabitLog(habit: Habit, date: string, value: number | "rest" | null) {
  const today = getTodayISODate();
  if (!canEditDate(date, today)) return;

  const logs = loadHabitLogs();
  const existing = logs.find((l) => l.habitId === habit.id && l.date === date);
  const oldAmount = existing && !existing.rest ? existing.amount : 0;
  const newAmount = typeof value === "number" ? Math.max(0, value) : 0;
  const delta = newAmount - oldAmount;
  const now = new Date().toISOString();

  // 1. 关联目标：按差值加减
  if (habit.goalId && delta !== 0) {
    const factor = habit.goalFactor ?? 1;
    saveGoals(
      loadGoals().map((g) =>
        g.id === habit.goalId ? { ...g, currentValue: Math.max(0, round2(g.currentValue + delta * factor)) } : g,
      ),
    );
  }

  // 2. 阅读 / 学习时长：每条打卡对应一条固定的时长记录
  let timeEntryId = existing?.timeEntryId;
  if (habit.trackAs && (habit.unit === "分钟" || habit.unit === "小时") && (timeEntryId || newAmount > 0)) {
    timeEntryId = timeEntryId ?? crypto.randomUUID();
    const hours = habit.unit === "分钟" ? newAmount / 60 : newAmount;
    await upsertTimeEntryById({
      id: timeEntryId,
      date,
      type: habit.trackAs,
      hours: round2(hours),
      note: `习惯打卡 · ${habit.name}`,
      createdAt: existing?.createdAt ?? now,
    });
  }

  // 3. 打卡记录
  const rest = value === "rest";
  const others = logs.filter((l) => !(l.habitId === habit.id && l.date === date));
  if (value === null && !timeEntryId) {
    saveHabitLogs(others);
    return;
  }
  const next: HabitLog = {
    id: existing?.id ?? crypto.randomUUID(),
    habitId: habit.id,
    date,
    amount: newAmount,
    rest: rest || undefined,
    backfilled: existing?.backfilled ?? date !== today,
    timeEntryId,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  // 清除但保留时长记录 id（已置 0），以便以后重新打卡时复用同一条
  saveHabitLogs(value === null ? [...others, { ...next, amount: 0, rest: undefined }] : [...others, next]);
}

// ── 统计 ───────────────────────────────────────────────────────

export type DayState = "done" | "partial" | "rest" | "missed" | "pending" | "future" | "before";

export function logKey(habitId: string, date: string) {
  return `${habitId}|${date}`;
}

export function indexLogs(logs: HabitLog[]) {
  return new Map(logs.map((l) => [logKey(l.habitId, l.date), l]));
}

export function dayState(habit: Habit, date: string, index: Map<string, HabitLog>, today = getTodayISODate()): DayState {
  if (date > today) return "future";
  if (date < habit.createdAt.slice(0, 10)) return "before";
  const log = index.get(logKey(habit.id, date));
  if (log?.rest) return "rest";
  if (log && log.amount >= habit.dailyTarget) return "done";
  if (log && log.amount > 0) return "partial";
  return date === today ? "pending" : "missed";
}

/** 本周（周一到周日）的日期 */
export function currentWeekDates(today = getTodayISODate()) {
  const d = parseISODate(today);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return toISODate(x);
  });
}

export function weekProgress(habit: Habit, index: Map<string, HabitLog>, today = getTodayISODate()) {
  const dates = currentWeekDates(today);
  const states = dates.map((date) => dayState(habit, date, index, today));
  const done = states.filter((s) => s === "done").length;
  const rest = states.filter((s) => s === "rest").length;
  // 休息日让本周可用天数变少；目标天数不超过可用天数
  const required = Math.min(habit.weeklyDays, 7 - rest);
  const daysLeft = dates.filter((date, i) => date >= today && states[i] !== "done" && states[i] !== "rest").length;
  return { done, rest, required, daysLeft, met: done >= required };
}

/** 已坚持 N 天：统计完成的天数，只有连续两天都错过才重新计数 */
export function keepCount(habit: Habit, index: Map<string, HabitLog>, today = getTodayISODate()) {
  let count = 0;
  let missStreak = 0;
  const cursor = parseISODate(habit.createdAt.slice(0, 10));
  const end = parseISODate(today);
  while (cursor <= end) {
    const state = dayState(habit, toISODate(cursor), index, today);
    if (state === "done") {
      count++;
      missStreak = 0;
    } else if (state === "missed") {
      missStreak++;
      if (missStreak >= 2) count = 0;
    } else if (state !== "pending") {
      missStreak = 0; // 休息、做了一部分都不算错过
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** 昨天错过、今天还没做：给一句温和的提醒 */
export function shouldNudge(habit: Habit, index: Map<string, HabitLog>, today = getTodayISODate()) {
  const y = parseISODate(today);
  y.setDate(y.getDate() - 1);
  return dayState(habit, toISODate(y), index, today) === "missed" && dayState(habit, today, index, today) === "pending";
}
