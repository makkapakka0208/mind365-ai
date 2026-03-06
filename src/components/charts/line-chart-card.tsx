"use client";

import type { ChartOptions, ScriptableContext } from "chart.js";
import { Line } from "react-chartjs-2";

import "@/components/charts/chart-registry";
import { Panel } from "@/components/ui/panel";

interface LineChartCardProps {
  title: string;
  labels: string[];
  data: number[];
  datasetLabel: string;
  description?: string;
}

const options: ChartOptions<"line"> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 1100,
    easing: "easeOutQuart",
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(15, 23, 42, 0.94)",
      titleColor: "#f8fafc",
      bodyColor: "#e2e8f0",
      borderColor: "rgba(99, 102, 241, 0.45)",
      borderWidth: 1,
      displayColors: false,
      padding: 12,
      cornerRadius: 12,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#94a3b8", font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      border: { display: false },
      grid: { color: "rgba(148, 163, 184, 0.2)" },
      ticks: { color: "#94a3b8", font: { size: 11 } },
    },
  },
};

function lineGradient(context: ScriptableContext<"line">) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return "#818cf8";
  }

  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, "#6366f1");
  gradient.addColorStop(0.5, "#a855f7");
  gradient.addColorStop(1, "#ec4899");

  return gradient;
}

function fillGradient(context: ScriptableContext<"line">) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return "rgba(99, 102, 241, 0.2)";
  }

  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, "rgba(168, 85, 247, 0.35)");
  gradient.addColorStop(1, "rgba(56, 189, 248, 0.03)");

  return gradient;
}

export function LineChartCard({
  title,
  labels,
  data,
  datasetLabel,
  description,
}: LineChartCardProps) {
  return (
    <Panel className="p-5" interactive>
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {description ? <p className="text-sm text-slate-300">{description}</p> : null}
      </div>

      <div className="mt-5 h-72">
        <Line
          data={{
            labels,
            datasets: [
              {
                label: datasetLabel,
                data,
                borderColor: lineGradient,
                backgroundColor: fillGradient,
                borderWidth: 2.5,
                fill: true,
                pointBackgroundColor: "#22d3ee",
                pointBorderColor: "rgba(34, 211, 238, 0.35)",
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.42,
                cubicInterpolationMode: "monotone",
              },
            ],
          }}
          options={options}
        />
      </div>
    </Panel>
  );
}

