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
      backgroundColor: "rgba(44, 26, 14, 0.92)",
      titleColor: "#fdf6eb",
      bodyColor: "#f0e6d3",
      borderColor: "rgba(139, 94, 60, 0.45)",
      borderWidth: 1,
      displayColors: false,
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
      beginAtZero: true,
      border: { display: false },
      grid: { color: "rgba(221, 208, 188, 0.6)" },
      ticks: { color: "#a07850", font: { size: 11 } },
    },
  },
};

function lineGradient(context: ScriptableContext<"line">) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return "#8b5e3c";
  }

  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, "#a07850");
  gradient.addColorStop(0.5, "#8b5e3c");
  gradient.addColorStop(1, "#6b4c2a");

  return gradient;
}

function fillGradient(context: ScriptableContext<"line">) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return "rgba(139, 94, 60, 0.15)";
  }

  const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  gradient.addColorStop(0, "rgba(139, 94, 60, 0.3)");
  gradient.addColorStop(1, "rgba(240, 230, 211, 0.05)");

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
        <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>{title}</h3>
        {description ? <p className="text-sm" style={{ color: "var(--m-ink2)" }}>{description}</p> : null}
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
                pointBackgroundColor: "#8b5e3c",
                pointBorderColor: "rgba(139, 94, 60, 0.35)",
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
