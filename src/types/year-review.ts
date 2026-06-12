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

/** 阶段精神状态标签 */
export type PhaseState = "lonely" | "anxious" | "lucid" | "building" | "drifting";

/** 纪录片的一个章节（按时间推进的阶段） */
export interface DocPhase {
  /** 时间段描述，如 "一月 — 三月" */
  period: string;
  /** 章节名，四到八字 */
  title: string;
  state: PhaseState;
  /** 该阶段旁白 */
  narration: string;
}

/** 日记反复出现的关键词及其解读 */
export interface DocKeyword {
  word: string;
  count: number;
  meaning: string;
}

/** AI-generated documentary narration (single call). */
export interface YearSummaryAI {
  /** 开场旁白 */
  opening: string;
  /** 按时间顺序的阶段章节（孤独/焦虑/清醒至少各一） */
  phases: DocPhase[];
  /** 日记高频关键词 + 洞察 */
  keywords: DocKeyword[];
  /** 现实生活状态与压力来源推测 */
  lifeInference: string;
  /** 重建自己的过程分析 */
  rebuilding: string;
  /** 年度关键词 */
  yearKeyword: { word: string; reason: string };
  /** 精神避难所 */
  refuge: string;
  /** 认知升级时刻 */
  upgradeMoments: string[];
  /** 用户最像哪类人 */
  archetype: { title: string; description: string };
  /** 有后劲的结尾文案 */
  ending: string;
}

/** Everything needed to render the page. */
export interface YearReviewModel {
  data: YearReviewData;
  stats: ComputedYearStats;
  ai: YearSummaryAI | null;
}
