"use client";

import { Target } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import type { YearGoalProgress } from "@/types/year-review";

interface GoalReviewCardProps {
  goals: YearGoalProgress[];
}

function computePct(g: YearGoalProgress): number {
  const span = g.targetValue - g.startValue;
  if (span <= 0) return 100;
  const gained = g.currentValue - g.startValue;
  return Math.round(Math.max(0, Math.min(1, gained / span)) * 100);
}

export function GoalReviewCard({ goals }: GoalReviewCardProps) {
  if (goals.length === 0) {
    return (
      <Panel className="p-6">
        <div className="flex items-center gap-2">
          <Target size={16} style={{ color: "var(--m-ink3)" }} />
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--m-ink)", fontFamily: '"Noto Serif SC", serif' }}
          >
            目标回顾
          </h3>
        </div>
        <p className="mt-3 text-sm" style={{ color: "var(--m-ink3)" }}>
          今年还没有设定年度目标。新的一年，可以在「人生主线」里写下第一个。
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Target size={16} style={{ color: "var(--m-accent)" }} />
        <h3
          className="text-base font-semibold"
          style={{ color: "var(--m-ink)", fontFamily: '"Noto Serif SC", serif' }}
        >
          目标回顾
        </h3>
      </div>

      <div className="space-y-5">
        {goals.map((g) => {
          const pct = computePct(g);
          const done = pct >= 100;
          return (
            <div key={g.id}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <p
                  className="text-sm font-medium"
                  style={{
                    color: "var(--m-ink)",
                    fontFamily: '"Noto Serif SC", serif',
                  }}
                >
                  {g.title}
                </p>
                <p
                  className="text-xs"
                  style={{ color: done ? "#4A9B6F" : "var(--m-ink3)" }}
                >
                  {g.currentValue.toLocaleString()} / {g.targetValue.toLocaleString()}
                  {g.unit ? ` ${g.unit}` : ""} · {pct}%
                </p>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full"
                style={{ background: "rgba(139,94,60,0.1)" }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${pct}%`,
                    background: done
                      ? "linear-gradient(90deg, #4A9B6F, #6fbf8e)"
                      : "linear-gradient(90deg, #B4584A, #DC9264)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
