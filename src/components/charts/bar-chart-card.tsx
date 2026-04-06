"use client";

import type { ChartOptions, ScriptableContext } from "chart.js";
import { Bar } from "react-chartjs-2";

import "@/components/charts/chart-registry";
import { Panel } from "@/components/ui/panel";

interface BarChartCardProps {
  title: string;
  labels: string[];
  data: number[];
  datasetLabel: string;
  description?: string;
}

const options: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 1000,
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

function barGradient(context: ScriptableContext<"bar">) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return "rgba(139, 94, 60, 0.75)";
  }

  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, "rgba(160, 120, 80, 0.65)");
  gradient.addColorStop(1, "rgba(139, 94, 60, 0.9)");

  return gradient;
}

export function BarChartCard({
  title,
  labels,
  data,
  datasetLabel,
  description,
}: BarChartCardProps) {
  return (
    <Panel className="p-5" interactive>
      <div className="space-y-1">
        <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>{title}</h3>
        {description ? <p className="text-sm" style={{ color: "var(--m-ink2)" }}>{description}</p> : null}
      </div>

      <div className="mt-5 h-72">
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: datasetLabel,
                data,
                backgroundColor: barGradient,
                hoverBackgroundColor: "rgba(139, 94, 60, 0.95)",
                borderRadius: 12,
              },
            ],
          }}
          options={options}
        />
      </div>
    </Panel>
  );
}
