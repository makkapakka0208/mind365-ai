/**
 * life-path.ts
 *
 * Core logic for the Life Path System:
 *   - Goal progress calculation
 *   - Action keyword detection
 *   - Daily alignment scoring
 *   - Aggregate score helpers
 *
 * All functions are pure (no side-effects) and independently testable.
 */

import type {
  AiAction,
  AlignmentResult,
  DirectionBreakdown,
  FusedAction,
  GoalProgress,
  LifeDirection,
  LifePathLog,
  RuleAction,
  UserGoal,
} from "@/types/life-path";

// ── Scoring constants ─────────────────────────────────────────────────────────

/**
 * Neutral baseline.  A day with zero detected actions scores exactly here.
 * Using 50 means the scale reads intuitively: above = net-positive day,
 * below = net-negative day.
 */
const BASE_SCORE = 50;

/** Points added per matched positive action keyword */
const POSITIVE_WEIGHT = 10;

/** Points deducted per matched negative action keyword */
const NEGATIVE_WEIGHT = 10;

const SCORE_MIN = 0;
const SCORE_MAX = 100;

// ── Goal Progress ─────────────────────────────────────────────────────────────

/**
 * Calculate how far a user has progressed toward a `UserGoal`.
 *
 * @example
 * const progress = calculateGoalProgress({
 *   id: "g1", title: "Save $1M",
 *   targetValue: 1_000_000, currentValue: 230_000,
 *   deadline: "2030-01-01",
 * });
 * // → { fraction: 0.23, percentage: 23, remaining: 770_000, isCompleted: false, daysLeft: ... }
 */
export function calculateGoalProgress(goal: UserGoal): GoalProgress {
  // Guard: nonsensical target — treat as already complete
  if (goal.targetValue <= 0) {
    return {
      fraction: 1,
      percentage: 100,
      remaining: 0,
      isCompleted: true,
      daysLeft: null,
    };
  }

  // Fraction is capped at 1 so the UI never shows >100 %
  const fraction = Math.min(goal.currentValue / goal.targetValue, 1);
  const percentage = Math.round(fraction * 100);
  const remaining = Math.max(goal.targetValue - goal.currentValue, 0);
  const isCompleted = goal.currentValue >= goal.targetValue;

  // Days left — null when no deadline is provided
  let daysLeft: number | null = null;
  if (goal.deadline) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(goal.deadline);
    deadline.setHours(0, 0, 0, 0);
    // Negative value means the deadline has already passed
    daysLeft = Math.ceil(
      (deadline.getTime() - today.getTime()) / (1_000 * 60 * 60 * 24),
    );
  }

  return { fraction, percentage, remaining, isCompleted, daysLeft };
}

// ── Action Detection ──────────────────────────────────────────────────────────

/**
 * Scan free-form text for action keywords defined across all life directions.
 *
 * Matching is case-insensitive and substring-based, keeping it simple enough
 * to work without NLP while still being useful.  Replace this function with
 * an AI-powered version later without changing any call-sites.
 *
 * @returns Deduplicated list of matched keywords (preserving original casing).
 *
 * @example
 * detectActions("Studied 2 hours but wasted time on TikTok", directions)
 * // → ["study", "scrolling"]
 */
export function detectActions(
  content: string,
  directions: LifeDirection[],
): string[] {
  const lower = content.toLowerCase();
  const seen = new Set<string>();
  const matches: string[] = [];

  for (const dir of directions) {
    const allKeywords = [...dir.positiveActions, ...dir.negativeActions];

    for (const keyword of allKeywords) {
      const key = keyword.toLowerCase();
      if (!seen.has(key) && lower.includes(key)) {
        seen.add(key);
        // Return the keyword in its original casing from the direction config
        matches.push(keyword);
      }
    }
  }

  return matches;
}

// ── Alignment Score ───────────────────────────────────────────────────────────

