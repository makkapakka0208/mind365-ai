/**
 * life-path-storage.ts
 *
 * localStorage persistence for LifeDirection[] and UserGoal[].
 * Follows the same offline-first pattern used throughout Mind365.
 */

import type { LifeDirection, UserGoal } from "@/types/life-path";

const DIRECTIONS_KEY = "mind365_life_directions";
const GOALS_KEY = "mind365_life_goals";

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
