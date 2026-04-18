/**
 * life-path-storage.ts
 *
 * localStorage persistence for LifeDirection[] and UserGoal[].
 * Follows the same offline-first pattern used throughout Mind365.
 */

import type { LifeDirection, MentorPlan, UserGoal } from "@/types/life-path";

const DIRECTIONS_KEY = "mind365_life_directions";
const GOALS_KEY = "mind365_life_goals";
const MENTOR_KEY = "mind365_mentor_plans";

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