/**
 * Score how well a single daily log aligns with the user's life directions.
 *
 * Algorithm
 * ─────────
 * 1. Start at BASE_SCORE (50) — perfectly neutral.
 * 2. Deduplicate detected actions to prevent the same keyword from scoring
 *    twice if it appears multiple times in the log or across many directions.
 * 3. For every unique action, scan each direction:
 *    - Positive match  →  +POSITIVE_WEIGHT (10)
 *    - Negative match  →  −NEGATIVE_WEIGHT (10)
 *    Each (action × direction) pair is counted at most once.
 * 4. Clamp the total to [0, 100].
 *
 * @example
 * const log: LifePathLog = {
 *   id: "l1", date: "2024-04-14",
 *   content: "Studied 2 hours but wasted time on TikTok",
 *   detectedActions: ["study", "scrolling"],
 * };
 * const result = calculateAlignmentScore(log, directions);
 * // → { score: 50, positiveMatches: ["study"], negativeMatches: ["scrolling"], ... }
 */
export function calculateAlignmentScore(
  log: LifePathLog,
  directions: LifeDirection[],
): AlignmentResult {
  let totalDelta = 0;
  const positiveMatches: string[] = [];
  const negativeMatches: string[] = [];
  const breakdown: DirectionBreakdown[] = [];

  // Normalise detected actions once so per-direction loops are O(1) lookups
  const uniqueActions = [
    ...new Set(log.detectedActions.map((a) => a.toLowerCase())),
  ];

  for (const dir of directions) {
    const positiveSet = new Set(dir.positiveActions.map((a) => a.toLowerCase()));
    const negativeSet = new Set(dir.negativeActions.map((a) => a.toLowerCase()));

    const positiveHits: string[] = [];
    const negativeHits: string[] = [];

    for (const action of uniqueActions) {
      if (positiveSet.has(action)) {
        positiveHits.push(action);
        // Guard against recording the same action in multiple directions
        if (!positiveMatches.includes(action)) positiveMatches.push(action);
        totalDelta += POSITIVE_WEIGHT;
      } else if (negativeSet.has(action)) {
        negativeHits.push(action);
        if (!negativeMatches.includes(action)) negativeMatches.push(action);
        totalDelta -= NEGATIVE_WEIGHT;
      }
    }

    breakdown.push({
      directionId: dir.id,
      directionName: dir.name,
      positiveHits,
      negativeHits,
      delta:
        positiveHits.length * POSITIVE_WEIGHT -
        negativeHits.length * NEGATIVE_WEIGHT,
    });
  }

  const score = Math.min(SCORE_MAX, Math.max(SCORE_MIN, BASE_SCORE + totalDelta));

  return { score, positiveMatches, negativeMatches, breakdown };
}

// ── Aggregate helpers ─────────────────────────────────────────────────────────

/**
 * Average alignment score across an array of daily logs.
 * Useful for weekly / monthly trend charts.
 *
 * @returns Rounded integer score, or `null` when the array is empty.
 */
export function averageAlignmentScore(
  logs: LifePathLog[],
  directions: LifeDirection[],
): number | null {
  if (!logs.length) return null;

  const total = logs.reduce(
    (sum, log) => sum + calculateAlignmentScore(log, directions).score,
    0,
  );

  return Math.round(total / logs.length);
}

// ── Fusion layer (Rule + AI) ──────────────────────────────────────────────────

/**
 * Weight applied to actions detected by the deterministic rule layer.
 * Rules are high-precision so they always count fully.
 */
const RULE_WEIGHT = 1.0;

