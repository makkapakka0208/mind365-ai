import { formatShortDate, getMonthRange, getWeekRange, isDateWithinRange } from "@/lib/date";
import type { DailyLog } from "@/types";

export interface SummaryMetrics {
  averageMood: number;
  totalStudyHours: number;
  totalReadingHours: number;
  entries: number;
}

export interface ChartSeries {
  labels: string[];
  data: number[];
}

export function parseReadingHours(reading: string): number {
  const match = reading.match(/\d+(\.\d+)?/);

  if (!match) {
    return 0;
  }

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : 0;
}

export function sortLogsByDate(
  logs: DailyLog[],
  direction: "asc" | "desc" = "asc",
): DailyLog[] {
  const sorted = [...logs].sort((a, b) => {
    if (a.date === b.date) {
      if (a.createdAt === b.createdAt) {
        return a.id.localeCompare(b.id);
      }

      return a.createdAt.localeCompare(b.createdAt);
    }

    return a.date.localeCompare(b.date);
  });

  return direction === "asc" ? sorted : sorted.reverse();
}

export function computeSummary(logs: DailyLog[]): SummaryMetrics {
  if (logs.length === 0) {
    return {
      averageMood: 0,
      totalStudyHours: 0,
      totalReadingHours: 0,
      entries: 0,
    };
  }

  const moodTotal = logs.reduce((sum, log) => sum + log.mood, 0);
  const studyTotal = logs.reduce((sum, log) => sum + log.studyHours, 0);
  const readingTotal = logs.reduce(
    (sum, log) => sum + parseReadingHours(log.reading),
    0,
  );

  return {
    averageMood: Number((moodTotal / logs.length).toFixed(1)),
    totalStudyHours: Number(studyTotal.toFixed(1)),
    totalReadingHours: Number(readingTotal.toFixed(1)),
    entries: logs.length,
  };
}

export function buildChartSeries(
  logs: DailyLog[],
  selector: (log: DailyLog) => number,
): ChartSeries {
  const sorted = sortLogsByDate(logs, "asc");

  if (sorted.length === 0) {
    return {
      labels: ["No Data"],
      data: [0],
    };
  }

  return {
    labels: sorted.map((log) => formatShortDate(log.date)),
    data: sorted.map(selector),
  };
}

export function getCurrentWeekLogs(
  logs: DailyLog[],
  reference: Date = new Date(),
): DailyLog[] {
  const { start, end } = getWeekRange(reference);
  return logs.filter((log) => isDateWithinRange(log.date, start, end));
}

export function getCurrentMonthLogs(
  logs: DailyLog[],
  reference: Date = new Date(),
): DailyLog[] {
  const { start, end } = getMonthRange(reference);
  return logs.filter((log) => isDateWithinRange(log.date, start, end));
}




