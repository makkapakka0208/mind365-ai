/**
 * year-review-mock.ts
 *
 * Two exports:
 * 1) YEAR_REVIEW_MOCK — a ready-to-render mock `YearReviewData` example.
 * 2) adaptFromDailyLogs — convert the app's real DailyLog[] into YearReviewData
 *    so the page works against live localStorage data without a migration.
 */

import { detectActionsByRules } from "@/lib/life-path-rules";
import { calculateAlignmentScoreWeighted, fuseActions } from "@/lib/life-path";
import { loadGoals } from "@/lib/life-path-storage";
import type { DailyLog } from "@/types";
import type {
  YearDayRecord,
  YearGoalProgress,
  YearReviewData,
} from "@/types/year-review";

// ── Mock data example ─────────────────────────────────────────────────────────

function mockRecord(
  date: string,
  mood: number,
  alignmentScore: number,
  studyHours: number,
  wasteHours: number,
  journal: string,
): YearDayRecord {
  return { date, mood, alignmentScore, studyHours, wasteHours, journal };
}

export const YEAR_REVIEW_MOCK: YearReviewData = {
  year: 2026,
  records: [
    mockRecord("2026-01-12", 7, 72, 2.5, 0.5, "开年第一次完整地读完一本书，思路被打开。"),
    mockRecord("2026-02-03", 5, 48, 1.0, 2.5, "状态糟，刷了一下午短视频，晚上很空。"),
    mockRecord("2026-03-21", 8, 85, 3.5, 0.0, "春分，清晨写作，长期坚持终于开始见效。"),
    mockRecord("2026-04-06", 6, 62, 2.0, 1.0, "面试复盘，发现表达结构还能更紧。"),
    mockRecord("2026-05-17", 9, 92, 4.0, 0.0, "完成一个困扰我三个月的技术难点。"),
    mockRecord("2026-06-11", 4, 35, 0.5, 3.0, "和家人吵架，没控制好情绪。"),
    mockRecord("2026-07-22", 7, 74, 2.5, 0.5, "第一次独自出差，意外地平静。"),
    mockRecord("2026-08-30", 8, 81, 3.0, 0.5, "年中回看，方向没跑偏，只是节奏慢。"),
    mockRecord("2026-09-15", 6, 58, 1.5, 2.0, "秋天到了，工作提速，生活节奏打乱。"),
    mockRecord("2026-10-07", 3, 28, 0.0, 4.0, "连续两周失眠，什么都不想做。"),
    mockRecord("2026-11-19", 8, 88, 3.5, 0.0, "把上月的损失补回来了，并没有崩。"),
    mockRecord("2026-12-28", 9, 90, 3.0, 0.0, "一年收尾，情绪平稳，有感恩，没焦虑。"),
  ],
  goals: [
    {
      id: "g-books",
      title: "读完 24 本书",
      startValue: 0,
      currentValue: 19,
      targetValue: 24,
      unit: "本",
    },
    {
      id: "g-save",
      title: "储蓄 ¥120,000",
      startValue: 0,
      currentValue: 96000,
      targetValue: 120000,
      unit: "元",
    },
    {
      id: "g-run",
      title: "全年跑步 500km",
      startValue: 0,
      currentValue: 520,
      targetValue: 500,
      unit: "km",
    },
  ],
};

// ── Live adapter (DailyLog[] → YearReviewData) ────────────────────────────────

/** Rough heuristic for "wasted" hours: tokens in the journal. */
const WASTE_KEYWORDS = [
  "刷",
  "刷视频",
  "短视频",
  "刷手机",
  "摆烂",
  "拖延",
  "浪费",
  "划水",
];

function estimateWasteHours(text: string): number {
  if (!text) return 0;
  const hits = WASTE_KEYWORDS.reduce(
    (acc, k) => acc + (text.includes(k) ? 1 : 0),
    0,
  );
  // Each keyword hit ~ 0.75h, capped at 4h/day.
  return Math.min(4, hits * 0.75);
}

/** Convert live DailyLog[] for a given year into YearReviewData. */
export function adaptFromDailyLogs(
  logs: DailyLog[],
  year: number,
): YearReviewData {
  const yearPrefix = `${year}-`;
  const yearLogs = logs.filter((log) => log.date.startsWith(yearPrefix));

  const records: YearDayRecord[] = yearLogs.map((log) => {
    const rules = detectActionsByRules(log.thoughts || "");
    const fused = fuseActions(rules, []);
    const alignment = calculateAlignmentScoreWeighted(fused);
    return {
      date: log.date,
      mood: log.mood,
      alignmentScore: alignment.score,
      studyHours: log.studyHours,
      wasteHours: estimateWasteHours(log.thoughts),
      journal: log.thoughts || "",
    };
  });

  const goals: YearGoalProgress[] = loadGoals().map((g) => ({
    id: g.id,
    title: g.title,
    startValue: 0,
    currentValue: g.currentValue,
    targetValue: g.targetValue,
  }));

  return { year, records, goals };
}