/**
 * Fuse rule-layer and AI-layer outputs into a single deduplicated stream.
 *
 * Merge rules
 * ───────────
 *   1. Same `type` collision  → rule wins, AI duplicate is discarded.
 *   2. AI-only types          → kept, weight = `confidence` (0.5–0.9).
 *   3. Rule-only types        → kept, weight = 1.0.
 *
 * The fusion intentionally discards AI duplicates wholesale instead of
 * averaging confidences: a rule match means we have ground truth, and
 * mixing in a weaker signal would only dilute it.
 *
 * @example
 * const rules = [{ type: "study", category: "positive", source: "rule" }];
 * const ai    = [
 *   { type: "study",   category: "positive", confidence: 0.8, source: "ai" }, // dropped
 *   { type: "lowMood", category: "negative", confidence: 0.7, source: "ai" }, // kept
 * ];
 * fuseActions(rules, ai);
 * // → [
 * //     { type: "study",   category: "positive", source: "rule", weight: 1.0 },
 * //     { type: "lowMood", category: "negative", source: "ai",   weight: 0.7, confidence: 0.7 },
 * //   ]
 */
export function fuseActions(
  ruleActions: RuleAction[],
  aiActions: AiAction[],
): FusedAction[] {
  const fused: FusedAction[] = [];
  const seenTypes = new Set<string>();

  // Rule actions first — they always win on conflicts.
  for (const r of ruleActions) {
    seenTypes.add(r.type);
    fused.push({
      type: r.type,
      category: r.category,
      source: "rule",
      weight: RULE_WEIGHT,
      ...(r.duration !== undefined ? { duration: r.duration } : {}),
    });
  }

  // AI actions fill in the gaps.
  for (const a of aiActions) {
    if (seenTypes.has(a.type)) continue;
    seenTypes.add(a.type);
    fused.push({
      type: a.type,
      category: a.category,
      source: "ai",
      weight: a.confidence,
      confidence: a.confidence,
      ...(a.reason ? { reason: a.reason } : {}),
    });
  }

  return fused;
}

// ── Weighted alignment score ──────────────────────────────────────────────────

/** Result returned by `calculateAlignmentScoreWeighted()`. */
export interface WeightedAlignmentResult {
  /** Final score in [0, 100] using per-action weights */
  score: number;

  /** Total positive contribution (already weighted) */
  positiveDelta: number;

  /** Total negative contribution (already weighted, expressed as a positive number) */
  negativeDelta: number;

  /** All fused actions that contributed, with their categories and weights */
  contributions: FusedAction[];
}

/**
 * Score a day's `FusedAction[]` directly, using the source-aware weights
 * computed by `fuseActions()`.
 *
 * Algorithm
 * ─────────
 *   score = clamp(BASE_SCORE
 *                 + Σ (POSITIVE_WEIGHT × weight) over positive actions
 *                 − Σ (NEGATIVE_WEIGHT × weight) over negative actions,
 *                 [0, 100])
 *
 * Unlike `calculateAlignmentScore()`, this function does not depend on a
 * user-defined `LifeDirection[]` — categories are carried on the fused
 * actions themselves.  Use this when you have already run the
 * Rule + AI + Fusion pipeline.
 */
export function calculateAlignmentScoreWeighted(
  actions: FusedAction[],
): WeightedAlignmentResult {
  let positiveDelta = 0;
  let negativeDelta = 0;

  for (const a of actions) {
    if (a.category === "positive") {
      positiveDelta += POSITIVE_WEIGHT * a.weight;
    } else {
      negativeDelta += NEGATIVE_WEIGHT * a.weight;
    }
  }

  const raw = BASE_SCORE + positiveDelta - negativeDelta;
  const score = Math.round(
    Math.min(SCORE_MAX, Math.max(SCORE_MIN, raw)),
  );

  return { score, positiveDelta, negativeDelta, contributions: actions };
}

/**
 * Return logs sorted by alignment score (highest first).
 * Handy for surfacing the user's best days in a review screen.
 */
export function rankLogsByScore(
  logs: LifePathLog[],
  directions: LifeDirection[],
): Array<{ log: LifePathLog; score: number }> {
  return logs
    .map((log) => ({
      log,
      score: calculateAlignmentScore(log, directions).score,
    }))
    .sort((a, b) => b.score - a.score);
}
