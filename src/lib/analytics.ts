import { formatShortDate, getMonthRange, getWeekRange, getYearRange, isDateWithinRange } from "@/lib/date";
import type { DailyLog, Quote, TimeEntry } from "@/types";

export interface SummaryMetrics {
  averageMood: number;
  totalReadingHours: number;
  totalStudyHours: number;
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

export function getQuoteReadingHours(quote: Quote): number {
  return Number.isFinite(quote.readingHours) ? Math.max(0, quote.readingHours) : 0;
}

export function getQuoteDate(quote: Quote): string {
  if (Number.isFinite(Date.parse(quote.createdAt))) {
    return quote.createdAt.slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

export function getTimeEntryHours(entries: TimeEntry[], type: TimeEntry["type"]): number {
  return entries
    .filter((entry) => entry.type === type)
    .reduce((sum, entry) => sum + (Number.isFinite(entry.hours) ? Math.max(0, entry.hours) : 0), 0);
}

export function sortLogsByDate(logs: DailyLog[], direction: "asc" | "desc" = "asc"): DailyLog[] {
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

export function computeSummary(logs: DailyLog[], quotes: Quote[] = [], timeEntries: TimeEntry[] = []): SummaryMetrics {
  const quoteReadingTotal = quotes.reduce((sum, quote) => sum + getQuoteReadingHours(quote), 0);
  const loggedStudyTotal = getTimeEntryHours(timeEntries, "study");
  const loggedReadingTotal = getTimeEntryHours(timeEntries, "reading");

  if (logs.length === 0) {
    return {
      averageMood: 0,
      totalReadingHours: Number((quoteReadingTotal + loggedReadingTotal).toFixed(1)),
      totalStudyHours: Number(loggedStudyTotal.toFixed(1)),
      entries: 0,
    };
  }

  const moodTotal = logs.reduce((sum, log) => sum + log.mood, 0);
  const studyTotal = logs.reduce((sum, log) => sum + log.studyHours, 0);
  const legacyReadingTotal = logs.reduce((sum, log) => sum + parseReadingHours(log.reading), 0);
  const readingTotal = legacyReadingTotal + quoteReadingTotal + loggedReadingTotal;

  return {
    averageMood: Number((moodTotal / logs.length).toFixed(1)),
    totalReadingHours: Number(readingTotal.toFixed(1)),
    totalStudyHours: Number((studyTotal + loggedStudyTotal).toFixed(1)),
    entries: logs.length,
  };
}

export function buildChartSeries(logs: DailyLog[], selector: (log: DailyLog) => number): ChartSeries {
  const sorted = sortLogsByDate(logs, "asc");

  if (sorted.length === 0) {
    return {
      labels: ["暂无数据"],
      data: [0],
    };
  }

  return {
    labels: sorted.map((log) => formatShortDate(log.date)),
    data: sorted.map(selector),
  };
}

export function buildTimeEntryChartSeries(entries: TimeEntry[], type: TimeEntry["type"]): ChartSeries {
  const aggregate = new Map<string, number>();

  entries
    .filter((entry) => entry.type === type)
    .forEach((entry) => {
      aggregate.set(entry.date, (aggregate.get(entry.date) ?? 0) + Math.max(0, entry.hours));
    });

  const rows = [...aggregate.entries()].sort(([left], [right]) => left.localeCompare(right));
  if (rows.length === 0) return { labels: ["暂无数据"], data: [0] };
  return {
    labels: rows.map(([date]) => formatShortDate(date)),
    data: rows.map(([, value]) => Number(value.toFixed(1))),
  };
}

export function buildStudyChartSeries(logs: DailyLog[], timeEntries: TimeEntry[] = []): ChartSeries {
  const aggregate = new Map<string, number>();

  logs.forEach((log) => {
    aggregate.set(log.date, (aggregate.get(log.date) ?? 0) + log.studyHours);
  });
  timeEntries
    .filter((entry) => entry.type === "study")
    .forEach((entry) => {
      aggregate.set(entry.date, (aggregate.get(entry.date) ?? 0) + Math.max(0, entry.hours));
    });

  const rows = [...aggregate.entries()].sort(([left], [right]) => left.localeCompare(right));
  if (rows.length === 0) return { labels: ["暂无数据"], data: [0] };
  return {
    labels: rows.map(([date]) => formatShortDate(date)),
    data: rows.map(([, value]) => Number(value.toFixed(1))),
  };
}

export function buildReadingChartSeries(logs: DailyLog[], quotes: Quote[], timeEntries: TimeEntry[] = []): ChartSeries {
  const aggregate = new Map<string, number>();

  logs.forEach((log) => {
    aggregate.set(log.date, (aggregate.get(log.date) ?? 0) + parseReadingHours(log.reading));
  });

  quotes.forEach((quote) => {
    const date = getQuoteDate(quote);
    aggregate.set(date, (aggregate.get(date) ?? 0) + getQuoteReadingHours(quote));
  });
  timeEntries
    .filter((entry) => entry.type === "reading")
    .forEach((entry) => {
      aggregate.set(entry.date, (aggregate.get(entry.date) ?? 0) + Math.max(0, entry.hours));
    });

  const entries = [...aggregate.entries()].sort(([left], [right]) => left.localeCompare(right));

  if (entries.length === 0) {
    return {
      labels: ["暂无数据"],
      data: [0],
    };
  }

  return {
    labels: entries.map(([date]) => formatShortDate(date)),
    data: entries.map(([, value]) => Number(value.toFixed(1))),
  };
}

export function getCurrentWeekLogs(logs: DailyLog[], reference: Date = new Date()): DailyLog[] {
  const { end, start } = getWeekRange(reference);
  return logs.filter((log) => isDateWithinRange(log.date, start, end));
}

export function getCurrentMonthLogs(logs: DailyLog[], reference: Date = new Date()): DailyLog[] {
  const { end, start } = getMonthRange(reference);
  return logs.filter((log) => isDateWithinRange(log.date, start, end));
}

export function getCurrentYearLogs(logs: DailyLog[], reference: Date = new Date()): DailyLog[] {
  const { end, start } = getYearRange(reference);
  return logs.filter((log) => isDateWithinRange(log.date, start, end));
}

export function getCurrentWeekQuotes(quotes: Quote[], reference: Date = new Date()): Quote[] {
  const { end, start } = getWeekRange(reference);
  return quotes.filter((quote) => isDateWithinRange(getQuoteDate(quote), start, end));
}

export function getCurrentWeekTimeEntries(entries: TimeEntry[], reference: Date = new Date()): TimeEntry[] {
  const { end, start } = getWeekRange(reference);
  return entries.filter((entry) => isDateWithinRange(entry.date, start, end));
}

export function getCurrentMonthTimeEntries(entries: TimeEntry[], reference: Date = new Date()): TimeEntry[] {
  const { end, start } = getMonthRange(reference);
  return entries.filter((entry) => isDateWithinRange(entry.date, start, end));
}

export function getCurrentYearTimeEntries(entries: TimeEntry[], reference: Date = new Date()): TimeEntry[] {
  const { end, start } = getYearRange(reference);
  return entries.filter((entry) => isDateWithinRange(entry.date, start, end));
}

export function getCurrentMonthQuotes(quotes: Quote[], reference: Date = new Date()): Quote[] {
  const { end, start } = getMonthRange(reference);
  return quotes.filter((quote) => isDateWithinRange(getQuoteDate(quote), start, end));
}

export function getCurrentYearQuotes(quotes: Quote[], reference: Date = new Date()): Quote[] {
  const { end, start } = getYearRange(reference);
  return quotes.filter((quote) => isDateWithinRange(getQuoteDate(quote), start, end));
}
