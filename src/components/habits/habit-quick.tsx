"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { getTodayISODate } from "@/lib/date";
import { dayState, indexLogs, logKey, setHabitLog, shouldNudge, useHabitLogs, useHabits, weekProgress } from "@/lib/habits";
import type { Habit } from "@/types/life-path";

/**
 * 首页「今天」里的习惯快速打卡：一个习惯一枚小签。
 * 没做 → 点一下按每日目标量打卡；已做 → 显示 ✓ 与量。改量、补记去人生主线。
 */

const SERIF = "var(--v5-serif)";

function QuickChip({ habit, amount, state, note }: { habit: Habit; amount: number; state: string; note?: string }) {
  const [busy, setBusy] = useState(false);
  const done = state === "done";
  const rest = state === "rest";

  if (done || rest) {
    return (
      // 已完成：不再用填色胶囊，只是一行带勾的文字，把注意力留给还没做的
      <span className="inline-flex items-center gap-1.5 py-1 text-[14px]" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
        {rest ? (
          `${habit.name} · 今天休息`
        ) : (
          <>
            <Check size={14} strokeWidth={2.2} style={{ color: "var(--v5-accent)" }} />
            <span style={{ color: "var(--v5-ink2)" }}>{habit.name}</span> {amount} {habit.unit}
          </>
        )}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      title={`按每日目标打卡：${habit.dailyTarget} ${habit.unit}`}
      onClick={async () => {
        setBusy(true);
        try {
          // 做了一部分时，点一下补足到每日目标
          await setHabitLog(habit, getTodayISODate(), Math.max(amount, habit.dailyTarget));
        } finally {
          setBusy(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[14px] transition-colors hover:bg-[rgba(var(--v5-accent-rgb),0.08)] disabled:opacity-60"
      style={{ fontFamily: SERIF, border: "1px dashed var(--v5-accent)", color: "var(--v5-ink)" }}
    >
      {habit.name} {habit.dailyTarget} {habit.unit}
      {state === "partial" && <span style={{ color: "var(--v5-ink3)" }}>（已 {amount}）</span>}
      {note && <span style={{ color: "var(--v5-ink3)" }}>· {note}</span>}
    </button>
  );
}

export function HabitQuickRow() {
  const habits = useHabits();
  const logs = useHabitLogs();
  const index = useMemo(() => indexLogs(logs), [logs]);
  const active = habits.filter((h) => !h.archivedAt);
  if (active.length === 0) return null;

  const today = getTodayISODate();
  const remaining = active.filter((h) => {
    const s = dayState(h, today, index, today);
    return s !== "done" && s !== "rest";
  }).length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3" style={{ borderTop: "1px solid var(--v5-rule)" }}>
      <span className="v5-eyebrow mr-1">习惯</span>
      {active.map((h) => {
        const state = dayState(h, today, index, today);
        const amount = index.get(logKey(h.id, today))?.amount ?? 0;
        const week = weekProgress(h, index, today);
        const note = shouldNudge(h, index, today) ? "昨天没做" : !week.met && week.daysLeft <= week.required - week.done ? "本周要天天做了" : undefined;
        return <QuickChip key={h.id} habit={h} amount={amount} state={state} note={note} />;
      })}
      <Link href="/life-path" className="ml-auto text-[13px] transition-opacity hover:opacity-80" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
        {remaining === 0 ? "今天都完成了 · 补记 →" : "改量 / 补记 →"}
      </Link>
    </div>
  );
}
