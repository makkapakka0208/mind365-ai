import { parseReadingHours } from "@/lib/analytics";
import { toISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

export type ReviewPeriod = "week" | "month" | "year";

export interface ReviewResponse {
  available?: boolean;
  message?: string;
  reflection?: string | null;
}

export interface ReviewSummary {
  averageMood: number;
  entries: number;
  totalReadingHours: number;
  totalStudyHours: number;
}

export function buildReviewPayload(
  period: ReviewPeriod,
  logs: DailyLog[],
  range: { end: Date; start: Date },
  summary: ReviewSummary,
) {
  return {
    entries: logs.map((log) => ({
      date: log.date,
      emotionScore: log.mood,
      journalText: log.thoughts,
      readingHours: parseReadingHours(log.reading),
      studyHours: log.studyHours,
    })),
    period,
    range: {
      end: toISODate(range.end),
      start: toISODate(range.start),
    },
    summary,
  };
}

export async function requestAiReflection(
  period: ReviewPeriod,
  logs: DailyLog[],
  range: { end: Date; start: Date },
  summary: ReviewSummary,
): Promise<ReviewResponse> {
  const response = await fetch("/api/ai-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildReviewPayload(period, logs, range, summary)),
  });

  const data = (await response.json()) as ReviewResponse;

  if (!response.ok) {
    return {
      available: false,
      message: data.message ?? "AI 复盘生成失败。",
      reflection: null,
    };
  }

  return data;
}

