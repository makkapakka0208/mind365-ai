"use client";

import { Plus } from "lucide-react";

import { calculateGoalProgress } from "@/lib/life-path";
import type { UserGoal } from "@/types/life-path";

/**
 * 人生主线 · 刊头 + 目标轨道。
 * 每个目标一行：名称与实际进度 / 进度条 / 截止日与剩余天数；AI 建议挂在行下方。
 * 只呈现事实：目标没有记录开始日期，所以不推算「落后 / 领先」。
 */

const SERIF = "var(--v5-serif)";

function formatDeadline(deadline: string) {
  const [y, m, d] = deadline.split("-").map(Number);
  return y === new Date().getFullYear() ? `${m} 月 ${d} 日` : `${y} 年 ${m} 月 ${d} 日`;
}

function daysLeftText(daysLeft: number | null) {
  if (daysLeft === null) return "未设截止";
  if (daysLeft > 0) return `还有 ${daysLeft} 天`;
  if (daysLeft === 0) return "今天截止";
  return `已过截止 ${-daysLeft} 天`;
}

type Row = { goal: UserGoal; progress: ReturnType<typeof calculateGoalProgress> };

function sortRows(goals: UserGoal[]): Row[] {
  return goals
    .map((goal) => ({ goal, progress: calculateGoalProgress(goal) }))
    .sort((a, b) => {
      if (a.progress.isCompleted !== b.progress.isCompleted) return a.progress.isCompleted ? 1 : -1;
      const da = a.goal.deadline ?? "9999-12-31";
      const db = b.goal.deadline ?? "9999-12-31";
      return da.localeCompare(db);
    });
}

// 刊头摘要里的关键数字：放大、用强调色，扫一眼就能抓到「几个目标、最近哪天截止、还剩几天」
function Num({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 26, color: "var(--v5-accent)", fontFeatureSettings: '"lnum" 1', margin: "0 2px" }}>{children}</span>;
}

function Sep() {
  return <span aria-hidden style={{ margin: "0 12px", color: "var(--v5-ink-mute)" }}>·</span>;
}

export function LifePathMasthead({ goals, onAdd }: { goals: UserGoal[]; onAdd: () => void }) {
  const rows = sortRows(goals);
  const active = rows.filter((r) => !r.progress.isCompleted);
  const completed = rows.length - active.length;
  const nearest = active.find((r) => r.goal.deadline && (r.progress.daysLeft ?? -1) >= 0);

  let summary: React.ReactNode;
  if (goals.length === 0) {
    summary = "还没有目标，先写下一个想去的方向";
  } else {
    summary = (
      <>
        {active.length > 0 ? <><Num>{active.length}</Num> 个目标在路上</> : "所有目标都已完成"}
        {completed > 0 && active.length > 0 && <><Sep />已完成 <Num>{completed}</Num> 个</>}
        {nearest?.goal.deadline && (
          <>
            <Sep />最近的截止 <Num>{formatDeadline(nearest.goal.deadline)}</Num>
            {nearest.progress.daysLeft !== null && <>，还有 <Num>{nearest.progress.daysLeft}</Num> 天</>}
          </>
        )}
      </>
    );
  }

  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-5" style={{ borderBottom: "1px solid var(--v5-rule-strong)" }}>
      <div>
        <h1 className="v5-eyebrow" style={{ margin: 0 }}>
          OVERALL PROGRESS · 总览
        </h1>
        <p style={{ margin: "12px 0 0", fontFamily: SERIF, fontSize: 20, lineHeight: 1.5, color: "var(--v5-ink)" }}>
          {summary}
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-full transition-opacity hover:opacity-90"
        style={{ padding: "10px 20px", fontFamily: SERIF, fontSize: 15, background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)", boxShadow: "0 4px 12px rgba(var(--v5-shadow-rgb),0.16)" }}
      >
        <Plus size={15} />
        添加目标
      </button>
    </header>
  );
}

