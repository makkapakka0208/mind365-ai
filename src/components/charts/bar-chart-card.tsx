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
      backgroundColor: "rgba(15, 23, 42, 0.94)",
      titleColor: "#f8fafc",
      bodyColor: "#e2e8f0",
      borderColor: "rgba(56, 189, 248, 0.45)",
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

function barGradient(context: ScriptableContext<"bar">) {
  const chart = context.chart;
  const { ctx, chartArea } = chart;

  if (!chartArea) {
    return "rgba(56, 189, 248, 0.85)";
  }

  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0, "rgba(34, 211, 238, 0.75)");
  gradient.addColorStop(1, "rgba(59, 130, 246, 0.9)");

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
        <h3 className="text-base font-semibold text-slate-100">{title}</h3>
        {description ? <p className="text-sm text-slate-300">{description}</p> : null}
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
                hoverBackgroundColor: "rgba(99, 102, 241, 0.88)",
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

