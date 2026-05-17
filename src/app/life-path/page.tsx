"use client";

import { Bot, CalendarDays, ChevronDown, ChevronRight, ChevronUp, Compass, Flame, Loader2, Map, Pencil, Plus, RefreshCw, Sparkles, Target, Trash2, X, Zap } from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { calculateGoalProgress } from "@/lib/life-path";
import {
  currentWeekKey,
  deleteMentorPlan,
  loadGoals,
  loadMentorPlans,
  refreshLifePathState,
  saveGoals,
  saveMentorPlan,
  todayKey,
} from "@/lib/life-path-storage";
import type {
  AdjustNote,
  DailySuggestion,
  GoalPhase,
  MentorPlan,
  UserGoal,
  WeeklyPlan,
} from "@/types/life-path";

// ── Mentor API helper ─────────────────────────────────────────────────────────

type MentorAction = "breakdown" | "weekly" | "daily" | "adjust";

async function callMentor(
  action: MentorAction,
  goal: UserGoal,
  context?: string,
): Promise<{ available: boolean; data: unknown; message?: string }> {
  const resp = await fetch("/api/life-path-mentor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      goal: {
        title: goal.title,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        deadline: goal.deadline,
      },
      context,
      today: todayKey(),
    }),
  });
  return resp.json() as Promise<{ available: boolean; data: unknown; message?: string }>;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PhaseRow({ phase }: { phase: GoalPhase }) {
  return (
    <div
      className="flex gap-3 rounded-xl p-3"
      style={{
        background: phase.isCurrent ? "rgba(139,94,60,0.06)" : "transparent",
        border: phase.isCurrent ? "1px solid rgba(139,94,60,0.15)" : "1px solid transparent",
      }}
    >
      <div
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{
          background: phase.isCurrent ? "var(--m-accent)" : "var(--m-rule)",
          color: phase.isCurrent ? "#fff" : "var(--m-ink3)",
        }}
      >
        {phase.index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: phase.isCurrent ? "var(--m-accent)" : "var(--m-ink)" }}>
            {phase.title}
          </span>
          <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>{phase.progressRange}</span>
          {phase.isCurrent && (
            <span className="rounded-full px-1.5 py-0.5 text-[9px] font-medium" style={{ background: "var(--m-accent)", color: "#fff" }}>
              当前
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--m-ink2)" }}>{phase.description}</p>
        {phase.isCurrent && phase.keyActions.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {phase.keyActions.map((a, i) => (
              <li className="text-xs" key={i} style={{ color: "var(--m-ink2)" }}>
                <span style={{ color: "var(--m-accent)" }}>· </span>{a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function DailyCard({ suggestion }: { suggestion: DailySuggestion }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold" style={{ color: "var(--m-ink)" }}>
        <span style={{ color: "var(--m-accent)" }}>▶ </span>{suggestion.action}
      </p>
      <p className="text-xs leading-5" style={{ color: "var(--m-ink2)" }}>{suggestion.reason}</p>
      {suggestion.tip && (
        <p className="text-[11px]" style={{ color: "var(--m-ink3)" }}>💡 {suggestion.tip}</p>
      )}
    </div>
  );
}

function AdjustCard({ note }: { note: AdjustNote }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs" style={{ color: "var(--m-ink2)" }}>
        <span className="font-medium" style={{ color: "var(--m-ink)" }}>现状：</span>{note.assessment}
      </p>
      <p className="text-xs" style={{ color: "var(--m-ink2)" }}>
        <span className="font-medium" style={{ color: "var(--m-ink)" }}>调整：</span>{note.adjustment}
      </p>
      <p className="text-xs" style={{ color: "#4A9B6F" }}>✦ {note.encouragement}</p>
    </div>
  );
}

// ── Mentor section ────────────────────────────────────────────────────────────

function MentorSection({
  goal,
  plan,
  onPlanUpdated,
}: {
  goal: UserGoal;
  plan: MentorPlan;
  onPlanUpdated: (p: MentorPlan) => void;
}) {
  const [loading, setLoading] = useState<MentorAction | null>(null);
  const [error, setError] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustContext, setAdjustContext] = useState("");

  const today = todayKey();
  const thisWeek = currentWeekKey();

  const needsBreakdown = plan.phases.length === 0;
  const weeklyStale = plan.weeklyGeneratedAt !== thisWeek;
  const dailyStale  = plan.dailyGeneratedAt !== today;

  const act = async (action: MentorAction, context?: string) => {
    setLoading(action);
    setError("");
    try {
      const res = await callMentor(action, goal, context);
      if (!res.available) { setError(res.message ?? "AI 功能未配置。"); return; }
      if (!res.data)       { setError(res.message ?? "AI 返回为空，请重试。"); return; }

      const d = res.data as Record<string, unknown>;
      let updated = { ...plan };

      if (action === "breakdown") {
        updated = { ...updated, phases: (d.phases ?? []) as GoalPhase[], phasesGeneratedAt: new Date().toISOString() };
      } else if (action === "weekly") {
        updated = { ...updated, weeklyPlan: d as unknown as WeeklyPlan, weeklyGeneratedAt: thisWeek };
      } else if (action === "daily") {
        updated = { ...updated, dailySuggestion: d as unknown as DailySuggestion, dailyGeneratedAt: today };
      } else if (action === "adjust") {
        updated = { ...updated, adjustNote: d as unknown as AdjustNote };
        setAdjustOpen(false);
        setAdjustContext("");
      }

      saveMentorPlan(updated);
      onPlanUpdated(updated);
    } catch {
      setError("网络错误，请稍后重试。");
    } finally {
      setLoading(null);
    }
  };

  const isLoading = (a: MentorAction) => loading === a;
  const busy = loading !== null;

  return (
    <div className="mt-5 space-y-5 border-t pt-5" style={{ borderColor: "var(--m-rule)" }}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m-accent)" }}>
        <Bot size={13} />
        AI 导师
      </div>

      {error && <p className="text-xs" style={{ color: "#dc2626" }}>{error}</p>}

      {/* ── Phase breakdown ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--m-ink2)" }}>
            <Map size={12} style={{ color: "var(--m-accent)" }} />
            目标阶段
          </span>
          <button
            className="flex items-center gap-1 text-[11px] hover:opacity-70 disabled:opacity-40"
            disabled={busy}
            onClick={() => void act("breakdown")}
            type="button"
            style={{ color: "var(--m-accent)" }}
          >
            {isLoading("breakdown")
              ? <><Loader2 className="animate-spin" size={11} />生成中...</>
              : needsBreakdown
                ? <><Sparkles size={11} />生成计划</>
                : <><RefreshCw size={11} />重新规划</>}
          </button>
        </div>

        {plan.phases.length > 0 ? (
          <div className="space-y-1.5">
            {plan.phases.map((p) => <PhaseRow key={p.index} phase={p} />)}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
            点击「生成计划」将目标拆解为可执行阶段
          </p>
        )}
      </div>

      {/* ── Weekly plan → dedicated page ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--m-ink2)" }}>
            <CalendarDays size={12} style={{ color: "#4A9B6F" }} />
            本周计划
          </span>
          <Link
            className="flex items-center gap-1 text-[11px] hover:opacity-70"
            href="/week-plan"
            style={{ color: "var(--m-accent)" }}
          >
            <Sparkles size={11} />
            打开周计划
          </Link>
        </div>
        <Link
          className="block rounded-2xl px-3 py-2.5 text-xs transition-colors hover:bg-black/5"
          href="/week-plan"
          style={{ boxShadow: "var(--m-shadow-in)", background: "var(--m-base)", color: "var(--m-ink2)" }}
        >
          <span style={{ color: "var(--m-accent)" }}>→ </span>
          周计划已升级为独立的待办管理页面，支持按目标分组、AI 生成行动清单、逐条勾选。
        </Link>
      </div>

      {/* ── Daily suggestion ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--m-ink2)" }}>
            <Zap size={12} style={{ color: "#D4A42A" }} />
            今日建议
          </span>
          <button
            className="flex items-center gap-1 text-[11px] hover:opacity-70 disabled:opacity-40"
            disabled={busy}
            onClick={() => void act("daily")}
            type="button"
            style={{ color: dailyStale ? "var(--m-accent)" : "var(--m-ink3)" }}
          >
            {isLoading("daily")
              ? <><Loader2 className="animate-spin" size={11} />生成中...</>
              : plan.dailySuggestion
                ? <><RefreshCw size={11} />刷新</>
                : <><Sparkles size={11} />获取今日建议</>}
          </button>
        </div>
        {plan.dailySuggestion
          ? (
            <div className="rounded-2xl p-3" style={{ boxShadow: "var(--m-shadow-in)", background: "var(--m-base)" }}>
              <DailyCard suggestion={plan.dailySuggestion} />
            </div>
          )
          : <p className="text-xs" style={{ color: "var(--m-ink3)" }}>每日一次 · 获取今天最重要的一个行动</p>}
      </div>

      {/* ── Adjust note ── */}
      {plan.adjustNote && (
        <div className="space-y-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--m-ink2)" }}>
            <Flame size={12} style={{ color: "#C0392B" }} />
            上次调整建议
          </span>
          <AdjustCard note={plan.adjustNote} />
        </div>
      )}

      {/* ── Adjust button ── */}
      <div>
        <button
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
          disabled={busy}
          onClick={() => setAdjustOpen(true)}
          type="button"
          style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1", border: "1px solid rgba(99,102,241,0.2)" }}
        >
          {isLoading("adjust") ? <Loader2 className="animate-spin" size={12} /> : <Bot size={12} />}
          AI 调整建议
        </button>
      </div>

      {/* Adjust context dialog */}
      <Dialog onClose={() => setAdjustOpen(false)} open={adjustOpen} title="AI 调整建议">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--m-ink2)" }}>
            告诉 AI 你最近的情况，它将评估并给出动态调整建议。
          </p>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            最近遇到的情况（选填）
            <Textarea
              autoFocus
              onChange={(e) => setAdjustContext(e.target.value)}
              placeholder="例：这周比较忙，执行了 2 项，卡在 xxx 上..."
              rows={3}
              value={adjustContext}
            />
          </label>
          <div className="flex justify-end gap-3">
            <Button onClick={() => setAdjustOpen(false)} type="button" variant="ghost">取消</Button>
            <Button
              disabled={busy}
              onClick={() => void act("adjust", adjustContext || undefined)}
              variant="primary"
            >
              {isLoading("adjust") ? "分析中..." : "生成建议"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

// ── Goal card with expandable mentor ─────────────────────────────────────────

function GoalCard({
  goal,
  mentorPlan,
  onEdit,
  onDelete,
  onMentorUpdated,
}: {
  goal: UserGoal;
  mentorPlan: MentorPlan;
  onEdit: () => void;
  onDelete: () => void;
  onMentorUpdated: (p: MentorPlan) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const progress = useMemo(() => calculateGoalProgress(goal), [goal]);
  const color = progress.isCompleted ? "#4A9B6F" : "var(--m-accent)";

  return (
    <div
      className="rounded-3xl p-6 transition-all duration-300"
      style={{
        background: "var(--m-base)",
        border: "1px solid var(--m-rule)",
        boxShadow: "var(--m-shadow-out)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug tracking-tight" style={{ color: "var(--m-ink)" }}>{goal.title}</p>
          {goal.deadline && (
            <p className="mt-0.5 text-xs" style={{ color: "var(--m-ink3)" }}>
              截止 {goal.deadline}
              {progress.daysLeft !== null && (
                <span className="ml-1.5">
                  {progress.daysLeft >= 0 ? `（剩 ${progress.daysLeft} 天）` : "（已逾期）"}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-lg p-1 hover:opacity-60 transition-opacity" onClick={onEdit} title="更新进度" type="button">
            <Pencil size={13} style={{ color: "var(--m-ink3)" }} />
          </button>
          <button className="rounded-lg p-1 hover:opacity-60 transition-opacity" onClick={onDelete} title="删除目标" type="button">
            <Trash2 size={13} style={{ color: "var(--m-ink3)" }} />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3 flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold" style={{ color }}>
            {progress.percentage}%
          </span>
          <span className="ml-2 text-xs" style={{ color: "var(--m-ink3)" }}>
            {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
          </span>
        </div>
        {progress.isCompleted
          ? <span className="text-xs font-medium" style={{ color: "#4A9B6F" }}>已完成 ✓</span>
          : progress.remaining > 0
            ? <span className="text-xs" style={{ color: "var(--m-ink3)" }}>还差 {progress.remaining.toLocaleString()}</span>
            : null}
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full"
        style={{ boxShadow: "var(--m-shadow-in)", background: "var(--m-base)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progress.percentage}%`,
            background: progress.isCompleted
              ? "linear-gradient(90deg, #4A9B6F, #68C48A)"
              : "linear-gradient(90deg, var(--m-accent), #C8906A)",
          }}
        />
      </div>

      {/* Expand toggle */}
      <button
        className="mt-4 flex w-full items-center justify-between rounded-2xl px-3 py-2 text-xs font-medium transition-all duration-200"
        onClick={() => setExpanded((v) => !v)}
        style={{
          boxShadow: expanded ? "var(--m-shadow-in)" : "var(--m-shadow-out)",
          background: "var(--m-base)",
          color: "var(--m-accent)",
        }}
        type="button"
      >
        <span className="flex items-center gap-1.5">
          <Bot size={12} />
          AI 导师
          {mentorPlan.phases.length > 0 && (
            <span className="rounded-full px-1.5 text-[9px]" style={{ background: "var(--m-accent)", color: "#fff" }}>
              {mentorPlan.phases.length} 阶段
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <MentorSection
          goal={goal}
          plan={mentorPlan}
          onPlanUpdated={onMentorUpdated}
        />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * v5 Life Path components — Quiet Bloom system
 * ────────────────────────────────────────────────────────────────── */

const V5_GOAL_ACCENTS = [
  "var(--v5-accent)",   // cocoa #8b5e3c
  "#a8853c",            // warm gold
  "#b96845",            // burnt sienna
  "#6a8554",            // muted sage
] as const;

function getGoalAccent(index: number): string {
  return V5_GOAL_ACCENTS[index % V5_GOAL_ACCENTS.length];
}

function V5LifePathHeader() {
  return (
    <div>
      <div className="v5-eyebrow">LIFE PATH · 人生主线</div>
      <h1
        className="v5-display mt-2"
        style={{
          margin: 0,
          fontSize: "clamp(34px, 4vw, 48px)",
          fontVariationSettings: '"opsz" 144, "SOFT" 60',
          fontWeight: 400,
          color: "var(--v5-ink)",
        }}
      >
        人生主线
      </h1>
      <p
        style={{
          margin: "12px 0 0",
          fontFamily: "var(--v5-serif)",
          fontVariationSettings: '"opsz" 14',
          fontSize: 16,
          lineHeight: 1.7,
          color: "var(--v5-ink2)",
          fontStyle: "italic",
          maxWidth: 560,
        }}
      >
        设定量化目标，拆解执行计划，让 AI 导师在每个关键节点陪伴你。
      </p>
    </div>
  );
}

function V5HeroStat({
  completed,
  total,
  onAdd,
}: {
  completed: number;
  total: number;
  onAdd: () => void;
}) {
  const sub = total === 0
    ? "添加第一个目标，开始一段慢一点的成长。"
    : completed >= total
      ? "全部完成了，可以静下来想想下一段方向。"
      : `再完成 ${total - completed} 个目标，就达成本月里程碑。`;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        borderRadius: 28,
        padding: "32px 36px",
        background: "linear-gradient(135deg, var(--v5-card) 0%, #faecc8 100%)",
        boxShadow: "var(--v5-sh-2)",
      }}
    >
      <div className="flex flex-wrap items-end justify-between" style={{ gap: 24 }}>
        <div>
          <div className="v5-eyebrow">OVERALL PROGRESS · 总览</div>
          <div className="mt-3 flex items-baseline" style={{ gap: 10 }}>
            <span
              className="v5-numeral"
              style={{
                fontSize: 64,
                fontVariationSettings: '"opsz" 144, "wght" 400',
                color: "var(--v5-ink)",
              }}
            >
              {completed} / {total}
            </span>
            <span style={{ fontFamily: "var(--v5-sans)", fontSize: 14, color: "var(--v5-ink3)" }}>
              已完成
            </span>
          </div>
          <p
            style={{
              margin: "10px 0 0",
              fontFamily: "var(--v5-serif)",
              fontVariationSettings: '"opsz" 14',
              fontSize: 13.5,
              fontStyle: "italic",
              color: "var(--v5-ink2)",
            }}
          >
            {sub}
          </p>
        </div>
        <button
          className="inline-flex items-center"
          onClick={onAdd}
          type="button"
          style={{
            gap: 6,
            padding: "10px 20px",
            borderRadius: 999,
            border: 0,
            background: "var(--v5-ink)",
            color: "#fff",
            fontFamily: "var(--v5-sans)",
            fontSize: 13.5,
            fontWeight: 500,
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(33,22,17,0.18)",
            transition: "transform var(--v5-dur) var(--v5-ease), background var(--v5-dur) var(--v5-ease)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.background = "var(--v5-accent)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.background = "var(--v5-ink)";
          }}
        >
          <Plus size={14} />
          添加新目标
        </button>
      </div>
    </div>
  );
}

function V5TimelineStrip({ goals }: { goals: UserGoal[] }) {
  const withDeadline = useMemo(() => {
    return goals
      .map((g, i) => ({ g, i, daysLeft: calculateGoalProgress(g).daysLeft }))
      .filter((x) => x.daysLeft !== null && x.daysLeft! >= 0);
  }, [goals]);

  const maxDays = useMemo(() => {
    const all = withDeadline.map((x) => x.daysLeft!);
    if (all.length === 0) return 365;
    return Math.max(60, ...all);
  }, [withDeadline]);

  return (
    <div>
      <div className="flex items-center justify-between" style={{ gap: 16 }}>
        <div className="v5-eyebrow">TIMELINE · 目标时间线</div>
        <span
          style={{
            fontFamily: "var(--v5-mono)",
            fontSize: 11,
            color: "var(--v5-ink3)",
            letterSpacing: "0.06em",
          }}
        >
          今 → +{maxDays} 天
        </span>
      </div>

      <div className="relative mt-6" style={{ height: 56 }}>
        <div
          className="absolute"
          style={{ left: 0, right: 0, top: 12, height: 1, background: "var(--v5-rule-strong)" }}
        />

        {/* Today marker */}
        <div
          className="absolute"
          style={{
            left: 0,
            top: 6,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "var(--v5-ink)",
            border: "3px solid #fff",
            outline: "1px solid var(--v5-accent)",
          }}
          title="今天"
        />
        <span
          className="absolute"
          style={{
            left: 0,
            top: 28,
            fontFamily: "var(--v5-sans)",
            fontSize: 11.5,
            color: "var(--v5-ink3)",
          }}
        >
          今
        </span>

        {/* Goal markers */}
        {withDeadline.map(({ g, i, daysLeft }) => {
          const pct = Math.min(100, Math.max(2, (daysLeft! / maxDays) * 100));
          const accent = getGoalAccent(i);
          const shortLabel = g.title.length > 4 ? `${g.title.slice(0, 4)}…` : g.title;
          return (
            <div className="absolute" key={g.id} style={{ left: `${pct}%`, top: 5, transform: "translateX(-50%)" }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: accent,
                  border: "2px solid #fff",
                  boxShadow: "0 2px 6px rgba(75,51,27,0.20)",
                }}
                title={`${g.title} · 剩 ${daysLeft} 天`}
              />
              <span
                className="absolute"
                style={{
                  top: 22,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontFamily: "var(--v5-serif)",
                  fontStyle: "italic",
                  fontSize: 11.5,
                  color: "var(--v5-ink2)",
                  whiteSpace: "nowrap",
                }}
              >
                {shortLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function V5GoalCard({
  goal,
  index,
  mentorPlan,
  onOpen,
}: {
  goal: UserGoal;
  index: number;
  mentorPlan: MentorPlan;
  onOpen: () => void;
}) {
  const [hov, setHov] = useState(false);
  const progress = useMemo(() => calculateGoalProgress(goal), [goal]);
  const accent = getGoalAccent(index);
  const daysLeft = progress.daysLeft;

  // Expected pace: how far along should you be by now (only if deadline given)
  let expected: number | null = null;
  if (goal.deadline && daysLeft !== null && daysLeft >= 0) {
    // Approx total days = elapsed + daysLeft. Use 365 fallback when no obvious start.
    // We don't know start date — approximate via progress fraction inversely.
    // Simplification: assume linear path; expected = (1 - daysLeft / (daysLeft + 30 * scale))
    // Pragmatic: use 180 days as default span when unknown.
    const totalDays = Math.max(daysLeft + 30, 180);
    expected = Math.min(100, Math.max(0, Math.round(((totalDays - daysLeft) / totalDays) * 100)));
  }

  const today = mentorPlan.dailySuggestion?.action;

  const aheadOrBehind = expected !== null
    ? progress.percentage - expected
    : null;

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        cursor: "pointer",
        background: "var(--v5-card)",
        border: "1px solid var(--v5-rule)",
        borderRadius: 22,
        padding: 24,
        boxShadow: hov ? "var(--v5-sh-hover)" : "var(--v5-sh-2)",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        transition: "transform var(--v5-dur) var(--v5-ease-out), box-shadow var(--v5-dur) var(--v5-ease-out)",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      {/* accent corner glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          top: 0,
          right: 0,
          width: 96,
          height: 96,
          background: `radial-gradient(circle at top right, ${accent}22 0%, transparent 70%)`,
          opacity: hov ? 1 : 0.6,
          transition: "opacity var(--v5-dur) var(--v5-ease)",
        }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between" style={{ gap: 10 }}>
        <div className="min-w-0 flex-1">
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--v5-serif)",
              fontSize: 18,
              fontWeight: 500,
              color: "var(--v5-ink)",
              letterSpacing: "-0.01em",
              lineHeight: 1.35,
            }}
          >
            {goal.title}
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontFamily: "var(--v5-mono)",
              fontSize: 11,
              color: "var(--v5-ink3)",
              letterSpacing: "0.04em",
            }}
          >
            {goal.deadline ?? "未设定截止"}
            {daysLeft !== null && (
              <span> · {daysLeft >= 0 ? `剩 ${daysLeft} 天` : "已逾期"}</span>
            )}
          </p>
        </div>
        <ChevronRight size={16} style={{ color: "var(--v5-ink-mute)", flexShrink: 0 }} />
      </div>

      {/* Big numeral */}
      <div className="flex items-baseline" style={{ gap: 8 }}>
        <span
          className="v5-numeral"
          style={{
            fontSize: 44,
            fontVariationSettings: '"opsz" 144, "wght" 400',
            color: "var(--v5-ink)",
          }}
        >
          {progress.percentage}%
        </span>
        <span
          style={{
            fontFamily: "var(--v5-sans)",
            fontSize: 12,
            color: "var(--v5-ink3)",
          }}
        >
          {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
        </span>
      </div>

      {/* Progress bar with rhythm marker */}
      <div className="relative" style={{ height: 6 }}>
        <div
          className="absolute inset-0"
          style={{
            borderRadius: 999,
            background: "rgba(75,51,27,0.08)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress.percentage}%`,
              background: `linear-gradient(90deg, ${accent}aa, ${accent})`,
              transition: "width var(--v5-dur-slow) var(--v5-ease-out)",
            }}
          />
          {/* tick gaps */}
          {[25, 50, 75].map((pct) => (
            <div
              key={pct}
              className="absolute"
              style={{
                left: `${pct}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "var(--v5-card)",
              }}
            />
          ))}
        </div>
        {/* expected-pace marker */}
        {expected !== null && (
          <div
            className="absolute"
            style={{
              left: `${expected}%`,
              top: -3,
              width: 2,
              height: 12,
              background: "var(--v5-ink)",
              borderRadius: 1,
              transform: "translateX(-50%)",
            }}
            title={`节奏参考：${expected}%`}
          />
        )}
      </div>

      {/* Micro stats */}
      <div
        className="flex items-center justify-between"
        style={{
          fontFamily: "var(--v5-sans)",
          fontSize: 11,
          color: "var(--v5-ink3)",
        }}
      >
        <span>
          {progress.remaining > 0
            ? `还差 ${progress.remaining.toLocaleString()}`
            : "已达成 ✓"}
        </span>
        {aheadOrBehind !== null && Math.abs(aheadOrBehind) >= 1 && (
          <span
            style={{
              color: aheadOrBehind >= 0 ? "#6a8554" : "var(--v5-rose)",
              fontWeight: 600,
            }}
          >
            {aheadOrBehind >= 0 ? "↑ 领先" : "↓ 落后"} {Math.abs(aheadOrBehind)}%
          </span>
        )}
      </div>

      {/* Today suggestion */}
      {today && (
        <div
          className="flex items-start"
          style={{
            gap: 6,
            paddingTop: 12,
            borderTop: "1px dashed var(--v5-rule)",
          }}
        >
          <Sparkles size={13} style={{ color: "var(--v5-accent)", flexShrink: 0, marginTop: 2 }} />
          <p
            style={{
              margin: 0,
              fontFamily: "var(--v5-serif)",
              fontStyle: "italic",
              fontSize: 12.5,
              lineHeight: 1.5,
              color: "var(--v5-ink2)",
              display: "-webkit-box",
              WebkitLineClamp: 1,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {today}
          </p>
        </div>
      )}
    </div>
  );
}

function V5Section({
  label,
  action,
  onAction,
  actionHref,
  actionBusy,
  children,
}: {
  label: string;
  action?: string;
  onAction?: () => void;
  actionHref?: string;
  actionBusy?: boolean;
  children: React.ReactNode;
}) {
  const actionStyle: React.CSSProperties = {
    border: 0,
    background: "transparent",
    color: "var(--v5-accent)",
    fontFamily: "var(--v5-sans)",
    fontSize: 12,
    fontWeight: 500,
    cursor: actionBusy ? "wait" : "pointer",
    padding: 0,
    opacity: actionBusy ? 0.6 : 1,
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span
          className="v5-eyebrow"
          style={{ fontSize: 10 }}
        >
          {label}
        </span>
        {action && (
          actionHref ? (
            <Link href={actionHref} style={actionStyle}>{action}</Link>
          ) : (
            <button disabled={actionBusy} onClick={onAction} style={actionStyle} type="button">
              {actionBusy && <Loader2 className="animate-spin" size={11} />}
              {action}
            </button>
          )
        )}
      </div>
      <div
        style={{
          borderRadius: 14,
          padding: 16,
          background: "var(--v5-card)",
          border: "1px solid var(--v5-rule)",
          boxShadow: "var(--v5-sh-1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function V5GoalDrawer({
  goal,
  index,
  mentorPlan,
  onClose,
  onEdit,
  onDelete,
  onRunMentor,
}: {
  goal: UserGoal | null;
  index: number;
  mentorPlan: MentorPlan;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRunMentor: (action: MentorAction) => Promise<void>;
}) {
  const [loadingAction, setLoadingAction] = useState<MentorAction | null>(null);
  const [mentorError, setMentorError] = useState("");

  useEffect(() => {
    if (!goal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goal, onClose]);

  const runAction = async (action: MentorAction) => {
    setLoadingAction(action);
    setMentorError("");
    try {
      await onRunMentor(action);
    } catch (err) {
      setMentorError(err instanceof Error ? err.message : "AI 调用失败，请稍后重试。");
    } finally {
      setLoadingAction(null);
    }
  };

  if (!goal) return null;
  const progress = calculateGoalProgress(goal);
  const accent = getGoalAccent(index);
  const C = 2 * Math.PI * 36;

  return (
    <div
      className="fixed inset-0"
      onClick={onClose}
      style={{
        zIndex: 90,
        background: "rgba(33,22,17,0.32)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <aside
        className="absolute right-0 top-0 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        style={{
          width: "min(420px, 100%)",
          background: "var(--v5-bg)",
          boxShadow: "-12px 0 40px rgba(33,22,17,0.18)",
          padding: 28,
          animation: "v5-drawer-in 280ms var(--v5-ease-out)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="v5-eyebrow">GOAL · 目标详情</span>
          <button
            aria-label="关闭"
            onClick={onClose}
            type="button"
            style={{
              border: 0,
              background: "transparent",
              color: "var(--v5-ink3)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <h2
          className="v5-display mt-3"
          style={{
            margin: "12px 0 0",
            fontSize: 30,
            fontVariationSettings: '"opsz" 144',
            fontWeight: 400,
            color: "var(--v5-ink)",
          }}
        >
          {goal.title}
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: "var(--v5-mono)",
            fontSize: 11.5,
            color: "var(--v5-ink3)",
            letterSpacing: "0.04em",
          }}
        >
          {goal.deadline ?? "未设定截止"}
          {progress.daysLeft !== null && (
            <span> · {progress.daysLeft >= 0 ? `剩 ${progress.daysLeft} 天` : "已逾期"}</span>
          )}
        </p>

        {/* Big stat card */}
        <div
          className="mt-6 flex items-center"
          style={{
            gap: 18,
            padding: 18,
            borderRadius: 18,
            background: "var(--v5-card)",
            border: "1px solid var(--v5-rule)",
            boxShadow: "var(--v5-sh-1)",
          }}
        >
          <svg height="92" viewBox="0 0 92 92" width="92">
            <circle cx="46" cy="46" fill="none" r="36" stroke="var(--v5-rule)" strokeWidth="6" />
            <circle
              cx="46"
              cy="46"
              fill="none"
              r="36"
              stroke={accent}
              strokeDasharray={`${(C * progress.percentage) / 100} ${C}`}
              strokeLinecap="round"
              strokeWidth="6"
              transform="rotate(-90 46 46)"
            />
            <text
              dominantBaseline="middle"
              style={{ fontFamily: "var(--v5-serif)", fontSize: 18, fontWeight: 500, fill: "var(--v5-ink)" }}
              textAnchor="middle"
              x="46"
              y="50"
            >
              {progress.percentage}%
            </text>
          </svg>
          <div style={{ display: "grid", gap: 4, fontFamily: "var(--v5-sans)", fontSize: 12.5, color: "var(--v5-ink2)" }}>
            <div>
              已积累 <span style={{ color: "var(--v5-ink)", fontWeight: 600 }}>{goal.currentValue.toLocaleString()}</span>
            </div>
            <div>
              目标 <span style={{ color: "var(--v5-ink)", fontWeight: 600 }}>{goal.targetValue.toLocaleString()}</span>
            </div>
            <div>
              还差 <span style={{ color: "var(--v5-ink)", fontWeight: 600 }}>{progress.remaining.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {mentorError && (
          <p
            className="mt-4"
            style={{
              fontFamily: "var(--v5-sans)",
              fontSize: 12,
              color: "var(--v5-rose)",
            }}
          >
            {mentorError}
          </p>
        )}

        {/* Today suggestion */}
        <div className="mt-6">
          <V5Section
            action={mentorPlan.dailySuggestion ? "✦ 重新生成" : "✦ 生成今日建议"}
            actionBusy={loadingAction === "daily"}
            label="TODAY · 今日建议"
            onAction={() => void runAction("daily")}
          >
            {mentorPlan.dailySuggestion ? (
              <>
                <p
                  style={{
                    margin: 0,
                    fontFamily: "var(--v5-serif)",
                    fontStyle: "italic",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "var(--v5-ink)",
                  }}
                >
                  {mentorPlan.dailySuggestion.action}
                </p>
                {mentorPlan.dailySuggestion.reason && (
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontFamily: "var(--v5-sans)",
                      fontSize: 12.5,
                      lineHeight: 1.65,
                      color: "var(--v5-ink2)",
                    }}
                  >
                    {mentorPlan.dailySuggestion.reason}
                  </p>
                )}
              </>
            ) : (
              <p style={{ margin: 0, fontFamily: "var(--v5-sans)", fontSize: 12.5, color: "var(--v5-ink3)" }}>
                还没有今日建议。展开 AI 导师区块生成一条。
              </p>
            )}
          </V5Section>
        </div>

        {/* This week */}
        <div className="mt-5">
          <V5Section
            action={mentorPlan.weeklyPlan ? "打开周计划 →" : "✦ 生成本周计划"}
            actionBusy={loadingAction === "weekly"}
            actionHref={mentorPlan.weeklyPlan ? "/week-plan" : undefined}
            label="THIS WEEK · 本周计划"
            onAction={mentorPlan.weeklyPlan ? undefined : () => void runAction("weekly")}
          >
            {mentorPlan.weeklyPlan?.actions?.length ? (
              <ul className="m-0 list-none p-0" style={{ display: "grid", gap: 10 }}>
                {mentorPlan.weeklyPlan.actions.map((a, i) => (
                  <li
                    className="flex items-start"
                    key={i}
                    style={{
                      gap: 8,
                      fontFamily: "var(--v5-serif)",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      color: "var(--v5-ink)",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        border: `1.5px solid ${accent}`,
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                    />
                    {a}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, fontFamily: "var(--v5-sans)", fontSize: 12.5, color: "var(--v5-ink3)" }}>
                本周还没有计划。
              </p>
            )}
          </V5Section>
        </div>

        {/* Milestones */}
        <div className="mt-5">
          <V5Section
            action={mentorPlan.phases.length ? "✦ 重新拆解" : "✦ 拆解阶段"}
            actionBusy={loadingAction === "breakdown"}
            label="MILESTONES · 目标阶段"
            onAction={() => void runAction("breakdown")}
          >
            {mentorPlan.phases.length ? (
              <ul className="m-0 list-none p-0" style={{ display: "grid", gap: 12 }}>
                {mentorPlan.phases.map((p) => {
                  const done = !p.isCurrent && p.index === 0; // crude: first phase done if not current — keep simple
                  return (
                    <li
                      className="flex items-start"
                      key={p.index}
                      style={{ gap: 10 }}
                    >
                      <span
                        className="grid place-items-center"
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: p.isCurrent ? accent : "rgba(75,51,27,0.08)",
                          color: p.isCurrent ? "#fff" : "var(--v5-ink3)",
                          flexShrink: 0,
                          fontFamily: "var(--v5-sans)",
                          fontSize: 11,
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        {done ? "✓" : p.index + 1}
                      </span>
                      <div>
                        <div
                          style={{
                            fontFamily: "var(--v5-serif)",
                            fontSize: 13.5,
                            fontWeight: 500,
                            color: "var(--v5-ink)",
                            lineHeight: 1.45,
                          }}
                        >
                          {p.title}{" "}
                          <span style={{ color: "var(--v5-ink3)", fontWeight: 400, fontSize: 11 }}>
                            ({p.progressRange})
                          </span>
                        </div>
                        {p.description && (
                          <div
                            style={{
                              marginTop: 3,
                              fontFamily: "var(--v5-serif)",
                              fontStyle: "italic",
                              fontSize: 12.5,
                              lineHeight: 1.6,
                              color: "var(--v5-ink2)",
                            }}
                          >
                            {p.description}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ margin: 0, fontFamily: "var(--v5-sans)", fontSize: 12.5, color: "var(--v5-ink3)" }}>
                还没有阶段拆解。
              </p>
            )}
          </V5Section>
        </div>

        {/* Footer actions */}
        <div className="mt-7 flex items-center justify-end" style={{ gap: 10 }}>
          <button
            onClick={onDelete}
            type="button"
            style={{
              padding: "10px 18px",
              borderRadius: 999,
              border: "1px solid var(--v5-rule-strong)",
              background: "transparent",
              color: "var(--v5-ink3)",
              fontFamily: "var(--v5-sans)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            归档
          </button>
          <button
            className="inline-flex items-center"
            onClick={onEdit}
            type="button"
            style={{
              gap: 6,
              padding: "10px 18px",
              borderRadius: 999,
              border: 0,
              background: "var(--v5-ink)",
              color: "#fff",
              fontFamily: "var(--v5-sans)",
              fontSize: 13.5,
              fontWeight: 500,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(33,22,17,0.18)",
            }}
          >
            <Pencil size={13} />
            编辑目标
          </button>
        </div>
      </aside>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function emptyMentorPlan(goalId: string): MentorPlan {
  return {
    goalId,
    context: null,
    phases: [],
    phasesGeneratedAt: null,
    weeklyPlan: null,
    weeklyGeneratedAt: null,
    dailySuggestion: null,
    dailyGeneratedAt: null,
    adjustNote: null,
  };
}

export default function LifePathPage() {
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [mentorPlans, setMentorPlans] = useState<Record<string, MentorPlan>>({});

  // ── Add goal dialog ──────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTarget, setDraftTarget] = useState("");
  const [draftCurrent, setDraftCurrent] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("");

  // ── Update progress dialog ───────────────────────────────────────────────────
  const [editGoal, setEditGoal] = useState<UserGoal | null>(null);
  const [editCurrent, setEditCurrent] = useState("");

  useEffect(() => {
    setGoals(loadGoals());
    setMentorPlans(loadMentorPlans());
    // Pull cloud state on mount so a freshly logged-in device backfills.
    void refreshLifePathState().then(() => {
      setGoals(loadGoals());
      setMentorPlans(loadMentorPlans());
    });
  }, []);

  const persist = (next: UserGoal[]) => { setGoals(next); saveGoals(next); };

  const getMentorPlan = (goalId: string): MentorPlan =>
    mentorPlans[goalId] ?? emptyMentorPlan(goalId);

  const handleMentorUpdate = (plan: MentorPlan) => {
    setMentorPlans((prev) => ({ ...prev, [plan.goalId]: plan }));
  };

  // ── Add goal ─────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setDraftTitle(""); setDraftTarget(""); setDraftCurrent(""); setDraftDeadline("");
    setAddOpen(true);
  };

  const submitAdd = (e: FormEvent) => {
    e.preventDefault();
    const target = Number(draftTarget);
    if (!draftTitle.trim() || !target) return;
    persist([
      ...goals,
      {
        id: crypto.randomUUID(),
        title: draftTitle.trim(),
        targetValue: target,
        currentValue: Number(draftCurrent) || 0,
        ...(draftDeadline ? { deadline: draftDeadline } : {}),
      },
    ]);
    setAddOpen(false);
  };

  // ── Edit goal ─────────────────────────────────────────────────────────────────
  const openEdit = (goal: UserGoal) => { setEditGoal(goal); setEditCurrent(String(goal.currentValue)); };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editGoal) return;
    persist(goals.map((g) => g.id === editGoal.id ? { ...g, currentValue: Math.max(0, Number(editCurrent) || 0) } : g));
    setEditGoal(null);
  };

  // ── Delete goal ───────────────────────────────────────────────────────────────
  const deleteGoal = (id: string) => {
    if (!window.confirm("确认删除该目标？")) return;
    persist(goals.filter((g) => g.id !== id));
    deleteMentorPlan(id);
    setMentorPlans((prev) => { const n = { ...prev }; delete n[id]; return n; });
  };

  const completedCount = goals.filter((g) => calculateGoalProgress(g).isCompleted).length;

  // v5 desktop: drawer state — which goal is open
  const [drawerGoalId, setDrawerGoalId] = useState<string | null>(null);
  const drawerGoal = goals.find((g) => g.id === drawerGoalId) ?? null;
  const drawerIndex = drawerGoal ? goals.findIndex((g) => g.id === drawerGoal.id) : 0;

  // v5 drawer → call existing AI mentor; reuse the same persistence path as MentorSection.
  const runMentorForDrawer = useCallback(
    async (action: MentorAction) => {
      if (!drawerGoal) return;
      const res = await callMentor(action, drawerGoal);
      if (!res.available) throw new Error(res.message ?? "AI 功能未配置。");
      if (!res.data) throw new Error(res.message ?? "AI 返回为空，请重试。");
      const d = res.data as Record<string, unknown>;
      const currentPlan = getMentorPlan(drawerGoal.id);
      let updated = { ...currentPlan };
      if (action === "breakdown") {
        updated = {
          ...updated,
          phases: (d.phases ?? []) as GoalPhase[],
          phasesGeneratedAt: new Date().toISOString(),
        };
      } else if (action === "weekly") {
        updated = {
          ...updated,
          weeklyPlan: d as unknown as WeeklyPlan,
          weeklyGeneratedAt: currentWeekKey(),
        };
      } else if (action === "daily") {
        updated = {
          ...updated,
          dailySuggestion: d as unknown as DailySuggestion,
          dailyGeneratedAt: todayKey(),
        };
      } else if (action === "adjust") {
        updated = { ...updated, adjustNote: d as unknown as AdjustNote };
      }
      saveMentorPlan(updated);
      handleMentorUpdate(updated);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawerGoal, mentorPlans],
  );

  return (
    <PageTransition className="space-y-6">
      {/* ── Desktop v5 layout ── */}
      <section className="hidden md:block">
        <div className="grid" style={{ gap: 32 }}>
          <V5LifePathHeader />

          <V5HeroStat completed={completedCount} onAdd={openAdd} total={goals.length} />

          {goals.length > 0 && <V5TimelineStrip goals={goals} />}

          <div>
            <div className="mb-5 flex flex-wrap items-end justify-between" style={{ gap: 16 }}>
              <div>
                <div className="v5-eyebrow">ACTIVE GOALS · 进行中</div>
                <h2
                  className="v5-display mt-2"
                  style={{
                    margin: 0,
                    fontSize: 28,
                    fontVariationSettings: '"opsz" 144',
                    fontWeight: 400,
                    color: "var(--v5-ink)",
                  }}
                >
                  持续追的 {goals.length} 个方向
                </h2>
              </div>
              <span
                style={{
                  fontFamily: "var(--v5-sans)",
                  fontSize: 12,
                  color: "var(--v5-ink3)",
                }}
              >
                点击卡片查看 AI 详情
              </span>
            </div>

            {goals.length === 0 ? (
              <div
                className="rounded-[22px] border border-dashed px-6 py-14 text-center"
                style={{ borderColor: "var(--v5-rule-strong)", background: "var(--v5-card)" }}
              >
                <Target className="mx-auto mb-3" size={28} style={{ color: "var(--v5-accent)" }} />
                <p style={{ margin: 0, fontFamily: "var(--v5-serif)", fontSize: 16, fontWeight: 500, color: "var(--v5-ink)" }}>
                  还没有人生目标
                </p>
                <p
                  style={{
                    margin: "8px 0 0",
                    fontFamily: "var(--v5-serif)",
                    fontStyle: "italic",
                    fontSize: 13,
                    color: "var(--v5-ink2)",
                  }}
                >
                  例如：存款 100 万 · 读完 50 本书 · 跑完一个马拉松
                </p>
              </div>
            ) : (
              <div
                className="grid"
                style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 18 }}
              >
                {goals.map((g, i) => (
                  <V5GoalCard
                    goal={g}
                    index={i}
                    key={g.id}
                    mentorPlan={getMentorPlan(g.id)}
                    onOpen={() => setDrawerGoalId(g.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Mobile (existing layout) ── */}
      <div className="md:hidden space-y-6">
      <PageTitle
        description="设定量化目标，拆解执行计划，每天更新进度，让 AI 导师持续陪伴成长。"
        eyebrow="LIFE PATH"
        icon={Compass}
        title="人生主线"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button onClick={openAdd} variant="primary">
          <Plus className="mr-2" size={14} />
          新增目标
        </Button>
        {goals.length > 0 && (
          <span className="text-sm" style={{ color: "var(--m-ink3)" }}>
            {completedCount} / {goals.length} 已完成
          </span>
        )}
      </div>

      {/* Goal list */}
      {goals.length === 0 ? (
        <div
          className="rounded-3xl py-20 text-center"
          style={{ background: "var(--m-base)", boxShadow: "var(--m-shadow-out)", border: "1px solid var(--m-rule)" }}
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ boxShadow: "var(--m-shadow-out)", background: "var(--m-base)" }}>
            <Target size={28} style={{ color: "var(--m-accent)" }} />
          </div>
          <p className="text-sm font-bold" style={{ color: "var(--m-ink)" }}>还没有人生目标</p>
          <p className="mt-1.5 text-xs" style={{ color: "var(--m-ink3)" }}>
            例如：存款 100 万 · 读完 50 本书 · 跑完一个马拉松
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <GoalCard
              goal={g}
              key={g.id}
              mentorPlan={getMentorPlan(g.id)}
              onDelete={() => deleteGoal(g.id)}
              onEdit={() => openEdit(g)}
              onMentorUpdated={handleMentorUpdate}
            />
          ))}
        </div>
      )}
      </div>

      {/* v5 Goal drawer (desktop only) */}
      <V5GoalDrawer
        goal={drawerGoal}
        index={drawerIndex}
        mentorPlan={drawerGoal ? getMentorPlan(drawerGoal.id) : emptyMentorPlan("")}
        onClose={() => setDrawerGoalId(null)}
        onDelete={() => {
          if (drawerGoal) {
            deleteGoal(drawerGoal.id);
            setDrawerGoalId(null);
          }
        }}
        onEdit={() => {
          if (drawerGoal) {
            openEdit(drawerGoal);
            setDrawerGoalId(null);
          }
        }}
        onRunMentor={runMentorForDrawer}
      />

      {/* ── Add Goal Dialog ── */}
      <Dialog onClose={() => setAddOpen(false)} open={addOpen} title="新增人生目标">
        <form className="space-y-4" onSubmit={submitAdd}>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            目标名称 *
            <Input autoFocus onChange={(e) => setDraftTitle(e.target.value)} placeholder="例：存款达到 100 万" required value={draftTitle} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              目标值 *
              <Input min="1" onChange={(e) => setDraftTarget(e.target.value)} placeholder="1000000" required type="number" value={draftTarget} />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              当前进度
              <Input min="0" onChange={(e) => setDraftCurrent(e.target.value)} placeholder="0" type="number" value={draftCurrent} />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            截止日期（选填）
            <Input onChange={(e) => setDraftDeadline(e.target.value)} type="date" value={draftDeadline} />
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <Button onClick={() => setAddOpen(false)} type="button" variant="ghost">取消</Button>
            <Button disabled={!draftTitle.trim() || !draftTarget} type="submit" variant="primary">确认添加</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Update Progress Dialog ── */}
      <Dialog onClose={() => setEditGoal(null)} open={editGoal !== null} title={editGoal ? `更新进度 — ${editGoal.title}` : "更新进度"}>
        {editGoal && (
          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="rounded-xl p-3 text-sm" style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}>
              <span style={{ color: "var(--m-ink3)" }}>目标值：</span>
              <span className="font-semibold" style={{ color: "var(--m-ink)" }}>{editGoal.targetValue.toLocaleString()}</span>
            </div>
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              当前进度（绝对值）
              <Input autoFocus min="0" onChange={(e) => setEditCurrent(e.target.value)} placeholder={String(editGoal.currentValue)} type="number" value={editCurrent} />
            </label>
            <div className="flex justify-end gap-3 pt-1">
              <Button onClick={() => setEditGoal(null)} type="button" variant="ghost">取消</Button>
              <Button type="submit" variant="primary">保存进度</Button>
            </div>
          </form>
        )}
      </Dialog>
    </PageTransition>
  );
}
