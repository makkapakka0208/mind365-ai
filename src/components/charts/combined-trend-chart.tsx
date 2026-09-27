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
import { useThemeColors } from "@/lib/theme-colors";
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
function MiniDonut({ title, dist, colors, emptyColor, rangeName }: {
  title: string;
  dist: { labels: string[]; values: number[]; pcts: number[] };
  colors: string[];
  emptyColor: string;
  rangeName: string;
}) {
  const empty = dist.values.every((v) => v === 0);
  const data: ChartData<"doughnut"> = {
    labels: dist.labels,
    datasets: [{
      data: empty ? [1] : dist.values,
      backgroundColor: empty ? [emptyColor] : colors,
      borderWidth: 0,
      spacing: empty ? 0 : 2,
      borderRadius: 4,
    }],
  };
  const opts: ChartOptions<"doughnut"> = {
    responsive: true,
    maintainAspectRatio: true,
    cutout: "72%",
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  // 占比最大的一项放在环中间
  const top = empty ? -1 : dist.values.indexOf(Math.max(...dist.values));

  return (
    <div
      className="flex flex-col rounded-[20px] p-5"
      style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", boxShadow: "var(--v5-sh-1)" }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: "var(--v5-ink)" }}>{title}</p>
        <span className="shrink-0 text-[11px]" style={{ color: "var(--v5-ink3)" }}>{rangeName}</span>
      </div>
      <div className="relative mx-auto my-4 w-[112px]">
        <Doughnut data={data} options={opts} />
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="text-lg font-semibold tabular-nums" style={{ color: "var(--v5-ink)" }}>{top >= 0 ? `${dist.pcts[top]}%` : "—"}</div>
            <div className="text-[10.5px]" style={{ color: "var(--v5-ink3)" }}>{top >= 0 ? dist.labels[top].split(" ")[0] : "暂无"}</div>
          </div>
        </div>
      </div>
      <ul className="mt-auto space-y-1.5 text-xs">
        {dist.labels.map((label, i) => (
          <li className="flex items-center gap-2" key={label}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colors[i] }} />
            <span className="min-w-0 flex-1 truncate" style={{ color: "var(--v5-ink2)" }}>{label}</span>
            <span className="tabular-nums" style={{ color: "var(--v5-ink)" }}>{empty ? "—" : `${dist.pcts[i]}%`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Main component ── */
export function CombinedTrendChart({ logs, quotes, timeEntries = [] }: CombinedTrendChartProps) {
  const [range, setRange] = useState<Range>("30d");
  const c = useThemeColors();
  // 全部用主题强调色的深浅，不再混用写死的棕色
  const shades = [c.accent(0.85), c.accent(0.5), c.accent(0.22)];

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
        backgroundColor: c.accent(0.5),
        hoverBackgroundColor: c.accent(0.75),
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
        backgroundColor: c.accent(0.2),
        hoverBackgroundColor: c.accent(0.38),
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
        borderColor: c.ink2,
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const { ctx: canvas, chartArea } = ctx.chart;
          if (!chartArea) return c.accent(0.08);
          const g = canvas.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, c.accent(0.16));
          g.addColorStop(1, c.accent(0));
          return g;
        },
        borderWidth: 2,
        tension: 0.38,
        cubicInterpolationMode: "monotone" as const,
        fill: true,
        // 平时不画点，悬停时才出现
        pointRadius: 0,
        pointHitRadius: 12,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: c.surface,
        pointHoverBorderColor: c.ink2,
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
          color: c.ink3,
          boxWidth: 7,
          boxHeight: 7,
          font: { size: 12 },
          padding: 18,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: c.surface,
        titleColor: c.ink,
        bodyColor: c.ink2,
        borderColor: c.rule,
        borderWidth: 1,
        padding: { top: 10, bottom: 10, left: 14, right: 14 },
        cornerRadius: 12,
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
        border: { display: false },
        ticks: {
          color: c.ink3,
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
        title: { display: false },
        border: { display: false },
        grid: { color: c.inkA(0.07) },
        ticks: { color: c.ink3, font: { size: 11 }, stepSize: 2, padding: 8 },
      },
      yHours: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        title: { display: false },
        border: { display: false },
        grid: { display: false },
        ticks: { color: c.ink3, font: { size: 11 }, padding: 8, callback: (v) => `${v}h` },
      },
    },
  };

  return (
    <div className="space-y-5">
      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          accent={c.accent(0.9)}
          delta={stats.deltaMood}
          icon={Smile}
          label="平均情绪"
          unit="/10"
          value={stats.avgMood ? stats.avgMood.toFixed(1) : "--"}
        />
        <StatCard
          accent={c.accent(0.9)}
          delta={stats.deltaStudy}
          deltaUnit="h"
          icon={GraduationCap}
          label="学习投入"
          unit="h"
          value={stats.totalStudy.toFixed(1)}
        />
        <StatCard
          accent={c.accent(0.9)}
          delta={stats.deltaReading}
          deltaUnit="h"
          icon={BookOpen}
          label="阅读时长"
          unit="h"
          value={stats.totalReading.toFixed(1)}
        />
        <StatCard
          accent={c.accent(0.9)}
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
        style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", boxShadow: "var(--v5-sh-1)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-semibold" style={{ color: "var(--v5-ink)" }}>
              情绪 · 学习 · 阅读趋势
            </h4>
            <p className="mt-0.5 text-xs" style={{ color: "var(--v5-ink3)" }}>
              折线为情绪（左轴 0–10），柱为时长（右轴）
            </p>
          </div>

          <div
            className="inline-flex items-center gap-0.5 rounded-full p-1"
            style={{ background: c.inkA(0.05) }}
          >
            {RANGE_OPTIONS.map((opt) => {
              const active = opt.value === range;
              return (
                <button
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  type="button"
                  style={{
                    background: active ? "var(--v5-surface)" : "transparent",
                    color: active ? "var(--v5-ink)" : "var(--v5-ink3)",
                    boxShadow: active ? "0 1px 3px rgba(var(--v5-shadow-rgb),0.12)" : "none",
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {series.length === 0 ? (
          <div className="mt-6 rounded-[18px] border border-dashed px-6 py-10 text-center text-sm" style={{ borderColor: "var(--v5-rule-strong)", color: "var(--v5-ink3)" }}>
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
        <MiniDonut colors={shades} dist={moodDist} emptyColor={c.inkA(0.06)} rangeName={rangeName} title="情绪分布" />
        <MiniDonut colors={shades} dist={studyDist} emptyColor={c.inkA(0.06)} rangeName={rangeName} title="学习时长" />
        <MiniDonut colors={shades} dist={readingDist} emptyColor={c.inkA(0.06)} rangeName={rangeName} title="阅读时长" />

        {/* Insight card */}
        <div
          className="flex flex-col justify-between rounded-[20px] p-5"
          style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", boxShadow: "var(--v5-sh-1)" }}
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
