/**
 * year-review.ts
 *
 * Deterministic aggregation for the Year Review module + AI orchestrator.
 * Zero I/O beyond the single generateYearSummary() fetch call.
 */

import { apiFetch } from "@/lib/api";
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

// ── 日记关键词提取（中文 n-gram 频次统计，无分词库的务实做法）────────────────

/** 纯功能词/时间词：高频但不携带个人信息，不进关键词 */
const KEYWORD_STOPWORDS = new Set([
  "今天", "昨天", "明天", "现在", "时候", "的时候", "有点", "有些", "一些",
  "一个", "什么", "怎么", "这么", "那么", "还是", "就是", "但是", "可是",
  "因为", "所以", "如果", "虽然", "然后", "后来", "已经", "可以", "应该",
  "不过", "其实", "真的", "感觉", "觉得", "可能", "没有", "不是", "这样",
  "那样", "很多", "开始", "继续", "今晚", "上午", "下午", "晚上", "早上",
]);

function isCjk(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

export interface KeywordStat {
  word: string;
  count: number;
}

/**
 * 从全年日记中提取反复出现的词：把文本按非汉字切段，
 * 在段内滑窗收集 2-4 字词，按频次排序并去掉互为子串的冗余。
 */
export function extractKeywordStats(records: YearDayRecord[], max = 12): KeywordStat[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const segments = (r.journal || "").split(/[^一-鿿]+/).filter(Boolean);
    for (const seg of segments) {
      for (let len = 2; len <= 4; len++) {
        for (let i = 0; i + len <= seg.length; i++) {
          const gram = seg.slice(i, i + len);
          if (!isCjk(gram[0])) continue;
          counts.set(gram, (counts.get(gram) ?? 0) + 1);
        }
      }
    }
  }

  const minCount = records.length >= 30 ? 3 : 2;
  const candidates = [...counts.entries()]
    .filter(([word, count]) => count >= minCount && !KEYWORD_STOPWORDS.has(word))
    .sort((a, b) => (b[1] - a[1]) || (b[0].length - a[0].length));

  const picked: KeywordStat[] = [];
  for (const [word, count] of candidates) {
    if (picked.length >= max) break;
    // 与已选词互为子串的视为同一个词，留频次更高（先到）的那个
    if (picked.some((p) => p.word.includes(word) || word.includes(p.word))) continue;
    picked.push({ word, count });
  }
  return picked;
}

// ── 月度聚合 ──────────────────────────────────────────────────────────────────

export interface MonthlyDigest {
  month: number;
  entries: number;
  avgMood: number;
  studyHours: number;
  wasteHours: number;
  readingCards: number;
}

function buildMonthlyDigest(records: YearDayRecord[], quotes: YearReadingCard[]): MonthlyDigest[] {
  const digest: MonthlyDigest[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, entries: 0, avgMood: 0, studyHours: 0, wasteHours: 0, readingCards: 0,
  }));
  const moodSums = new Array(12).fill(0);
  for (const r of records) {
    const m = Number(r.date.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    digest[m].entries += 1;
    digest[m].studyHours = round1(digest[m].studyHours + r.studyHours);
    digest[m].wasteHours = round1(digest[m].wasteHours + r.wasteHours);
    moodSums[m] += r.mood;
  }
  for (const q of quotes) {
    const m = Number(q.createdAt.slice(5, 7)) - 1;
    if (m >= 0 && m <= 11) digest[m].readingCards += 1;
  }
  for (let i = 0; i < 12; i++) {
    digest[i].avgMood = digest[i].entries === 0 ? 0 : round1(moodSums[i] / digest[i].entries);
  }
  return digest;
}

// ── AI orchestrator (SINGLE call) ─────────────────────────────────────────────

/** 阅读卡片（金句）— 喂给 AI 的精简形态 */
export interface YearReadingCard {
  createdAt: string;
  text: string;
  book: string;
  author: string;
}

interface AiPayload {
  year: number;
  stats: ComputedYearStats;
  monthly: MonthlyDigest[];
  keywordStats: KeywordStat[];
  readingCards: YearReadingCard[];
  goals: YearReviewData["goals"];
  /** Trimmed journal excerpts — we don't send the full year of text. */
  journalSamples: { date: string; mood: number; text: string }[];
}

