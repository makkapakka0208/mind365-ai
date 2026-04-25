/**
 * life-path-storage.ts
 *
 * localStorage persistence for LifeDirection[] and UserGoal[].
 * Follows the same offline-first pattern used throughout Mind365.
 */

import type { LifeDirection, MentorPlan, UserGoal, WeekPlan, WeekTask } from "@/types/life-path";

const DIRECTIONS_KEY = "mind365_life_directions";
const GOALS_KEY = "mind365_life_goals";
const MENTOR_KEY = "mind365_mentor_plans";
const WEEK_PLANS_KEY = "mind365_week_plans";

// ── Helpers ───────────────────────────────────────────────────────────────────

function tryParse<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ── Life Directions ───────────────────────────────────────────────────────────

export function loadDirections(): LifeDirection[] {
  return tryParse<LifeDirection[]>(DIRECTIONS_KEY, []);
}

export function saveDirections(dirs: LifeDirection[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DIRECTIONS_KEY, JSON.stringify(dirs));
}

// ── User Goals ────────────────────────────────────────────────────────────────

export function loadGoals(): UserGoal[] {
  return tryParse<UserGoal[]>(GOALS_KEY, []);
}

export function saveGoals(goals: UserGoal[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

// ── Mentor Plans ──────────────────────────────────────────────────────────────

export function loadMentorPlans(): Record<string, MentorPlan> {
  return tryParse<Record<string, MentorPlan>>(MENTOR_KEY, {});
}

export function saveMentorPlan(plan: MentorPlan): void {
  if (typeof window === "undefined") return;
  const all = loadMentorPlans();
  all[plan.goalId] = plan;
  localStorage.setItem(MENTOR_KEY, JSON.stringify(all));
}

export function deleteMentorPlan(goalId: string): void {
  if (typeof window === "undefined") return;
  const all = loadMentorPlans();
  delete all[goalId];
  localStorage.setItem(MENTOR_KEY, JSON.stringify(all));
}

/**
 * Returns the ISO 8601 week key for the given date, e.g. "2026-W17".
 *
 * ISO weeks start on Monday and week 1 is the week containing the
 * year's first Thursday — which means the calendar year of the week
 * key may differ from the date's calendar year near year boundaries.
 *
 * The previous implementation used `ceil` on a raw ms-difference and
 * therefore flipped to the next week number at any time after 00:00
 * on the last day of the week, e.g. Saturday afternoon would render
 * as the upcoming week. This implementation uses integer day math
 * and the canonical ISO formula instead.
 */
export function currentWeekKey(reference: Date = new Date()): string {
  // Strip time-of-day so we work in pure calendar days.
  const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  // Shift to the Thursday of this ISO week.
  // ISO day numbers: Mon=1 ... Sun=7. JS getDay(): Sun=0 ... Sat=6 → remap.
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  // Week 1 contains the year's first Thursday → the week of `d` shares its year.
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - yearStart.getTime()) / 86_400_000);
  const week = Math.floor(days / 7) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Today as yyyy-MM-dd */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Returns the Monday (00:00) that opens the given ISO week key. */
function isoWeekMonday(weekKey: string): Date | null {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // Jan 4 is always in ISO week 1.
  const jan4 = new Date(year, 0, 4);
  const jan4DayNum = jan4.getDay() || 7;
  const w1Monday = new Date(jan4);
  w1Monday.setDate(jan4.getDate() - (jan4DayNum - 1));
  const monday = new Date(w1Monday);
  monday.setDate(w1Monday.getDate() + (week - 1) * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** Shift an ISO week key by `delta` weeks (delta can be negative). */
export function shiftWeekKey(weekKey: string, delta: number): string {
  const monday = isoWeekMonday(weekKey);
  if (!monday) return weekKey;
  monday.setDate(monday.getDate() + delta * 7);
  return currentWeekKey(monday);
}

/** Format a week key as a human-readable label, e.g. "本周" or "2024 第 16 周". */
export function formatWeekLabel(weekKey: string): string {
  if (weekKey === currentWeekKey()) return "本周";
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  return `${m[1]} 第 ${Number(m[2])} 周`;
}

// ── Week Plans ────────────────────────────────────────────────────────────────

export function loadWeekPlans(): Record<string, WeekPlan> {
  return tryParse<Record<string, WeekPlan>>(WEEK_PLANS_KEY, {});
}

export function loadWeekPlan(weekKey: string): WeekPlan | null {
  const all = loadWeekPlans();
  return all[weekKey] ?? null;
}

export function saveWeekPlan(plan: WeekPlan): void {
  if (typeof window === "undefined") return;
  const all = loadWeekPlans();
  all[plan.weekKey] = plan;
  localStorage.setItem(WEEK_PLANS_KEY, JSON.stringify(all));
}

export function upsertWeekTask(weekKey: string, task: WeekTask): void {
  const plan = loadWeekPlan(weekKey);
  if (!plan) return;
  const idx = plan.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) plan.tasks[idx] = task;
  else plan.tasks.push(task);
  saveWeekPlan(plan);
}

export function removeWeekTask(weekKey: string, taskId: string): void {
  const plan = loadWeekPlan(weekKey);
  if (!plan) return;
  plan.tasks = plan.tasks.filter((t) => t.id !== taskId);
  saveWeekPlan(plan);
}

export function ensureWeekPlan(weekKey: string): WeekPlan {
  const existing = loadWeekPlan(weekKey);
  if (existing) return existing;
  const fresh: WeekPlan = {
    weekKey,
    focus: "",
    trap: "",
    trapDismissed: false,
    tasks: [],
    createdAt: new Date().toISOString(),
    generatedAt: null,
  };
  saveWeekPlan(fresh);
  return fresh;
}
