"use client";

import { Bot, CalendarDays, ChevronDown, ChevronUp, Compass, Flame, Loader2, Map, Pencil, Plus, RefreshCw, Sparkles, Target, Trash2, Zap } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

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

function PhaseRow({ phase, isLast }: { phase: GoalPhase; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Stepper spine */}
      <div className="flex flex-col items-center">
        <div
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
          style={{
            background: phase.isCurrent
              ? "linear-gradient(135deg, var(--m-accent), #C8906A)"
              : phase.index < (phase.index) ? "var(--m-rule)" : "var(--m-rule)",
            color: phase.isCurrent ? "#fff" : "var(--m-ink3)",
            boxShadow: phase.isCurrent ? "0 2px 6px rgba(139,94,60,0.35)" : "none",
          }}
        >
          {phase.index + 1}
        </div>
        {!isLast && (
          <div
            className="mt-1 w-px flex-1"
            style={{
              minHeight: 20,
              background: phase.isCurrent
                ? "linear-gradient(to bottom, var(--m-accent), rgba(139,94,60,0.1))"
                : "linear-gradient(to bottom, var(--m-rule), transparent)",
            }}
          />
        )}
      </div>

      {/* Content */}
      <div
        className="mb-3 min-w-0 flex-1 rounded-xl p-3"
        style={{
          background: phase.isCurrent ? "rgba(139,94,60,0.05)" : "transparent",
          border: phase.isCurrent ? "1px solid rgba(139,94,60,0.12)" : "1px solid transparent",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-semibold"
            style={{ color: phase.isCurrent ? "var(--m-accent)" : "var(--m-ink2)" }}
          >
            {phase.title}
          </span>
          <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>{phase.progressRange}</span>
          {phase.isCurrent && (
            <span
              className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: "linear-gradient(135deg, var(--m-accent), #C8906A)", color: "#fff" }}
            >
              当前
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-5" style={{ color: "var(--m-ink3)" }}>{phase.description}</p>
        {phase.isCurrent && phase.keyActions.length > 0 && (
          <ul className="mt-2 space-y-1">
            {phase.keyActions.map((a, i) => (
              <li className="flex items-start gap-1.5 text-xs" key={i} style={{ color: "var(--m-ink2)" }}>
                <span className="mt-px shrink-0 text-[8px]" style={{ color: "var(--m-accent)" }}>◆</span>
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function WeeklyCard({ plan }: { plan: WeeklyPlan }) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--m-ink3)" }}>本周重点</span>
        <span className="text-xs font-medium" style={{ color: "var(--m-ink)" }}>{plan.focus}</span>
      </div>
      <ul className="space-y-1">
        {plan.actions.map((a, i) => (
          <li className="flex gap-1.5 text-xs" key={i} style={{ color: "var(--m-ink2)" }}>
            <span style={{ color: "var(--m-accent)" }}>{i + 1}.</span>{a}
          </li>
        ))}
      </ul>
      {plan.reminder && (
        <p className="rounded-lg px-2.5 py-1.5 text-xs italic" style={{ background: "rgba(212,164,42,0.08)", color: "#7A5F00" }}>
          ⚠ {plan.reminder}
        </p>
      )}
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
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "rgba(139,94,60,0.12)" }}>
              <Map size={10} style={{ color: "var(--m-accent)" }} />
            </span>
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
          <div className="pt-1">
            {plan.phases.map((p) => (
              <PhaseRow isLast={p.index === plan.phases.length - 1} key={p.index} phase={p} />
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
            点击「生成计划」将目标拆解为可执行阶段
          </p>
        )}
      </div>

      {/* ── Weekly plan ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--m-ink2)" }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "rgba(74,155,111,0.12)" }}>
              <CalendarDays size={10} style={{ color: "#4A9B6F" }} />
            </span>
            本周计划
          </span>
          <button
            className="flex items-center gap-1 text-[11px] hover:opacity-70 disabled:opacity-40"
            disabled={busy}
            onClick={() => void act("weekly")}
            type="button"
            style={{ color: weeklyStale ? "var(--m-accent)" : "var(--m-ink3)" }}
          >
            {isLoading("weekly")
              ? <><Loader2 className="animate-spin" size={11} />生成中...</>
              : plan.weeklyPlan
                ? <><RefreshCw size={11} />更新</>
                : <><Sparkles size={11} />生成周计划</>}
          </button>
        </div>
        {plan.weeklyPlan
          ? (
            <div className="rounded-2xl p-3" style={{ boxShadow: "var(--m-shadow-in)", background: "var(--m-base)" }}>
              <WeeklyCard plan={plan.weeklyPlan} />
            </div>
          )
          : <p className="text-xs" style={{ color: "var(--m-ink3)" }}>每周一次 · 点击生成本周行动计划</p>}
      </div>

      {/* ── Daily suggestion ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--m-ink2)" }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "rgba(212,164,42,0.12)" }}>
              <Zap size={10} style={{ color: "#D4A42A" }} />
            </span>
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
            <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ background: "rgba(192,57,43,0.10)" }}>
              <Flame size={10} style={{ color: "#C0392B" }} />
            </span>
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
      className="rounded-3xl p-6 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.6)",
        boxShadow: "0 4px 24px rgba(139,94,60,0.10), 0 1px 4px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-serif text-base font-bold leading-snug tracking-tight" style={{ color: "var(--m-ink)" }}>
            {goal.title}
          </p>
          {goal.deadline && (
            <p className="mt-1 text-[11px]" style={{ color: "var(--m-ink3)" }}>
              📅 截止 {goal.deadline}
              {progress.daysLeft !== null && (
                <span className="ml-1">
                  {progress.daysLeft >= 0 ? `（剩 ${progress.daysLeft} 天）` : "（已逾期）"}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            className="rounded-xl p-1.5 transition-all hover:opacity-70"
            onClick={onEdit}
            title="更新进度"
            type="button"
            style={{ background: "rgba(139,94,60,0.06)" }}
          >
            <Pencil size={12} style={{ color: "var(--m-accent)" }} />
          </button>
          <button
            className="rounded-xl p-1.5 transition-all hover:opacity-70"
            onClick={onDelete}
            title="删除目标"
            type="button"
            style={{ background: "rgba(192,57,43,0.05)" }}
          >
            <Trash2 size={12} style={{ color: "#C0392B" }} />
          </button>
        </div>
      </div>

      {/* Progress numbers */}
      <div className="mt-4 flex items-end justify-between">
        <div className="flex items-baseline gap-2">
          <span
            className="font-sans text-4xl font-black leading-none"
            style={{ color, letterSpacing: "-0.03em" }}
          >
            {progress.percentage}%
          </span>
          <span className="font-sans text-[11px]" style={{ color: "var(--m-ink3)" }}>
            {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
          </span>
        </div>
        {progress.isCompleted ? (
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "rgba(74,155,111,0.1)", color: "#4A9B6F" }}>
            已完成 ✓
          </span>
        ) : progress.remaining > 0 ? (
          <span className="font-sans text-[11px]" style={{ color: "var(--m-ink3)" }}>
            还差 <span style={{ color: "var(--m-ink2)", fontWeight: 600 }}>{progress.remaining.toLocaleString()}</span>
          </span>
        ) : null}
      </div>

      {/* Progress bar — thick capsule */}
      <div
        className="mt-3 h-4 overflow-hidden rounded-full"
        style={{
          background: "rgba(139,94,60,0.08)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.08)",
        }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progress.percentage}%`,
            background: progress.isCompleted
              ? "linear-gradient(90deg, #3D8B63, #68C48A)"
              : "linear-gradient(90deg, #8B5E3C, #C8906A, #D4A87A)",
            boxShadow: "inset 0 1px 2px rgba(255,255,255,0.3)",
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

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="设定量化目标，拆解执行计划，每天更新进度，让 AI 导师持续陪伴成长。"
        eyebrow="LIFE PATH"
        icon={Compass}
        title="人生主线"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <Button
          onClick={openAdd}
          variant="primary"
          style={{ boxShadow: "var(--m-shadow-out), inset 0 1px 6px rgba(255,255,255,0.22)" }}
        >
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
        <div className="mx-auto grid w-full max-w-5xl gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