/** 每月取情绪最高/最低各一条日记摘录，全年最多 24 条 */
function sampleJournals(records: YearDayRecord[]): { date: string; mood: number; text: string }[] {
  const byMonth = new Map<number, YearDayRecord[]>();
  for (const r of records) {
    if (!r.journal || !r.journal.trim()) continue;
    const m = Number(r.date.slice(5, 7));
    const list = byMonth.get(m) ?? [];
    list.push(r);
    byMonth.set(m, list);
  }
  const samples: YearDayRecord[] = [];
  for (const list of byMonth.values()) {
    const sorted = [...list].sort((a, b) => b.mood - a.mood);
    samples.push(sorted[0]);
    if (sorted.length > 1) samples.push(sorted[sorted.length - 1]);
  }
  return samples
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 24)
    .map((r) => ({ date: r.date, mood: r.mood, text: excerpt(r.journal, 160) }));
}

function buildPayload(
  data: YearReviewData,
  stats: ComputedYearStats,
  quotes: YearReadingCard[],
): AiPayload {
  return {
    year: data.year,
    stats,
    monthly: buildMonthlyDigest(data.records, quotes),
    keywordStats: extractKeywordStats(data.records),
    readingCards: quotes.slice(0, 16),
    goals: data.goals,
    journalSamples: sampleJournals(data.records),
  };
}

function isValidDocumentary(v: unknown): v is YearSummaryAI {
  if (typeof v !== "object" || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.opening === "string" && r.opening.trim().length > 0 &&
    Array.isArray(r.phases) &&
    Array.isArray(r.keywords) &&
    typeof r.ending === "string"
  );
}

/**
 * Generate the documentary-style year narration. Calls the AI backend
 * **once** and returns the full YearSummaryAI shape.
 *
 * Falls back to a local deterministic narration when AI is unavailable,
 * so the UI never needs to special-case a missing key.
 */
export async function generateYearSummary(
  data: YearReviewData,
  quotes: YearReadingCard[] = [],
): Promise<YearSummaryAI> {
  const stats = computeYearStats(data);
  const payload = buildPayload(data, stats, quotes);

  try {
    const res = await apiFetch("/api/year-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as unknown;
    if (isValidDocumentary(json)) return json;
  } catch {
    // fall through to local narration
  }

  return localFallback(data, stats, payload.keywordStats);
}

/**
 * AI 不可用时的本地旁白：克制、基于真实数字，不装腔。
 */
function localFallback(
  data: YearReviewData,
  stats: ComputedYearStats,
  keywords: KeywordStat[],
): YearSummaryAI {
  const monthly = buildMonthlyDigest(data.records, []);
  const active = monthly.filter((m) => m.entries > 0);
  const lowest = active.length
    ? active.reduce((a, b) => (b.avgMood < a.avgMood ? b : a))
    : null;
  const highest = active.length
    ? active.reduce((a, b) => (b.avgMood > a.avgMood ? b : a))
    : null;
  const netHours = round1(stats.totalStudyHours - stats.totalWasteHours);
  const topWord = keywords[0]?.word ?? "";

  return {
    opening: `${data.year} 年，你留下了 ${stats.entries} 条记录。先听数字自己说话：${stats.totalStudyHours} 小时投入，${stats.totalWasteHours} 小时被你自己标记为消耗，净值 ${netHours > 0 ? "+" : ""}${netHours} 小时。剩下的，藏在那些字里行间。`,
    phases: active.length
      ? [
          ...(lowest
            ? [{
                period: `${lowest.month} 月`,
                title: "情绪最低的月份",
                state: "anxious" as const,
                narration: `${lowest.month} 月平均情绪 ${lowest.avgMood}/10，写了 ${lowest.entries} 条。那个月发生了什么，只有日记知道。`,
              }]
            : []),
          ...(highest && highest !== lowest
            ? [{
                period: `${highest.month} 月`,
                title: "状态最好的月份",
                state: "lucid" as const,
                narration: `${highest.month} 月平均情绪 ${highest.avgMood}/10，学习 ${highest.studyHours} 小时。这是全年的高点。`,
              }]
            : []),
        ]
      : [],
    keywords: keywords.slice(0, 6).map((k) => ({ ...k, meaning: "" })),
    lifeInference: "",
    rebuilding: stats.entries > 0
      ? `全年 ${stats.entries} 次坐下来记录，本身就是一种持续的自我修复。`
      : "",
    yearKeyword: {
      word: topWord || String(data.year),
      reason: topWord ? `它在你的日记里出现了 ${keywords[0].count} 次，频率不会说谎。` : "",
    },
    refuge: "",
    upgradeMoments: [],
    archetype: { title: "", description: "" },
    ending: `${data.year} 年的最后，数字停在这里。明年它们会继续。`,
  };
}
