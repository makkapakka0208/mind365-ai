/**
 * year-review.ts
 *
 * Types for the Year Review (annual summary) module.
 * Kept independent from the core types so the module can evolve in isolation.
 */

/** One day's raw record, the atomic unit we aggregate over. */
export interface YearDayRecord {
  /** ISO date yyyy-MM-dd */
  date: string;
  /** 1..10 mood score */
  mood: number;
  /** Alignment score 0..100 (how well the day aligned with the user's life direction) */
  alignmentScore: number;
  /** Hours spent on meaningful study / focus */
  studyHours: number;
  /** Hours acknowledged as "wasted" (procrastination, doom-scrolling, etc.) */
  wasteHours: number;
  /** Plain-text journal entry */
  journal: string;
}

/** A goal + its snapshot at year-end. */
export interface YearGoalProgress {
  id: string;
  title: string;
  targetValue: number;
  /** The value at the start of the year */
  startValue: number;
  /** The current/year-end value */
  currentValue: number;
  unit?: string;
}

/** The full payload passed to compute / render / AI. */
export interface YearReviewData {
  year: number;
  records: YearDayRecord[];
  goals: YearGoalProgress[];
}

/** A single "best" or "worst" day surfaced in highlights. */
export interface HighlightDay {
  date: string;
  score: number;
  excerpt: string;
}

/** The deterministic stats derived from YearReviewData. */
export interface ComputedYearStats {
  avgScore: number;
  totalStudyHours: number;
  totalWasteHours: number;
  entries: number;
  bestDays: HighlightDay[];
  worstDays: HighlightDay[];
  /** Monthly trend of avg alignment score (12 points, NaN filled with 0) */
  trend: {
    labels: string[];
    alignment: number[];
    mood: number[];
  };
}

/** AI-generated narrative output (single call, three fields). */
export interface YearSummaryAI {
  summary: string;
  insights: string[];
  suggestions: string[];
}

/** Everything needed to render the page. */
export interface YearReviewModel {
  data: YearReviewData;
  stats: ComputedYearStats;
  ai: YearSummaryAI | null;
}