export function GoalTracks({
  goals,
  getSuggestion,
  onOpen,
}: {
  goals: UserGoal[];
  getSuggestion: (goalId: string) => string | undefined;
  onOpen: (goalId: string) => void;
}) {
  const rows = sortRows(goals);

  return (
    <div
      className="overflow-hidden"
      style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 24, boxShadow: "var(--v5-sh-2)" }}
    >
      {/* 表头 */}
      <div
        className="grid items-center px-7 py-3"
        style={{ gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr) 150px", columnGap: 28, borderBottom: "1px solid var(--v5-rule)" }}
      >
        <span className="v5-eyebrow">目标</span>
        <span className="v5-eyebrow">进度</span>
        <span className="v5-eyebrow text-right">截止</span>
      </div>

      {rows.map(({ goal, progress }, i) => {
        const suggestion = progress.isCompleted ? undefined : getSuggestion(goal.id)?.trim();
        const fill = progress.isCompleted ? "var(--m-success)" : "var(--v5-accent)";
        return (
          <button
            key={goal.id}
            type="button"
            onClick={() => onOpen(goal.id)}
            className="group grid w-full items-center px-7 py-5 text-left transition-colors hover:bg-[rgba(var(--v5-accent-rgb),0.05)]"
            style={{
              gridTemplateColumns: "minmax(180px, 240px) minmax(0, 1fr) 150px",
              columnGap: 28,
              rowGap: 8,
              borderTop: i === 0 ? "none" : "1px solid var(--v5-rule)",
            }}
          >
            {/* 名称 + 实际进度 */}
            <span className="min-w-0">
              <span
                className="block truncate transition-colors group-hover:text-[var(--v5-accent)]"
                style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "var(--v5-ink)" }}
              >
                {goal.title}
              </span>
              <span className="mt-1 block" style={{ fontFamily: SERIF, fontSize: 13.5, color: "var(--v5-ink3)", fontFeatureSettings: '"lnum" 1' }}>
                {progress.isCompleted
                  ? "已完成"
                  : `${goal.currentValue.toLocaleString()} / ${goal.targetValue.toLocaleString()}`}
              </span>
            </span>

            {/* 进度条 */}
            <span className="flex items-center gap-4">
              <span className="relative block h-[6px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(var(--v5-ink-rgb),0.09)" }}>
                <span
                  className="absolute inset-y-0 left-0 block rounded-full"
                  style={{ width: `${Math.max(progress.percentage, progress.percentage > 0 ? 2 : 0)}%`, background: fill, transition: "width 600ms var(--v5-ease-out)" }}
                />
              </span>
              <span className="w-12 shrink-0 text-right" style={{ fontFamily: SERIF, fontSize: 17, color: progress.isCompleted ? "var(--m-success)" : "var(--v5-ink)", fontFeatureSettings: '"lnum" 1' }}>
                {progress.percentage}%
              </span>
            </span>

            {/* 截止 */}
            <span className="text-right" style={{ fontFamily: SERIF }}>
              <span className="block" style={{ fontSize: 14.5, color: "var(--v5-ink2)" }}>
                {goal.deadline ? formatDeadline(goal.deadline) : "—"}
              </span>
              <span className="mt-0.5 block" style={{ fontSize: 12.5, color: "var(--v5-ink3)" }}>
                {progress.isCompleted ? "" : daysLeftText(progress.daysLeft)}
              </span>
            </span>

            {/* AI 建议：挂在进度那一栏下方 */}
            {suggestion && (
              <span
                className="col-start-2 col-end-4 block"
                style={{ fontFamily: SERIF, fontSize: 13.5, fontStyle: "italic", lineHeight: 1.7, color: "var(--v5-ink3)" }}
              >
                <span aria-hidden style={{ color: "var(--v5-accent)", marginRight: 6 }}>↳</span>
                {suggestion}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
