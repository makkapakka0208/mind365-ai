"use client";

import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Save } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AiReflectionPanel } from "@/components/review/ai-reflection-panel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import {
  computeSummary,
  getCurrentMonthLogs,
  getCurrentMonthQuotes,
  getCurrentWeekLogs,
  getCurrentWeekQuotes,
  getQuoteReadingHours,
  sortLogsByDate,
} from "@/lib/analytics";
import { getMonthRange, getWeekRange, parseISODate, toISODate } from "@/lib/date";
import { saveReviewReport } from "@/lib/storage";
import { useQuotesStore, useSyncedDailyLogs } from "@/lib/storage-store";
import type { DailyLog, Quote, ReviewReport } from "@/types";

type ReviewMode = "week" | "month";

interface ReviewData {
  logs: DailyLog[];
  range: { start: Date; end: Date };
  title: string;
  headline: string;
}

function getWeekdayLabels() {
  return ["一", "二", "三", "四", "五", "六", "日"];
}

function getMonthHeadline(reference: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(reference);
}

function getWeekHeadline(range: { start: Date; end: Date }) {
  return `${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(range.start)} - ${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(range.end)}`;
}

function getReviewData(allLogs: DailyLog[], mode: ReviewMode): ReviewData {
  if (mode === "week") {
    const range = getWeekRange();
    const logs = sortLogsByDate(getCurrentWeekLogs(allLogs), "asc");
    const weekStart = range.start;
    const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
    const weekNumber = Math.ceil((((weekStart.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);

    return {
      logs,
      range,
      title: `第 ${weekNumber} 周 · 周复盘`,
      headline: getWeekHeadline(range),
    };
  }

  const range = getMonthRange();
  const logs = sortLogsByDate(getCurrentMonthLogs(allLogs), "asc");

  return {
    logs,
    range,
    title: `${range.start.getMonth() + 1} 月 · 月复盘`,
    headline: getMonthHeadline(range.start),
  };
}

function buildCalendarCells(mode: ReviewMode, range: { start: Date; end: Date }, logs: DailyLog[]) {
  const entryByDate = new Map(logs.map((log) => [log.date, log]));

  if (mode === "week") {
    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(range.start);
      current.setDate(range.start.getDate() + index);
      const iso = toISODate(current);

      return {
        iso,
        day: current.getDate(),
        log: entryByDate.get(iso) ?? null,
        placeholder: false,
      };
    });
  }

  const firstDay = new Date(range.start);
  const leading = (firstDay.getDay() + 6) % 7;
  const totalDays = range.end.getDate();
  const cells: Array<{ iso: string; day: number | null; log: DailyLog | null; placeholder: boolean }> = [];

  for (let index = 0; index < leading; index += 1) {
    cells.push({ iso: `empty-${index}`, day: null, log: null, placeholder: true });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const current = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const iso = toISODate(current);
    cells.push({
      iso,
      day,
      log: entryByDate.get(iso) ?? null,
      placeholder: false,
    });
  }

  return cells;
}

function getTopTags(logs: DailyLog[]) {
  const counts = new Map<string, number>();

  logs.forEach((log) => {
    log.tags.forEach((tag) => {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    });
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 8)
    .map(([tag, count]) => ({ tag, count }));
}

function getReadingCollection(quotes: Quote[]) {
  return quotes
    .filter((quote) => quote.book.trim() || quote.text.trim())
    .slice(0, 5)
    .map((quote) => {
      const source = quote.book.trim() ? `${quote.book.trim()}` : quote.text.trim().slice(0, 18);
      const readingHours = getQuoteReadingHours(quote);

      return readingHours > 0 ? `${source} · ${readingHours.toFixed(1)}h` : source;
    });
}

function getSummaryLine(mode: ReviewMode, logs: DailyLog[]) {
  if (logs.length === 0) {
    return mode === "week" ? "本周还没有记录，先写下一条今天的想法。" : "本月还没有记录，先积累几天再回来复盘。";
  }

  const first = logs[0];
  const last = logs[logs.length - 1];
  const start = parseISODate(first.date);
  const end = parseISODate(last.date);

  return `${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(start)} 到 ${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(end)}，你的记录慢慢连成了一条线。`;
}

function getHeatTone(log: DailyLog | null) {
  if (!log) {
    return {
      background: "rgba(139, 94, 60, 0.08)",
      border: "1px solid rgba(139, 94, 60, 0.08)",
      color: "var(--m-ink3)",
    };
  }

  if (log.mood >= 8) {
    return {
      background: "#9b6a42",
      border: "1px solid #9b6a42",
      color: "#fff7ee",
    };
  }

  if (log.mood >= 6) {
    return {
      background: "#b48c69",
      border: "1px solid #b48c69",
      color: "#fff7ee",
    };
  }

  return {
    background: "#d8c0a5",
    border: "1px solid #d8c0a5",
    color: "var(--m-ink)",
  };
}

export default function ReviewHubPage() {
  const { logs: allLogs, isSyncing } = useSyncedDailyLogs();
  const allQuotes = useQuotesStore();
  const [mode, setMode] = useState<ReviewMode>("month");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedMode, setSavedMode] = useState<ReviewMode | null>(null);

  const reviewData = useMemo(() => getReviewData(allLogs, mode), [allLogs, mode]);
  const reviewQuotes = useMemo(
    () => (mode === "week" ? getCurrentWeekQuotes(allQuotes) : getCurrentMonthQuotes(allQuotes)),
    [allQuotes, mode],
  );
  const metrics = useMemo(() => computeSummary(reviewData.logs, reviewQuotes), [reviewData.logs, reviewQuotes]);
  const uniqueDays = useMemo(() => new Set(reviewData.logs.map((log) => log.date)).size, [reviewData.logs]);
  const tags = useMemo(() => getTopTags(reviewData.logs), [reviewData.logs]);
  const readingCollection = useMemo(() => getReadingCollection(reviewQuotes), [reviewQuotes]);
  const calendarCells = useMemo(
    () => buildCalendarCells(mode, reviewData.range, reviewData.logs),
    [mode, reviewData.logs, reviewData.range],
  );

  const onSave = async () => {
    setIsSaving(true);

    const report: ReviewReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      period: mode,
      rangeStart: toISODate(reviewData.range.start),
      rangeEnd: toISODate(reviewData.range.end),
      title: reviewData.title,
      metrics,
      notes: notes.trim(),
    };

    await saveReviewReport(report);
    setIsSaving(false);
    setSavedMode(mode);
  };

  const coreTag = tags[0]?.tag ?? "--";
  const summaryCards = [
    { label: "已记录", value: `${uniqueDays}`, hint: mode === "week" ? "本周天数" : "本月天数" },
    { label: mode === "week" ? "周均心情" : "月均心情", value: metrics.entries ? `${metrics.averageMood}` : "--", hint: "情绪均值" },
    { label: "读书卡片", value: `${readingCollection.length}`, hint: "阅读条目" },
    { label: "核心标签", value: coreTag, hint: "本期主题" },
  ];

  return (
    <PageTransition>
      <div className="mx-auto max-w-[960px] space-y-5">
        <section
          className="rounded-[32px] px-5 py-5 sm:px-7"
          style={{
            background: "linear-gradient(180deg, rgba(253,246,235,0.98), rgba(240,230,211,0.96))",
            border: "1px solid var(--m-rule)",
            boxShadow: "var(--m-shadow-out)",
          }}
        >
          <div className="flex items-center justify-between text-sm" style={{ color: "var(--m-ink3)" }}>
            <span>{new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date())}</span>
            <div className="inline-flex items-center gap-2">
              <Link className="rounded-full p-2" href="/record" style={{ background: "rgba(139,94,60,0.08)" }}>
                <ChevronLeft size={16} />
              </Link>
              <Link className="rounded-full p-2" href="/review-history" style={{ background: "rgba(139,94,60,0.08)" }}>
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px]" style={{ color: "var(--m-ink3)" }}>
                {reviewData.title}
              </p>
              <h1 className="mt-3 text-[2.3rem] leading-none tracking-[-0.04em]" style={{ color: "var(--m-ink)" }}>
                {reviewData.headline}
              </h1>
            </div>
            <span
              className="rounded-full px-3 py-1 text-sm"
              style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
            >
              {reviewData.logs.length ? `${uniqueDays}天 · 进行中` : "等待记录"}
            </span>
          </div>

          <div
            className="mt-5 inline-flex rounded-full p-1"
            style={{ background: "rgba(139,94,60,0.08)", border: "1px solid rgba(139,94,60,0.08)" }}
          >
            {([
              { key: "week", label: "周复盘" },
              { key: "month", label: "月复盘" },
            ] as const).map((item) => (
              <button
                className="rounded-full px-4 py-2 text-sm transition"
                key={item.key}
                onClick={() => setMode(item.key)}
                style={
                  mode === item.key
                    ? {
                        background: "var(--m-accent)",
                        color: "#fff7ee",
                        boxShadow: "0 10px 20px rgba(139,94,60,0.2)",
                      }
                    : {
                        background: "transparent",
                        color: "var(--m-ink2)",
                      }
                }
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          {isSyncing ? (
            <Panel className="mt-5 p-6">正在同步复盘数据...</Panel>
          ) : reviewData.logs.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                description={mode === "week" ? "本周还没有足够的记录，先去写一条今天的日记。" : "本月还没有足够的记录，先去积累几天内容。"}
                icon={CalendarDays}
                illustrationAlt="review illustration"
                illustrationSrc="/illustrations/relaxed-reading.svg"
                title={mode === "week" ? "本周暂无内容" : "本月暂无内容"}
              />
            </div>
          ) : (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {summaryCards.map((card) => (
                  <div
                    className="rounded-[20px] px-3 py-4 text-center"
                    key={card.label}
                    style={{
                      background: "rgba(255,248,238,0.88)",
                      border: "1px solid rgba(139,94,60,0.08)",
                      boxShadow: "var(--m-shadow-out)",
                    }}
                  >
                    <div className="text-[1.65rem] leading-none" style={{ color: "var(--m-accent)" }}>
                      {card.value}
                    </div>
                    <div className="mt-2 text-sm" style={{ color: "var(--m-ink2)" }}>
                      {card.label}
                    </div>
                    <div className="mt-1 text-xs" style={{ color: "var(--m-ink3)" }}>
                      {card.hint}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <AiReflectionPanel
                  emptyMessage={mode === "week" ? "当前无法生成本周 AI 复盘。" : "当前无法生成本月 AI 复盘。"}
                  logs={reviewData.logs}
                  period={mode}
                  range={reviewData.range}
                  summary={metrics}
                  title={mode === "week" ? "本周 AI 复盘" : "本月 AI 复盘"}
                />
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                    CALENDAR · 记录热力图
                  </p>
                  <span className="text-xs" style={{ color: "var(--m-ink3)" }}>
                    {getSummaryLine(mode, reviewData.logs)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs" style={{ color: "var(--m-ink3)" }}>
                  {getWeekdayLabels().map((label) => (
                    <div key={label}>{label}</div>
                  ))}
                </div>

                <div className="mt-3 grid grid-cols-7 gap-2">
                  {calendarCells.map((cell) => (
                    <div
                      className="flex aspect-square items-center justify-center rounded-[14px] text-sm"
                      key={cell.iso}
                      style={cell.placeholder ? { background: "transparent", border: "1px solid transparent" } : getHeatTone(cell.log)}
                    >
                      {cell.day}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-sm tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  MOOD · 情绪走势
                </p>

                <div className="mt-4 space-y-3">
                  {reviewData.logs.map((log) => (
                    <div className="flex items-center gap-3" key={log.id}>
                      <span className="w-10 text-xs" style={{ color: "var(--m-ink3)" }}>
                        {new Intl.DateTimeFormat("zh-CN", { day: "numeric" }).format(parseISODate(log.date))}
                      </span>
                      <div
                        className="h-10 rounded-[14px]"
                        style={{
                          width: `${Math.max(18, log.mood * 9)}%`,
                          background: log.mood >= 8 ? "#9b6a42" : log.mood >= 6 ? "#b48c69" : "#d8c0a5",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t pt-6" style={{ borderColor: "rgba(139,94,60,0.12)" }}>
                <p className="text-sm tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  TAGS · 本期思维标签
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.length ? (
                    tags.map((item) => (
                      <span
                        className="rounded-full px-4 py-2 text-sm"
                        key={item.tag}
                        style={{
                          background: "rgba(139,94,60,0.08)",
                          color: "var(--m-ink2)",
                          border: "1px solid rgba(139,94,60,0.08)",
                        }}
                      >
                        {item.tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm" style={{ color: "var(--m-ink3)" }}>
                      还没有留下标签。
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t pt-6" style={{ borderColor: "rgba(139,94,60,0.12)" }}>
                <p className="text-sm tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  READING · 本期读书合集
                </p>
                <div
                  className="mt-4 rounded-[22px] px-4 py-5 text-[15px] leading-8"
                  style={{
                    background: "rgba(255,248,238,0.88)",
                    border: "1px solid rgba(139,94,60,0.08)",
                    color: "var(--m-ink)",
                  }}
                >
                  {readingCollection.length ? (
                    readingCollection.map((item, index) => <p key={`${item}-${index}`}>· {item}</p>)
                  ) : (
                    <p style={{ color: "var(--m-ink3)" }}>本期还没有读书记录。</p>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t pt-6" style={{ borderColor: "rgba(139,94,60,0.12)" }}>
                <p className="text-sm tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  NOTES · 复盘备注
                </p>
                <Textarea
                  className="mt-4 min-h-28"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder={mode === "week" ? "这周最大的收获、卡点和下周重点是什么？" : "这个月最满意的变化，以及下个月最想稳住的节奏是什么？"}
                  value={notes}
                />

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {savedMode === mode ? (
                    <>
                      <p className="inline-flex items-center gap-2 text-sm" style={{ color: "var(--m-success)" }}>
                        <CheckCircle2 size={16} />
                        这份复盘已经保存到档案。
                      </p>
                      <Link href="/review-history" style={{ color: "var(--m-accent)" }}>
                        去查看
                      </Link>
                    </>
                  ) : (
                    <Button disabled={isSaving} onClick={onSave} variant="primary">
                      <Save className="mr-2" size={16} />
                      {isSaving ? "保存中..." : "保存这份复盘"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
