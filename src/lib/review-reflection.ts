import { parseReadingHours } from "@/lib/analytics";
import { toISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

export type ReviewPeriod = "week" | "month" | "year";

type StoredReviewBucket = "weekly" | "monthly" | "yearly";

interface ReviewBucketMap {
  weekly: Record<string, string>;
  monthly: Record<string, string>;
  yearly: Record<string, string>;
}

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

const REVIEW_STORAGE_KEY = "reviews";

function createEmptyReviews(): ReviewBucketMap {
  return {
    weekly: {},
    monthly: {},
    yearly: {},
  };
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.values(value).every((item) => typeof item === "string")
    : false;
}

function normalizeStoredReviews(value: unknown): ReviewBucketMap {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return createEmptyReviews();
  }

  const record = value as Record<string, unknown>;

  return {
    weekly: isStringRecord(record.weekly) ? record.weekly : {},
    monthly: isStringRecord(record.monthly) ? record.monthly : {},
    yearly: isStringRecord(record.yearly) ? record.yearly : {},
  };
}

function getReviewBucket(period: ReviewPeriod): StoredReviewBucket {
  if (period === "week") {
    return "weekly";
  }

  if (period === "month") {
    return "monthly";
  }

  return "yearly";
}

function readStoredReviews(): ReviewBucketMap {
  if (typeof window === "undefined") {
    return createEmptyReviews();
  }

  const raw = window.localStorage.getItem(REVIEW_STORAGE_KEY);

  if (!raw) {
    return createEmptyReviews();
  }

  try {
    return normalizeStoredReviews(JSON.parse(raw) as unknown);
  } catch {
    return createEmptyReviews();
  }
}

function writeStoredReviews(reviews: ReviewBucketMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
}

export function getCurrentWeekKey(reference: Date = new Date()): string {
  const utcDate = new Date(Date.UTC(reference.getFullYear(), reference.getMonth(), reference.getDate()));
  const day = utcDate.getUTCDay() || 7;

  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);

  const isoYear = utcDate.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

  return `${isoYear}-W${String(weekNumber).padStart(2, "0")}`;
}

export function getCurrentMonthKey(reference: Date = new Date()): string {
  return `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}`;
}

export function getCurrentYearKey(reference: Date = new Date()): string {
  return String(reference.getFullYear());
}

export function getCurrentReviewKey(period: ReviewPeriod, reference: Date = new Date()): string {
  if (period === "week") {
    return getCurrentWeekKey(reference);
  }

  if (period === "month") {
    return getCurrentMonthKey(reference);
  }

  return getCurrentYearKey(reference);
}

export function getSavedReview(period: ReviewPeriod, reference: Date = new Date()): string {
  const bucket = getReviewBucket(period);
  const key = getCurrentReviewKey(period, reference);
  const reviews = readStoredReviews();

  return reviews[bucket][key] ?? "";
}

export function saveReview(period: ReviewPeriod, reflection: string, reference: Date = new Date()): string {
  const bucket = getReviewBucket(period);
  const key = getCurrentReviewKey(period, reference);
  const reviews = readStoredReviews();

  reviews[bucket][key] = reflection;
  writeStoredReviews(reviews);

  return key;
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
