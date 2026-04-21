"use client";

import type { ChartOptions } from "chart.js";
import { Line } from "react-chartjs-2";

import "@/components/charts/chart-registry";
import { Panel } from "@/components/ui/panel";
import type { ComputedYearStats } from "@/types/year-review";

interface TrendChartProps {
  trend: ComputedYearStats["trend"];
  title?: string;
  description?: string;
}

export function TrendChart({
  trend,
  title = "年度趋势",
  description = "12 个月的对齐分与情绪走向",
}: TrendChartProps) {
  const data = {
    labels: trend.labels,
    datasets: [
      {
        label: "对齐分",
        data: trend.alignment,
        borderColor: "#B4584A",
        backgroundColor: "rgba(180, 88, 70, 0.12)",
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#B4584A",
      },
      {
        label: "情绪",
        data: trend.mood,
        borderColor: "#5B7EA6",
        backgroundColor: "rgba(91, 126, 166, 0.08)",
        borderWidth: 2,
        borderDash: [4, 4],
        tension: 0.35,
        fill: false,
        pointRadius: 3,
        pointHoverRadius: 5,
        pointBackgroundColor: "#5B7EA6",
        yAxisID: "y1",
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: {
        display: true,
        position: "top",
        align: "end",
        labels: {
          color: "#7d5e42",
          font: { size: 11 },
          boxWidth: 10,
          boxHeight: 10,
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
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#a07850", font: { size: 11 } },
      },
      y: {
        position: "left",
        min: 0,
        max: 100,
        grid: { color: "rgba(139,94,60,0.08)" },
        ticks: { color: "#a07850", font: { size: 11 } },
      },
      y1: {
        position: "right",
        min: 0,
        max: 10,
        grid: { display: false },
        ticks: { color: "#a07850", font: { size: 11 } },
      },
    },
  };

  return (
    <Panel className="p-5 md:p-6">
      <div className="mb-4">
        <h3
          className="text-base font-semibold"
          style={{
            color: "var(--m-ink)",
            fontFamily: '"Noto Serif SC", serif',
          }}
        >
          {title}
        </h3>
        <p className="mt-1 text-sm" style={{ color: "var(--m-ink3)" }}>
          {description}
        </p>
      </div>
      <div className="h-64">
        <Line data={data} options={options} />
      </div>
    </Panel>
  );
}
