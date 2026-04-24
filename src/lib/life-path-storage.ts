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

/** ISO week key, e.g. "2024-W16" */
export function currentWeekKey(): string {
  const d = new Date();
  const jan1 = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86_400_000 + jan1.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Today as yyyy-MM-dd */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Shift an ISO week key by `delta` weeks (delta can be negative). */
export function shiftWeekKey(weekKey: string, delta: number): string {
  const m = weekKey.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekKey;
  const year = Number(m[1]);
  const week = Number(m[2]);
  // Approximate: use the first day of the target year, add (week-1)*7 days, then shift
  const jan1 = new Date(year, 0, 1);
  const approx = new Date(jan1.getTime() + (week - 1 + delta) * 7 * 86_400_000);
  const y = approx.getFullYear();
  const newJan1 = new Date(y, 0, 1);
  const w = Math.ceil(((approx.getTime() - newJan1.getTime()) / 86_400_000 + newJan1.getDay() + 1) / 7);
  return `${y}-W${String(w).padStart(2, "0")}`;
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
