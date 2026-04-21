"use client";

import { Activity, BookOpen, Clock, Gauge, type LucideIcon } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import type { ComputedYearStats } from "@/types/year-review";

interface StatsGridProps {
  stats: ComputedYearStats;
}

interface StatCell {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone: "ink" | "green" | "red" | "blue";
}

const TONE: Record<StatCell["tone"], { bg: string; fg: string }> = {
  ink: { bg: "rgba(139,94,60,0.08)", fg: "var(--m-ink)" },
  green: { bg: "rgba(74,155,111,0.10)", fg: "#4A9B6F" },
  red: { bg: "rgba(192,57,43,0.10)", fg: "#C0392B" },
  blue: { bg: "rgba(80,110,150,0.10)", fg: "#5B7EA6" },
};

export function StatsGrid({ stats }: StatsGridProps) {
  const net = stats.totalStudyHours - stats.totalWasteHours;

  const cells: StatCell[] = [
    {
      icon: Gauge,
      label: "平均对齐分",
      value: `${stats.avgScore}`,
      hint: "满分 100",
      tone: "ink",
    },
    {
      icon: BookOpen,
      label: "有效投入",
      value: `${stats.totalStudyHours.toFixed(1)} h`,
      hint: `${stats.entries} 天记录`,
      tone: "green",
    },
    {
      icon: Clock,
      label: "浪费时间",
      value: `${stats.totalWasteHours.toFixed(1)} h`,
      hint: "值得觉察的时间",
      tone: "red",
    },
    {
      icon: Activity,
      label: "净值",
      value: `${net >= 0 ? "+" : ""}${net.toFixed(1)} h`,
      hint: "有效 − 浪费",
      tone: net >= 0 ? "green" : "red",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cells.map((cell) => {
        const t = TONE[cell.tone];
        const Icon = cell.icon;
        return (
          <Panel
            className="p-5"
            interactive
            key={cell.label}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p
                  className="text-[12px] tracking-wider"
                  style={{ color: "var(--m-ink3)" }}
                >
                  {cell.label}
                </p>
                <p
                  className="mt-2 text-2xl font-semibold"
                  style={{
                    color: t.fg,
                    fontFamily: '"Noto Serif SC", serif',
                  }}
                >
                  {cell.value}
                </p>
                {cell.hint ? (
                  <p
                    className="mt-1 text-[11px]"
                    style={{ color: "var(--m-ink3)" }}
                  >
                    {cell.hint}
                  </p>
                ) : null}
              </div>
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ background: t.bg, color: t.fg }}
              >
                <Icon size={18} />
              </span>
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
