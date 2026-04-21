/**
 * year-review.ts
 *
 * Deterministic aggregation for the Year Review module + AI orchestrator.
 * Zero I/O beyond the single generateYearSummary() fetch call.
 */

import type {
  ComputedYearStats,
  HighlightDay,
  YearDayRecord,
  YearReviewData,
  YearSummaryAI,
} from "@/types/year-review";

// ── Helpers ───────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function excerpt(text: string, max = 80): string {
  const clean = (text || "").trim().replace(/\s+/g, " ");
  if (!clean) return "（空白的一天）";
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function toHighlight(r: YearDayRecord): HighlightDay {
  return {
    date: r.date,
    score: r.alignmentScore,
    excerpt: excerpt(r.journal),
  };
}

// ── Core aggregation ──────────────────────────────────────────────────────────

/**
 * Compute all year stats in one pass. Pure & deterministic.
 * Empty input returns a well-formed zero-state (no NaNs).
 */
export function computeYearStats(data: YearReviewData): ComputedYearStats {
  const records = data.records;
  const n = records.length;

  if (n === 0) {
    return {
      avgScore: 0,
      totalStudyHours: 0,
      totalWasteHours: 0,
      entries: 0,
      bestDays: [],
      worstDays: [],
      trend: {
        labels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
        alignment: new Array(12).fill(0),
        mood: new Array(12).fill(0),
      },
    };
  }

  let scoreSum = 0;
  let studySum = 0;
  let wasteSum = 0;

  const monthAlignSum = new Array(12).fill(0);
  const monthMoodSum = new Array(12).fill(0);
  const monthCount = new Array(12).fill(0);

  for (const r of records) {
    scoreSum += r.alignmentScore;
    studySum += r.studyHours;
    wasteSum += r.wasteHours;

    const m = Number(r.date.slice(5, 7)) - 1;
    if (m >= 0 && m < 12) {
      monthAlignSum[m] += r.alignmentScore;
      monthMoodSum[m] += r.mood;
      monthCount[m] += 1;
    }
  }

  const sortedByScoreDesc = [...records].sort(
    (a, b) => b.alignmentScore - a.alignmentScore,
  );
  const bestDays = sortedByScoreDesc.slice(0, 5).map(toHighlight);
  const worstDays = sortedByScoreDesc.slice(-5).reverse().map(toHighlight);

  const alignment = monthAlignSum.map((sum, i) =>
    monthCount[i] === 0 ? 0 : round1(sum / monthCount[i]),
  );
  const mood = monthMoodSum.map((sum, i) =>
    monthCount[i] === 0 ? 0 : round1(sum / monthCount[i]),
  );

  return {
    avgScore: round1(scoreSum / n),
    totalStudyHours: round1(studySum),
    totalWasteHours: round1(wasteSum),
    entries: n,
    bestDays,
    worstDays,
    trend: {
      labels: Array.from({ length: 12 }, (_, i) => `${i + 1}月`),
      alignment,
      mood,
    },
  };
}

// ── AI orchestrator (SINGLE call) ─────────────────────────────────────────────

interface AiPayload {
  year: number;
  stats: ComputedYearStats;
  goals: YearReviewData["goals"];
  /** Trimmed journal excerpts — we don't send the full year of text. */
  journalSamples: { date: string; text: string }[];
}

function buildPayload(data: YearReviewData, stats: ComputedYearStats): AiPayload {
  // Sample strategy: best 3 + worst 3 + random 6 = up to 12 excerpts.
  const pool = data.records.filter((r) => r.journal && r.journal.trim().length > 0);
  const sorted = [...pool].sort((a, b) => b.alignmentScore - a.alignmentScore);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3);
  const rest = pool.filter((r) => !top3.includes(r) && !bottom3.includes(r));
  const random6 = rest
    .map((r) => ({ r, k: Math.random() }))
    .sort((a, b) => a.k - b.k)
    .slice(0, 6)
    .map((x) => x.r);

  const samples = [...top3, ...bottom3, ...random6].map((r) => ({
    date: r.date,
    text: excerpt(r.journal, 160),
  }));

  return {
    year: data.year,
    stats,
    goals: data.goals,
    journalSamples: samples,
  };
}

/**
 * Generate the narrative year summary. Calls the AI backend **once**
 * and returns `{ summary, insights, suggestions }`.
 *
 * Falls back to a local deterministic summary when AI is unavailable,
 * so the UI never needs to special-case a missing key.
 */
export async function generateYearSummary(
  data: YearReviewData,
): Promise<YearSummaryAI> {
  const stats = computeYearStats(data);
  const payload = buildPayload(data, stats);

  try {
    const res = await fetch("/api/year-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as Partial<YearSummaryAI> & {
      available?: boolean;
    };

    if (
      json &&
      typeof json.summary === "string" &&
      Array.isArray(json.insights) &&
      Array.isArray(json.suggestions)
    ) {
      return {
        summary: json.summary,
        insights: json.insights.filter((s): s is string => typeof s === "string"),
        suggestions: json.suggestions.filter(
          (s): s is string => typeof s === "string",
        ),
      };
    }
  } catch {
    // fall through to local summary
  }

  return localFallback(data, stats);
}

function localFallback(
  data: YearReviewData,
  stats: ComputedYearStats,
): YearSummaryAI {
  const netHours = stats.totalStudyHours - stats.totalWasteHours;
  const goalPct =
    data.goals.length === 0
      ? 0
      : Math.round(
          (data.goals.reduce(
            (acc, g) =>
              acc +
              Math.min(
                1,
                Math.max(
                  0,
                  (g.currentValue - g.startValue) /
                    Math.max(1, g.targetValue - g.startValue),
                ),
              ),
            0,
          ) /
            data.goals.length) *
            100,
        );

  return {
    summary: `${data.year} 年你记录了 ${stats.entries} 天，平均对齐分 ${stats.avgScore}，有效投入 ${stats.totalStudyHours} 小时、消耗 ${stats.totalWasteHours} 小时，净值 ${netHours > 0 ? "+" : ""}${round1(netHours)} 小时。目标平均完成度约 ${goalPct}%。`,
    insights: [
      stats.avgScore >= 60
        ? "整体方向稳定，能把多数日子推向目标。"
        : "对齐分偏低，多数日子在原地打转，节奏没被组织起来。",
      netHours >= 0
        ? "有效投入盖过了浪费时间，复利开始形成。"
        : "浪费时间超过有效投入，注意力账本目前是赤字。",
    ],
    suggestions: [
      "明年把一周的「最佳 1 天」的结构复制 3 天，就能直接把均值抬起来。",
      "对浪费时间的来源做一次取证：不是戒掉，是换一个同等回报的替代动作。",
    ],
  };
}
