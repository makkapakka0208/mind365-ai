"use client";

import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";
import {
  BookOpen,
  CalendarCheck,
  GraduationCap,
  Lightbulb,
  Smile,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Chart, Doughnut } from "react-chartjs-2";

import "@/components/charts/chart-registry";
import { parseReadingHours } from "@/lib/analytics";
import { parseISODate, toISODate } from "@/lib/date";
import type { DailyLog, Quote, TimeEntry } from "@/types";

type Range = "7d" | "30d" | "90d" | "all";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
  { value: "90d", label: "近 90 天" },
  { value: "all", label: "全部时间" },
];

interface CombinedTrendChartProps {
  logs: DailyLog[];
  quotes: Quote[];
  timeEntries?: TimeEntry[];
}

interface DayPoint {
  date: string;
  mood: number | null;
  study: number;
  reading: number;
}

const WEEKDAY_SHORT = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function buildSeries(logs: DailyLog[], quotes: Quote[], timeEntries: TimeEntry[], range: Range): DayPoint[] {
  if (logs.length === 0 && quotes.length === 0 && timeEntries.length === 0) return [];

  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const firstLogDate = sortedLogs[0]?.date;
  const firstQuoteDate = [...quotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.createdAt.slice(0, 10);
  const firstTimeEntryDate = [...timeEntries].sort((a, b) => a.date.localeCompare(b.date))[0]?.date;
  const earliest = [firstLogDate, firstQuoteDate, firstTimeEntryDate].filter(Boolean).sort()[0]!;

  const today = new Date();
  let start: Date;
  if (range === "7d") {
    start = new Date(today);
    start.setDate(today.getDate() - 6);
  } else if (range === "30d") {
    start = new Date(today);
    start.setDate(today.getDate() - 29);
  } else if (range === "90d") {
    start = new Date(today);
    start.setDate(today.getDate() - 89);
  } else {
    start = parseISODate(earliest);
  }

  const moodSum = new Map<string, { sum: number; count: number }>();
  const studySum = new Map<string, number>();
  const readingSum = new Map<string, number>();

  for (const log of logs) {
    if (log.date < toISODate(start)) continue;
    const m = moodSum.get(log.date) ?? { sum: 0, count: 0 };
    m.sum += log.mood;
    m.count += 1;
    moodSum.set(log.date, m);
    studySum.set(log.date, (studySum.get(log.date) ?? 0) + log.studyHours);
    readingSum.set(log.date, (readingSum.get(log.date) ?? 0) + parseReadingHours(log.reading));
  }
  for (const q of quotes) {
    const date = q.createdAt.slice(0, 10);
    if (date < toISODate(start)) continue;
    readingSum.set(date, (readingSum.get(date) ?? 0) + (Number.isFinite(q.readingHours) ? Math.max(0, q.readingHours) : 0));
  }
  for (const entry of timeEntries) {
    if (entry.date < toISODate(start)) continue;
    const target = entry.type === "study" ? studySum : readingSum;
    target.set(entry.date, (target.get(entry.date) ?? 0) + Math.max(0, entry.hours));
  }

  const out: DayPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(0, 0, 0, 0);

  while (cursor.getTime() <= end.getTime()) {
    const iso = toISODate(cursor);
    const m = moodSum.get(iso);
    out.push({
      date: iso,
      mood: m ? Number((m.sum / m.count).toFixed(2)) : null,
      study: Number((studySum.get(iso) ?? 0).toFixed(2)),
      reading: Number((readingSum.get(iso) ?? 0).toFixed(2)),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

function formatTickLabel(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}`;
}

/* ── Stat helpers ── */
function computeStats(series: DayPoint[], prevSeries: DayPoint[]) {
  const moods = series.filter((p) => p.mood !== null).map((p) => p.mood!);
  const avgMood = moods.length ? Number((moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)) : 0;
  const totalStudy = Number(series.reduce((s, p) => s + p.study, 0).toFixed(1));
  const totalReading = Number(series.reduce((s, p) => s + p.reading, 0).toFixed(1));
  const recordDays = series.filter((p) => p.mood !== null || p.study > 0 || p.reading > 0).length;

  const prevMoods = prevSeries.filter((p) => p.mood !== null).map((p) => p.mood!);
  const prevAvgMood = prevMoods.length ? Number((prevMoods.reduce((a, b) => a + b, 0) / prevMoods.length).toFixed(1)) : 0;
  const prevTotalStudy = Number(prevSeries.reduce((s, p) => s + p.study, 0).toFixed(1));
  const prevTotalReading = Number(prevSeries.reduce((s, p) => s + p.reading, 0).toFixed(1));
  const prevRecordDays = prevSeries.filter((p) => p.mood !== null || p.study > 0 || p.reading > 0).length;

  return {
    avgMood,
    totalStudy,
    totalReading,
    recordDays,
    deltaMood: Number((avgMood - prevAvgMood).toFixed(1)),
    deltaStudy: Number((totalStudy - prevTotalStudy).toFixed(1)),
    deltaReading: Number((totalReading - prevTotalReading).toFixed(1)),
    deltaRecordDays: recordDays - prevRecordDays,
  };
}

function buildPrevSeries(logs: DailyLog[], quotes: Quote[], timeEntries: TimeEntry[], range: Range): DayPoint[] {
  if (range === "all") return [];
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const prevRange = range; // same window size
  // Build a fake range shifted back by `days`
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - days * 2 + 1);
  const end = new Date(today);
  end.setDate(today.getDate() - days);

  const moodSum = new Map<string, { sum: number; count: number }>();
  const studySum = new Map<string, number>();
  const readingSum = new Map<string, number>();

  const startIso = toISODate(start);
  const endIso = toISODate(end);

  for (const log of logs) {
    if (log.date < startIso || log.date > endIso) continue;
    const m = moodSum.get(log.date) ?? { sum: 0, count: 0 };
    m.sum += log.mood; m.count += 1;
    moodSum.set(log.date, m);
    studySum.set(log.date, (studySum.get(log.date) ?? 0) + log.studyHours);
    readingSum.set(log.date, (readingSum.get(log.date) ?? 0) + parseReadingHours(log.reading));
  }
  for (const q of quotes) {
    const date = q.createdAt.slice(0, 10);
    if (date < startIso || date > endIso) continue;
    readingSum.set(date, (readingSum.get(date) ?? 0) + (Number.isFinite(q.readingHours) ? Math.max(0, q.readingHours) : 0));
  }
  for (const entry of timeEntries) {
    if (entry.date < startIso || entry.date > endIso) continue;
    const target = entry.type === "study" ? studySum : readingSum;
    target.set(entry.date, (target.get(entry.date) ?? 0) + Math.max(0, entry.hours));
  }

  const out: DayPoint[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    const iso = toISODate(cursor);
    const m = moodSum.get(iso);
    out.push({
      date: iso,
      mood: m ? Number((m.sum / m.count).toFixed(2)) : null,
      study: Number((studySum.get(iso) ?? 0).toFixed(2)),
      reading: Number((readingSum.get(iso) ?? 0).toFixed(2)),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/* ── Distribution helpers ── */
function moodDistribution(series: DayPoint[]) {
  const moods = series.filter((p) => p.mood !== null).map((p) => p.mood!);
  const high = moods.filter((m) => m >= 7).length;
  const mid = moods.filter((m) => m >= 4 && m < 7).length;
  const low = moods.filter((m) => m < 4).length;
  const total = moods.length || 1;
  return {
    labels: ["积极 (7-10)", "平稳 (4-6)", "低落 (0-3)"],
    values: [high, mid, low],
    pcts: [Math.round(high / total * 100), Math.round(mid / total * 100), Math.round(low / total * 100)],
    colors: ["rgba(139,94,60,0.7)", "rgba(139,94,60,0.35)", "rgba(139,94,60,0.15)"],
  };
}

function studyDistribution(series: DayPoint[]) {
  const days = series.filter((p) => p.study > 0);
  const high = days.filter((d) => d.study >= 3).length;
  const mid = days.filter((d) => d.study >= 1 && d.study < 3).length;
  const low = days.filter((d) => d.study > 0 && d.study < 1).length;
  const total = days.length || 1;
  return {
    labels: ["高效 (≥3h)", "专注 (1-3h)", "较少 (<1h)"],
    values: [high, mid, low],
    pcts: [Math.round(high / total * 100), Math.round(mid / total * 100), Math.round(low / total * 100)],
    colors: ["rgba(179,98,58,0.72)", "rgba(179,98,58,0.42)", "rgba(179,98,58,0.18)"],
  };
}

function readingDistribution(series: DayPoint[]) {
  const days = series.filter((p) => p.reading > 0);
  const high = days.filter((d) => d.reading >= 2).length;
  const mid = days.filter((d) => d.reading >= 1 && d.reading < 2).length;
  const low = days.filter((d) => d.reading > 0 && d.reading < 1).length;
  const total = days.length || 1;
  return {
    labels: ["≥2h", "1-2h", "<1h"],
    values: [high, mid, low],
    pcts: [Math.round(high / total * 100), Math.round(mid / total * 100), Math.round(low / total * 100)],
    colors: ["rgba(212,160,124,0.72)", "rgba(212,160,124,0.42)", "rgba(212,160,124,0.18)"],
  };
}

/* ── Insight generator ── */
function generateInsight(series: DayPoint[]): string {
  const moods = series.filter((p) => p.mood !== null);
  if (moods.length < 3) return "继续记录几天，趋势洞察会在这里出现。";

  // Find best mood day
  let bestDay = moods[0];
  for (const p of moods) {
    if (p.mood! > bestDay.mood!) bestDay = p;
  }

  // Find highest study day
  const studyDays = series.filter((p) => p.study > 0);
  let bestStudyDay = studyDays[0];
  for (const p of studyDays) {
    if (p.study > (bestStudyDay?.study ?? 0)) bestStudyDay = p;
  }

  // Check if mood correlates with study
  const withStudy = moods.filter((p) => p.study > 1);
  const withoutStudy = moods.filter((p) => p.study <= 1);
  const avgWithStudy = withStudy.length ? withStudy.reduce((s, p) => s + p.mood!, 0) / withStudy.length : 0;
  const avgWithoutStudy = withoutStudy.length ? withoutStudy.reduce((s, p) => s + p.mood!, 0) / withoutStudy.length : 0;

  if (avgWithStudy - avgWithoutStudy > 1 && withStudy.length >= 2) {
    return `学习投入较多的日子，你的情绪平均高出 ${(avgWithStudy - avgWithoutStudy).toFixed(1)} 分。保持这个节奏，你会走得更远。`;
  }

  if (bestStudyDay && bestDay) {
    const bd = parseISODate(bestDay.date);
    return `你在 ${bd.getMonth() + 1}/${bd.getDate()} 情绪最佳（${bestDay.mood}/10），当天学习 ${bestDay.study.toFixed(1)}h。保持这个节奏，你会走得更远。`;
  }

  return "保持记录的习惯，数据会慢慢帮你看见自己的成长节奏。";
}

/* ── Stat card (v5 refined: tinted icon chip + delta footer) ── */
function StatCard({ icon: Icon, label, value, unit, delta, deltaUnit, accent }: {
  icon: typeof Smile;
  label: string;
  value: string;
  unit: string;
  delta: number;
  deltaUnit?: string;
  accent: string;
}) {
  const isUp = delta > 0;
  const isDown = delta < 0;
  return (
    <div
      className="relative flex flex-col"
      style={{
        gap: 14,
        padding: "22px 22px 20px",
        borderRadius: 20,
        background: "var(--v5-card)",
        border: "1px solid var(--v5-rule)",
        boxShadow: "var(--v5-sh-2)",
      }}
    >
      <div className="flex items-center justify-between">
        <span
          style={{
            fontFamily: "var(--v5-sans)",
            fontSize: 10.5,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--v5-ink3)",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <div
          className="grid place-items-center"
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: `color-mix(in oklab, ${accent}, transparent 88%)`,
            border: `1px solid color-mix(in oklab, ${accent}, transparent 72%)`,
            color: accent,
          }}
        >
          <Icon size={14} strokeWidth={1.7} />
        </div>
      </div>

      <div className="flex items-baseline" style={{ gap: 4 }}>
        <span
          style={{
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 144, "wght" 400',
            fontWeight: 400,
            fontSize: 34,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: "var(--v5-ink)",
            fontFeatureSettings: '"tnum" 1',
          }}
        >
          {value}
        </span>
        <span style={{ fontSize: 13, color: "var(--v5-ink3)", fontFamily: "var(--v5-sans)" }}>{unit}</span>
      </div>

      <div
        className="flex items-center"
        style={{ gap: 6, paddingTop: 4, borderTop: "1px solid var(--v5-rule)" }}
      >
        {delta !== 0 && (
          <span
            className="inline-flex items-center"
            style={{
              gap: 3,
              fontSize: 11,
              fontFamily: "var(--v5-sans)",
              fontWeight: 600,
              color: isUp ? "var(--v5-accent)" : isDown ? "var(--v5-rose)" : "var(--v5-ink3)",
            }}
          >
            <span style={{ fontSize: 10 }}>{isUp ? "↑" : "↓"}</span>
            {Math.abs(delta)}{deltaUnit ?? ""}
          </span>
        )}
        <span style={{ fontSize: 11, color: "var(--v5-ink3)", fontFamily: "var(--v5-sans)" }}>
          {delta === 0 ? "与上周期持平" : "vs 上周期"}
        </span>
      </div>
    </div>
  );
}

/* ── Mini donut ── */
function MiniDonut({ title, dist, rangeName }: {
  title: string;
  dist: { labels: string[]; values: number[]; pcts: number[]; colors: string[] };
  rangeName: string;
}) {
  const data: ChartData<"doughnut"> = {
    labels: dist.labels,
    datasets: [{
      data: dist.values.every((v) => v === 0) ? [1] : dist.values,
      backgroundColor: dist.values.every((v) => v === 0) ? ["rgba(139,94,60,0.08)"] : dist.colors,
      borderWidth: 0,
      borderRadius: 3,
    }],
  };
  const opts: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "62%",
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };

  return (
    <div
      className="rounded-[20px] p-5"
      style={{
        background: "var(--m-base-light)",
        border: "1px solid var(--m-rule)",
        boxShadow: "0 2px 8px rgba(139,94,60,0.04)",
      }}
    >
      <p className="mb-4 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
        {title}（{rangeName}）
      </p>
      <div className="flex items-center gap-5">
        <div className="w-20 shrink-0">
          <Doughnut data={data} options={opts} />
        </div>
        <div className="space-y-2 text-xs">
          {dist.labels.map((label, i) => (
            <div className="flex items-center gap-2" key={label}>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: dist.colors[i] }} />
              <span style={{ color: "var(--m-ink2)" }}>{label}</span>
              <span className="font-semibold" style={{ color: "var(--m-ink)" }}>{dist.pcts[i]}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main component ── */
export function CombinedTrendChart({ logs, quotes, timeEntries = [] }: CombinedTrendChartProps) {
  const [range, setRange] = useState<Range>("30d");

  const series = useMemo(() => buildSeries(logs, quotes, timeEntries, range), [logs, quotes, timeEntries, range]);
  const prevSeries = useMemo(() => buildPrevSeries(logs, quotes, timeEntries, range), [logs, quotes, timeEntries, range]);
  const stats = useMemo(() => computeStats(series, prevSeries), [series, prevSeries]);
  const labels = series.map((p) => formatTickLabel(p.date));
  const rangeName = RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "";

  const moodDist = useMemo(() => moodDistribution(series), [series]);
  const studyDist = useMemo(() => studyDistribution(series), [series]);
  const readingDist = useMemo(() => readingDistribution(series), [series]);
  const insight = useMemo(() => generateInsight(series), [series]);

  const maxTicks = range === "7d" ? 7 : range === "30d" ? 8 : range === "90d" ? 10 : 12;

  const data: ChartData<"bar" | "line"> = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "学习时长 (h)",
        data: series.map((p) => p.study),
        backgroundColor: "rgba(179,98,58,0.42)",
        hoverBackgroundColor: "rgba(179,98,58,0.75)",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        yAxisID: "yHours",
        order: 3,
      },
      {
        type: "bar" as const,
        label: "阅读时长 (h)",
        data: series.map((p) => p.reading),
        backgroundColor: "rgba(212,160,124,0.42)",
        hoverBackgroundColor: "rgba(212,160,124,0.78)",
        borderRadius: 4,
        barPercentage: 0.6,
        categoryPercentage: 0.7,
        yAxisID: "yHours",
        order: 2,
      },
      {
        type: "line" as const,
        label: "情绪 (0-10)",
        data: series.map((p) => p.mood),
        borderColor: "rgba(139, 94, 60, 0.92)",
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(139,94,60,0.12)";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(139,94,60,0.14)");
          g.addColorStop(1, "rgba(139,94,60,0.0)");
          return g;
        },
        borderWidth: 2.5,
        tension: 0.38,
        cubicInterpolationMode: "monotone" as const,
        fill: true,
        pointBackgroundColor: "#fff",
        pointBorderColor: "rgba(139,94,60,0.9)",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: "#8b5e3c",
        spanGaps: true,
        yAxisID: "yMood",
        order: 1,
      },
    ],
  };

  const options: ChartOptions<"bar" | "line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    animation: { duration: 700, easing: "easeOutQuart" },
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "end",
        labels: {
          color: "#a07850",
          boxWidth: 10,
          boxHeight: 10,
          font: { size: 11 },
          padding: 16,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(255,252,246,0.97)",
        titleColor: "#5a3a1e",
        bodyColor: "#7a5a3a",
        borderColor: "rgba(139,94,60,0.18)",
        borderWidth: 1,
        padding: { top: 12, bottom: 12, left: 16, right: 16 },
        cornerRadius: 14,
        titleFont: { size: 13, weight: "bold" as const },
        bodyFont: { size: 12 },
        bodySpacing: 6,
        boxPadding: 4,
        usePointStyle: true,
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex ?? 0;
            const p = series[idx];
            if (!p) return "";
            const d = parseISODate(p.date);
            return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAY_SHORT[d.getDay()]}`;
          },
          label: (item) => {
            const v = item.parsed.y;
            if (v === null || v === undefined) return `  ${item.dataset.label}: --`;
            return `  ${item.dataset.label}: ${typeof v === "number" ? v.toFixed(1) : v}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#b0956e",
          font: { size: 11 },
          autoSkip: true,
          maxTicksLimit: maxTicks,
          maxRotation: 0,
          minRotation: 0,
        },
      },
      yMood: {
        type: "linear",
        position: "left",
        beginAtZero: true,
        max: 10,
        title: { display: true, text: "情绪 (0–10)", color: "#b0956e", font: { size: 10 } },
        border: { display: false },
        grid: { color: "rgba(221,208,188,0.40)" },
        ticks: { color: "#b0956e", font: { size: 11 }, stepSize: 2 },
      },
      yHours: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        title: { display: true, text: "时长 (h)", color: "#b0956e", font: { size: 10 } },
        border: { display: false },
        grid: { display: false },
        ticks: { color: "#b0956e", font: { size: 11 } },
      },
    },
  };

  return (
    <div className="space-y-5">
      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          accent="rgba(139,94,60,0.85)"
          delta={stats.deltaMood}
          icon={Smile}
          label="平均情绪"
          unit="/10"
          value={stats.avgMood ? stats.avgMood.toFixed(1) : "--"}
        />
        <StatCard
          accent="rgba(179,98,58,0.85)"
          delta={stats.deltaStudy}
          deltaUnit="h"
          icon={GraduationCap}
          label="学习投入"
          unit="h"
          value={stats.totalStudy.toFixed(1)}
        />
        <StatCard
          accent="rgba(212,160,124,0.85)"
          delta={stats.deltaReading}
          deltaUnit="h"
          icon={BookOpen}
          label="阅读时长"
          unit="h"
          value={stats.totalReading.toFixed(1)}
        />
        <StatCard
          accent="rgba(196,165,117,0.85)"
          delta={stats.deltaRecordDays}
          icon={CalendarCheck}
          label="记录天数"
          unit="天"
          value={String(stats.recordDays)}
        />
      </div>

      {/* ── Main chart panel ── */}
      <div
        className="rounded-[22px] p-5 lg:p-6"
        style={{
          background: "var(--m-base-light)",
          border: "1px solid var(--m-rule)",
          boxShadow: "0 2px 8px rgba(139,94,60,0.04)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
              情绪 · 学习 · 阅读趋势
            </h4>
            <span
              className="cursor-help rounded-full text-xs"
              style={{ color: "var(--m-ink3)" }}
              title="点击图例可隐藏曲线"
            >
              ⓘ
            </span>
          </div>
          <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
            点击图例可隐藏曲线
          </p>

          <div
            className="inline-flex items-center gap-1 rounded-full p-1"
            style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = opt.value === range;
              return (
                <button
                  className="rounded-full px-3.5 py-1.5 text-xs font-medium transition-all"
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  type="button"
                  style={{
                    background: active ? "var(--m-accent)" : "transparent",
                    color: active ? "#fff" : "var(--m-ink2)",
                    boxShadow: active ? "0 2px 8px rgba(139,94,60,0.25)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {series.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-dashed px-6 py-10 text-center text-sm" style={{ borderColor: "rgba(139,94,60,0.16)", color: "var(--m-ink3)" }}>
            所选区间内还没有记录，先去写一条吧。
          </div>
        ) : (
          <div className="mt-5 h-80">
            <Chart data={data} options={options} type="bar" />
          </div>
        )}
      </div>

      {/* ── Bottom row: donut distributions + insight ── */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MiniDonut dist={moodDist} rangeName={rangeName} title="情绪分布" />
        <MiniDonut dist={studyDist} rangeName={rangeName} title="学习时长分布" />
        <MiniDonut dist={readingDist} rangeName={rangeName} title="阅读时长分布" />

        {/* Insight card */}
        <div
          className="flex flex-col justify-between rounded-[20px] p-5"
          style={{
            background: "linear-gradient(145deg, rgba(255,250,240,0.95), rgba(245,235,218,0.85))",
            border: "1px solid var(--m-rule)",
            boxShadow: "0 2px 8px rgba(139,94,60,0.04)",
          }}
        >
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--m-ink)" }}>
              <Lightbulb size={16} style={{ color: "var(--m-accent)" }} />
              趋势洞察
            </p>
            <p className="mt-3 text-[13px] leading-6" style={{ color: "var(--m-ink2)" }}>
              {insight}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-1 text-xs" style={{ color: "var(--m-ink3)" }}>
            <TrendingUp size={12} />
            基于 {rangeName} 数据生成
          </div>
        </div>
      </div>
    </div>
  );
}
