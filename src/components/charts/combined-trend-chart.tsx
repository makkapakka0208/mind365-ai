"use client";

import type { ChartData, ChartOptions, ScriptableContext } from "chart.js";
import { useMemo, useState } from "react";
import { Chart } from "react-chartjs-2";

import "@/components/charts/chart-registry";
import { Panel } from "@/components/ui/panel";
import { parseReadingHours } from "@/lib/analytics";
import { parseISODate, toISODate } from "@/lib/date";
import type { DailyLog, Quote } from "@/types";

type Range = "7d" | "30d" | "all";

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: "7d", label: "近 7 天" },
  { value: "30d", label: "近 30 天" },
  { value: "all", label: "全部" },
];

interface CombinedTrendChartProps {
  logs: DailyLog[];
  quotes: Quote[];
}

interface DayPoint {
  date: string;
  mood: number | null;
  study: number;
  reading: number;
}

/**
 * Build a contiguous-date series so all three metrics share the same X axis.
 * mood is averaged per day; study and reading are summed.
 */
function buildSeries(logs: DailyLog[], quotes: Quote[], range: Range): DayPoint[] {
  if (logs.length === 0 && quotes.length === 0) return [];

  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const firstLogDate = sortedLogs[0]?.date;
  const firstQuoteDate = [...quotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.createdAt.slice(0, 10);
  const earliest = [firstLogDate, firstQuoteDate].filter(Boolean).sort()[0]!;

  const today = new Date();
  let start: Date;
  if (range === "7d") {
    start = new Date(today);
    start.setDate(today.getDate() - 6);
  } else if (range === "30d") {
    start = new Date(today);
    start.setDate(today.getDate() - 29);
  } else {
    start = parseISODate(earliest);
  }

  // Aggregate
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

  // Walk every day from start → today
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

export function CombinedTrendChart({ logs, quotes }: CombinedTrendChartProps) {
  const [range, setRange] = useState<Range>("30d");

  const series = useMemo(() => buildSeries(logs, quotes, range), [logs, quotes, range]);
  const labels = series.map((p) => formatTickLabel(p.date));

  // Tick density: cap to ~8 visible labels regardless of range size
  const maxTicks = range === "7d" ? 7 : range === "30d" ? 8 : 10;

  const data: ChartData<"bar" | "line"> = {
    labels,
    datasets: [
      {
        type: "bar" as const,
        label: "学习 (h)",
        data: series.map((p) => p.study),
        backgroundColor: "rgba(160, 120, 80, 0.55)",
        hoverBackgroundColor: "rgba(160, 120, 80, 0.85)",
        borderRadius: 6,
        yAxisID: "yHours",
        order: 2,
      },
      {
        type: "bar" as const,
        label: "阅读 (h)",
        data: series.map((p) => p.reading),
        backgroundColor: "rgba(74, 155, 111, 0.45)",
        hoverBackgroundColor: "rgba(74, 155, 111, 0.75)",
        borderRadius: 6,
        yAxisID: "yHours",
        order: 3,
      },
      {
        type: "line" as const,
        label: "情绪",
        data: series.map((p) => p.mood),
        borderColor: "rgba(139, 94, 60, 0.95)",
        backgroundColor: (ctx: ScriptableContext<"line">) => {
          const chart = ctx.chart;
          const { ctx: c, chartArea } = chart;
          if (!chartArea) return "rgba(139,94,60,0.15)";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(139,94,60,0.18)");
          g.addColorStop(1, "rgba(139,94,60,0.0)");
          return g;
        },
        borderWidth: 2.5,
        tension: 0.4,
        cubicInterpolationMode: "monotone" as const,
        fill: true,
        pointBackgroundColor: "#8b5e3c",
        pointBorderColor: "rgba(139,94,60,0.4)",
        pointRadius: 3,
        pointHoverRadius: 5,
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
          boxWidth: 12,
          boxHeight: 12,
          font: { size: 11 },
          padding: 14,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: "rgba(44, 26, 14, 0.92)",
        titleColor: "#fdf6eb",
        bodyColor: "#f0e6d3",
        borderColor: "rgba(139, 94, 60, 0.45)",
        borderWidth: 1,
        padding: 12,
        cornerRadius: 12,
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex ?? 0;
            const iso = series[idx]?.date ?? "";
            return iso;
          },
          label: (item) => {
            const v = item.parsed.y;
            if (v === null || v === undefined) return `${item.dataset.label}: --`;
            const unit = item.dataset.label?.includes("h") ? "h" : "";
            return `${item.dataset.label}: ${typeof v === "number" ? v.toFixed(1) : v}${unit ? "" : ""}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#a07850",
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
        title: { display: true, text: "情绪 (0–10)", color: "#a07850", font: { size: 10 } },
        border: { display: false },
        grid: { color: "rgba(221, 208, 188, 0.55)" },
        ticks: { color: "#a07850", font: { size: 11 }, stepSize: 2 },
      },
      yHours: {
        type: "linear",
        position: "right",
        beginAtZero: true,
        title: { display: true, text: "时长 (h)", color: "#a07850", font: { size: 10 } },
        border: { display: false },
        grid: { display: false },
        ticks: { color: "#a07850", font: { size: 11 } },
      },
    },
  };

  return (
    <Panel className="p-5 lg:p-6" interactive>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
            情绪 · 学习 · 阅读 关联
          </h3>
          <p className="mt-1 text-sm" style={{ color: "var(--m-ink2)" }}>
            一图叠加三条主线，看见情绪起伏与学习/阅读节奏之间的相关性。
          </p>
        </div>

        <div
          className="inline-flex items-center gap-1 rounded-full p-1"
          style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-in)" }}
        >
          {RANGE_OPTIONS.map((opt) => {
            const active = opt.value === range;
            return (
              <button
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                key={opt.value}
                onClick={() => setRange(opt.value)}
                type="button"
                style={{
                  background: active ? "var(--m-accent)" : "transparent",
                  color: active ? "#fff" : "var(--m-ink2)",
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
    </Panel>
  );
}
