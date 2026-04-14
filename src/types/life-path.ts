/**
 * life-path.ts
 *
 * Type definitions for the Life Path System.
 *
 * Deliberately kept separate from the core Mind365 types (index.ts)
 * so this module can evolve independently and be tree-shaken if unused.
 */

// ── Goal ──────────────────────────────────────────────────────────────────────

/** A single quantifiable life goal the user is working toward. */
export interface UserGoal {
  id: string;

  /** Human-readable name, e.g. "Save $1,000,000" */
  title: string;

  /** The numeric milestone to reach, e.g. 1_000_000 */
  targetValue: number;

  /** How far the user has already progressed, e.g. 230_000 */
  currentValue: number;

  /**
   * Optional deadline as an ISO date string (yyyy-MM-dd).
   * Omit when the goal has no time constraint.
   */
  deadline?: string;
}

// ── Life Direction ─────────────────────────────────────────────────────────────

/**
 * A life direction (theme/pillar) that groups related behaviors.
 * Examples: "Wealth", "Health", "Relationships", "Learning".
 */
export interface LifeDirection {
  id: string;

  /** Display name of this direction, e.g. "Wealth" */
  name: string;

  /**
   * Keywords representing actions that move the user *toward* this direction.
   * Matched case-insensitively against daily log content.
   * e.g. ["study", "read", "exercise"]
   */
  positiveActions: string[];

  /**
   * Keywords representing actions that move the user *away from* this direction.
   * e.g. ["scrolling", "procrastinate", "binge"]
   */
  negativeActions: string[];
}

// ── Daily Log (Life Path variant) ─────────────────────────────────────────────

/**
 * A daily reflection entry enriched with extracted behavioral signals.
 * This is the Life Path variant; it is distinct from the core DailyLog
 * in index.ts to keep concerns separated.
 */
export interface LifePathLog {
  id: string;

  /** ISO date string (yyyy-MM-dd) of when this log was written */
  date: string;

  /** Free-form journal content written by the user */
  content: string;

  /**
   * Action keywords extracted from `content`.
   * Populated by `detectActions()` or by external NLP / AI analysis.
   */
  detectedActions: string[];
}

// ── Result shapes ─────────────────────────────────────────────────────────────

/** Per-direction scoring breakdown inside an AlignmentResult. */
export interface DirectionBreakdown {
  directionId: string;
  directionName: string;

  /** Positive keywords found in this direction */
  positiveHits: string[];

  /** Negative keywords found in this direction */
  negativeHits: string[];

  /** Net point delta for this direction (positive − negative) */
  delta: number;
}

/** The full result returned by `calculateAlignmentScore()`. */
export interface AlignmentResult {
  /**
   * Final alignment score clamped to [0, 100].
   * 50 = perfectly neutral; >50 = net positive day; <50 = net negative day.
   */
  score: number;

  /** All positive action keywords that were matched */
  positiveMatches: string[];

  /** All negative action keywords that were matched */
  negativeMatches: string[];

  /** Per-direction breakdown, useful for building detailed UI */
  breakdown: DirectionBreakdown[];
}

/** The result returned by `calculateGoalProgress()`. */
export interface GoalProgress {
  /** Progress as a fraction in [0, 1] */
  fraction: number;

  /** Progress as a whole percentage in [0, 100] */
  percentage: number;

  /** How much more is needed to reach the target */
  remaining: number;

  /** True once currentValue >= targetValue */
  isCompleted: boolean;

  /**
   * Calendar days until the deadline (can be negative if overdue).
   * null when no deadline was set.
   */
  daysLeft: number | null;
}
