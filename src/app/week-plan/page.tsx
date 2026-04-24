"use client";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import {
  currentWeekKey,
  ensureWeekPlan,
  formatWeekLabel,
  loadGoals,
  loadMentorPlans,
  loadWeekPlan,
  removeWeekTask,
  saveWeekPlan,
  shiftWeekKey,
  todayKey,
  upsertWeekTask,
} from "@/lib/life-path-storage";
import type { MentorPlan, UserGoal, WeekPlan, WeekTask } from "@/types/life-path";

// ── Small id helper ──────────────────────────────────────────────────────────

function uid(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── AI generation helper ─────────────────────────────────────────────────────

type MentorWeeklyResponse = {
  available: boolean;
  data: { focus?: string; actions?: string[]; reminder?: string } | null;
  message?: string;
};

async function generateWeeklyForGoal(goal: UserGoal): Promise<MentorWeeklyResponse> {
  const resp = await fetch("/api/life-path-mentor", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "weekly",
      goal: {
        title: goal.title,
        targetValue: goal.targetValue,
        currentValue: goal.currentValue,
        deadline: goal.deadline,
      },
      today: todayKey(),
    }),
  });
  return resp.json() as Promise<MentorWeeklyResponse>;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function WeekSwitcher({
  weekKey,
  onChange,
}: {
  weekKey: string;
  onChange: (next: string) => void;
}) {
  const thisWeek = currentWeekKey();
  const isPast = weekKey < thisWeek;
  const isFuture = weekKey > thisWeek;
  const label = formatWeekLabel(weekKey);

  return (
    <div
      className="inline-flex items-center gap-1 rounded-full px-1 py-1"
      style={{
        background: "var(--m-base)",
        border: "1px solid var(--m-rule)",
        boxShadow: "var(--m-shadow-in)",
      }}
    >
      <button
        aria-label="上一周"
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/5"
        onClick={() => onChange(shiftWeekKey(weekKey, -1))}
        type="button"
        style={{ color: "var(--m-ink2)" }}
      >
        <ChevronLeft size={14} />
      </button>
      <span
        className="min-w-[88px] text-center text-xs font-semibold"
        style={{ color: isPast ? "var(--m-ink3)" : "var(--m-ink)" }}
      >
        {label}
        {isFuture && <span className="ml-1 text-[10px]" style={{ color: "var(--m-ink3)" }}>（未来）</span>}
      </span>
      <button
        aria-label="下一周"
        className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-black/5"
        onClick={() => onChange(shiftWeekKey(weekKey, 1))}
        type="button"
        style={{ color: "var(--m-ink2)" }}
      >
        <ChevronRight size={14} />
      </button>
      {weekKey !== thisWeek && (
        <button
          className="ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
          onClick={() => onChange(thisWeek)}
          type="button"
          style={{ background: "var(--m-accent)", color: "#fff" }}
        >
          回到本周
        </button>
      )}
    </div>
  );
}

function FocusBlock({
  value,
  onSave,
  readonly,
}: {
  value: string;
  onSave: (v: string) => void;
  readonly: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  if (editing && !readonly) {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          className="flex-1"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onSave(draft.trim());
              setEditing(false);
            } else if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          placeholder="本周最重要的一件事..."
          value={draft}
        />
        <Button
          onClick={() => {
            onSave(draft.trim());
            setEditing(false);
          }}
          variant="primary"
        >
          保存
        </Button>
      </div>
    );
  }

  return (
    <div
      className="group flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{
        background: "var(--m-base)",
        border: "1px solid var(--m-rule)",
        boxShadow: "var(--m-shadow-in)",
      }}
    >
      <Target size={16} className="mt-0.5 shrink-0" style={{ color: "var(--m-accent)" }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
          本周焦点
        </p>
        <p
          className="mt-1 text-sm leading-6"
          style={{ color: value ? "var(--m-ink)" : "var(--m-ink3)" }}
        >
          {value || (readonly ? "本周未设置焦点" : "点击右侧按钮设定本周的核心焦点。")}
        </p>
      </div>
      {!readonly && (
        <button
          aria-label="编辑焦点"
          className="opacity-0 transition-opacity group-hover:opacity-100"
          onClick={() => setEditing(true)}
          type="button"
          style={{ color: "var(--m-ink3)" }}
        >
          <Pencil size={14} />
        </button>
      )}
    </div>
  );
}

function TrapWarning({ trap, onDismiss }: { trap: string; onDismiss: () => void }) {
  if (!trap) return null;
  return (
    <div
      className="flex items-start gap-3 rounded-2xl px-4 py-3"
      style={{
        background: "rgba(212,164,42,0.08)",
        border: "1px solid rgba(212,164,42,0.25)",
      }}
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: "#A77A00" }} />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#A77A00" }}>
          本周陷阱提醒
        </p>
        <p className="mt-1 text-sm leading-6" style={{ color: "#7A5F00" }}>
          {trap}
        </p>
      </div>
      <button
        aria-label="关闭提醒"
        className="shrink-0 rounded-full p-1 transition-colors hover:bg-black/5"
        onClick={onDismiss}
        type="button"
        style={{ color: "#A77A00" }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function TaskRow({
  task,
  readonly,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: WeekTask;
  readonly: boolean;
  onToggle: () => void;
  onEdit: (text: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  useEffect(() => {
    setDraft(task.text);
  }, [task.text]);

  return (
    <div
      className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors"
      style={{
        background: task.done ? "rgba(74,155,111,0.05)" : "transparent",
      }}
    >
      <button
        aria-label={task.done ? "标记为未完成" : "标记为完成"}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-all"
        disabled={readonly}
        onClick={onToggle}
        type="button"
        style={{
          background: task.done ? "#4A9B6F" : "var(--m-base)",
          border: task.done ? "1px solid #4A9B6F" : "1px solid var(--m-rule)",
          boxShadow: task.done ? "none" : "var(--m-shadow-in)",
          opacity: readonly ? 0.6 : 1,
        }}
      >
        {task.done && <Check size={12} color="#fff" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        {editing && !readonly ? (
          <Input
            autoFocus
            className="h-7 text-sm"
            onBlur={() => {
              const t = draft.trim();
              if (t && t !== task.text) onEdit(t);
              setEditing(false);
            }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const t = draft.trim();
                if (t && t !== task.text) onEdit(t);
                setEditing(false);
              } else if (e.key === "Escape") {
                setDraft(task.text);
                setEditing(false);
              }
            }}
            value={draft}
          />
        ) : (
          <button
            className="w-full text-left text-sm leading-6 transition-colors"
            disabled={readonly}
            onClick={() => !readonly && setEditing(true)}
            type="button"
            style={{
              color: task.done ? "var(--m-ink3)" : "var(--m-ink)",
              textDecoration: task.done ? "line-through" : "none",
            }}
          >
            {task.text}
          </button>
        )}
      </div>

      {task.source === "ai" && !task.done && (
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
          style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
        >
          AI
        </span>
      )}

      {!readonly && (
        <button
          aria-label="删除任务"
          className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onDelete}
          type="button"
          style={{ color: "var(--m-ink3)" }}
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
}

function GoalTaskGroup({
  goal,
  tasks,
  readonly,
  generating,
  onGenerate,
  onAddTask,
  onToggleTask,
  onEditTask,
  onDeleteTask,
}: {
  goal: UserGoal | null; // null = standalone tasks
  tasks: WeekTask[];
  readonly: boolean;
  generating: boolean;
  onGenerate?: () => void;
  onAddTask: (text: string) => void;
  onToggleTask: (id: string) => void;
  onEditTask: (id: string, text: string) => void;
  onDeleteTask: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  const title = goal ? goal.title : "其他任务";

  const submitAdd = () => {
    const t = draft.trim();
    if (t) onAddTask(t);
    setDraft("");
    setAdding(false);
  };

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Target size={14} style={{ color: goal ? "var(--m-accent)" : "var(--m-ink3)" }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--m-ink)" }}>
              {title}
            </h3>
            {goal && (
              <span className="text-[11px]" style={{ color: "var(--m-ink3)" }}>
                {goal.currentValue} / {goal.targetValue}
              </span>
            )}
          </div>
          {total > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div
                className="h-1 flex-1 overflow-hidden rounded-full"
                style={{ background: "var(--m-rule)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    background: pct === 100 ? "#4A9B6F" : "var(--m-accent)",
                  }}
                />
              </div>
              <span className="text-[11px] font-medium tabular-nums" style={{ color: "var(--m-ink3)" }}>
                {done} / {total}
              </span>
            </div>
          )}
        </div>

        {goal && onGenerate && !readonly && (
          <button
            className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80 disabled:opacity-40"
            disabled={generating}
            onClick={onGenerate}
            type="button"
            style={{
              background: "rgba(139,94,60,0.08)",
              color: "var(--m-accent)",
              border: "1px solid rgba(139,94,60,0.2)",
            }}
          >
            {generating ? (
              <>
                <Loader2 className="animate-spin" size={11} />
                生成中
              </>
            ) : (
              <>
                <Sparkles size={11} />
                {tasks.some((t) => t.source === "ai") ? "重新生成" : "AI 生成"}
              </>
            )}
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="mt-3 space-y-0.5">
        {tasks.length === 0 ? (
          <p className="py-3 text-center text-xs" style={{ color: "var(--m-ink3)" }}>
            {readonly ? "本周在此目标下没有任务" : "还没有任务，点击下方添加或由 AI 生成"}
          </p>
        ) : (
          tasks.map((t) => (
            <TaskRow
              key={t.id}
              onDelete={() => onDeleteTask(t.id)}
              onEdit={(text) => onEditTask(t.id, text)}
              onToggle={() => onToggleTask(t.id)}
              readonly={readonly}
              task={t}
            />
          ))
        )}
      </div>

      {/* Add task row */}
      {!readonly && (
        <div className="mt-2">
          {adding ? (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--m-base)" }}>
              <Plus size={14} style={{ color: "var(--m-ink3)" }} />
              <Input
                autoFocus
                className="h-7 flex-1 text-sm"
                onBlur={submitAdd}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitAdd();
                  else if (e.key === "Escape") {
                    setDraft("");
                    setAdding(false);
                  }
                }}
                placeholder="添加一个任务..."
                value={draft}
              />
            </div>
          ) : (
            <button
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors hover:bg-black/5"
              onClick={() => setAdding(true)}
              type="button"
              style={{ color: "var(--m-ink3)" }}
            >
              <Plus size={13} />
              添加任务
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WeekPlanPage() {
  const [weekKey, setWeekKey] = useState<string>("");
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [mentorPlans, setMentorPlans] = useState<Record<string, MentorPlan>>({});
  const [generating, setGenerating] = useState<string | null>(null); // goalId or "all"
  const [error, setError] = useState("");

  // Initial load
  useEffect(() => {
    const wk = currentWeekKey();
    setWeekKey(wk);
    setGoals(loadGoals());
    setMentorPlans(loadMentorPlans());
  }, []);

  // Load plan whenever weekKey changes
  useEffect(() => {
    if (!weekKey) return;
    const thisWeek = currentWeekKey();
    if (weekKey === thisWeek) {
      setPlan(ensureWeekPlan(weekKey));
    } else {
      setPlan(loadWeekPlan(weekKey));
    }
    setError("");
  }, [weekKey]);

  const thisWeek = currentWeekKey();
  const readonly = weekKey !== thisWeek;

  const tasksByGoal = useMemo(() => {
    const map: Record<string, WeekTask[]> = {};
    if (!plan) return map;
    for (const g of goals) map[g.id] = [];
    map[""] = [];
    for (const t of plan.tasks) {
      (map[t.goalId] ??= []).push(t);
    }
    return map;
  }, [plan, goals]);

  const totalStats = useMemo(() => {
    if (!plan) return { done: 0, total: 0, pct: 0 };
    const total = plan.tasks.length;
    const done = plan.tasks.filter((t) => t.done).length;
    return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
  }, [plan]);

  // Mutations
  const updatePlan = (fn: (p: WeekPlan) => WeekPlan) => {
    if (!plan) return;
    const next = fn(plan);
    saveWeekPlan(next);
    setPlan(next);
  };

  const saveFocus = (v: string) => updatePlan((p) => ({ ...p, focus: v }));
  const dismissTrap = () => updatePlan((p) => ({ ...p, trapDismissed: true }));

  const addTask = (goalId: string, text: string) => {
    if (!plan) return;
    const task: WeekTask = {
      id: uid(),
      goalId,
      text,
      done: false,
      completedAt: null,
      createdAt: new Date().toISOString(),
      source: "user",
    };
    upsertWeekTask(plan.weekKey, task);
    setPlan({ ...plan, tasks: [...plan.tasks, task] });
  };

  const toggleTask = (id: string) => {
    if (!plan) return;
    const next = plan.tasks.map((t) =>
      t.id === id
        ? { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : null }
        : t,
    );
    const updated = { ...plan, tasks: next };
    saveWeekPlan(updated);
    setPlan(updated);
  };

  const editTask = (id: string, text: string) => {
    if (!plan) return;
    const next = plan.tasks.map((t) => (t.id === id ? { ...t, text } : t));
    const updated = { ...plan, tasks: next };
    saveWeekPlan(updated);
    setPlan(updated);
  };

  const deleteTask = (id: string) => {
    if (!plan) return;
    removeWeekTask(plan.weekKey, id);
    setPlan({ ...plan, tasks: plan.tasks.filter((t) => t.id !== id) });
  };

  // AI generation
  const generateForGoal = async (goalId: string) => {
    const goal = goals.find((g) => g.id === goalId);
    if (!goal || !plan) return;

    setGenerating(goalId);
    setError("");

    try {
      const res = await generateWeeklyForGoal(goal);
      if (!res.available) {
        setError(res.message ?? "AI 功能未配置。");
        return;
      }
      if (!res.data) {
        setError(res.message ?? "AI 返回为空，请重试。");
        return;
      }

      const actions = (res.data.actions ?? []).filter((s) => typeof s === "string" && s.trim());

      // Remove prior AI tasks for this goal, add fresh
      const remaining = plan.tasks.filter((t) => !(t.goalId === goalId && t.source === "ai"));
      const now = new Date().toISOString();
      const fresh: WeekTask[] = actions.map((text) => ({
        id: uid(),
        goalId,
        text: text.trim(),
        done: false,
        completedAt: null,
        createdAt: now,
        source: "ai",
      }));

      const focusNext = plan.focus || (res.data.focus ?? "").trim();
      const trapNext = plan.trap || (res.data.reminder ?? "").trim();

      const updated: WeekPlan = {
        ...plan,
        focus: focusNext,
        trap: trapNext,
        trapDismissed: trapNext !== plan.trap ? false : plan.trapDismissed,
        tasks: [...remaining, ...fresh],
        generatedAt: now,
      };
      saveWeekPlan(updated);
      setPlan(updated);
    } catch {
      setError("网络错误，请稍后重试。");
    } finally {
      setGenerating(null);
    }
  };

  const generateForAll = async () => {
    if (goals.length === 0) return;
    setGenerating("all");
    setError("");

    try {
      const results = await Promise.all(
        goals.map(async (g) => {
          try {
            const r = await generateWeeklyForGoal(g);
            return { goal: g, res: r };
          } catch {
            return { goal: g, res: null as MentorWeeklyResponse | null };
          }
        }),
      );

      if (!plan) return;
      let working: WeekPlan = { ...plan };
      let focusCandidate = working.focus;
      let trapCandidate = working.trap;
      const now = new Date().toISOString();

      for (const { goal, res } of results) {
        if (!res?.available || !res?.data) continue;
        const actions = (res.data.actions ?? []).filter((s) => typeof s === "string" && s.trim());
        const remaining = working.tasks.filter((t) => !(t.goalId === goal.id && t.source === "ai"));
        const fresh: WeekTask[] = actions.map((text) => ({
          id: uid(),
          goalId: goal.id,
          text: text.trim(),
          done: false,
          completedAt: null,
          createdAt: now,
          source: "ai",
        }));
        working = { ...working, tasks: [...remaining, ...fresh] };
        if (!focusCandidate && res.data.focus) focusCandidate = res.data.focus.trim();
        if (!trapCandidate && res.data.reminder) trapCandidate = res.data.reminder.trim();
      }

      const trapChanged = trapCandidate !== plan.trap;
      const updated: WeekPlan = {
        ...working,
        focus: focusCandidate,
        trap: trapCandidate,
        trapDismissed: trapChanged ? false : working.trapDismissed,
        generatedAt: now,
      };
      saveWeekPlan(updated);
      setPlan(updated);
    } finally {
      setGenerating(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!weekKey) {
    return (
      <PageTransition>
        <div className="py-20 text-center text-sm" style={{ color: "var(--m-ink3)" }}>
          加载中...
        </div>
      </PageTransition>
    );
  }

  const isEmpty = !plan || plan.tasks.length === 0;

  return (
    <PageTransition>
      <div className="w-full space-y-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              aria-label="返回"
              className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5"
              href="/life-path"
              style={{
                background: "var(--m-base-light)",
                border: "1px solid var(--m-rule)",
                boxShadow: "var(--m-shadow-out)",
                color: "var(--m-ink2)",
              }}
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <p
                className="text-[10px] font-medium uppercase tracking-[0.18em]"
                style={{ color: "var(--m-ink3)" }}
              >
                Week Plan
              </p>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight" style={{ color: "var(--m-ink)" }}>
                <CalendarRange size={18} style={{ color: "var(--m-accent)" }} />
                周计划
              </h1>
            </div>
          </div>
          <WeekSwitcher onChange={setWeekKey} weekKey={weekKey} />
        </div>

        {error && (
          <div
            className="rounded-xl px-4 py-2 text-xs"
            style={{ background: "rgba(220,38,38,0.05)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            {error}
          </div>
        )}

        {/* ── Readonly historical view with no plan ── */}
        {readonly && !plan && (
          <Panel className="p-10 text-center">
            <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
              {formatWeekLabel(weekKey)}未创建周计划
            </p>
          </Panel>
        )}

        {plan && (
          <>
            {/* ── Focus ── */}
            <FocusBlock onSave={saveFocus} readonly={readonly} value={plan.focus} />

            {/* ── Trap warning ── */}
            {!plan.trapDismissed && plan.trap && (
              <TrapWarning onDismiss={dismissTrap} trap={plan.trap} />
            )}

            {/* ── Overall progress (only when there are tasks) ── */}
            {totalStats.total > 0 && (
              <Panel className="flex items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: "var(--m-ink3)" }}
                  >
                    总体完成度
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <div
                      className="h-1.5 flex-1 overflow-hidden rounded-full"
                      style={{ background: "var(--m-rule)" }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${totalStats.pct}%`,
                          background: totalStats.pct === 100 ? "#4A9B6F" : "var(--m-accent)",
                        }}
                      />
                    </div>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: "var(--m-ink)" }}>
                      {totalStats.done} / {totalStats.total}
                    </span>
                  </div>
                </div>
                <div
                  className="text-2xl font-semibold tabular-nums"
                  style={{ color: totalStats.pct === 100 ? "#4A9B6F" : "var(--m-accent)" }}
                >
                  {totalStats.pct}%
                </div>
              </Panel>
            )}

            {/* ── Empty state / batch generate ── */}
            {isEmpty && !readonly && (
              <Panel className="space-y-4 p-8 text-center">
                <div
                  className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"
                  style={{
                    background: "var(--m-base)",
                    boxShadow: "var(--m-shadow-in)",
                    color: "var(--m-accent)",
                  }}
                >
                  <Sparkles size={20} />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
                    本周还没有计划
                  </h3>
                  <p className="text-sm" style={{ color: "var(--m-ink2)" }}>
                    {goals.length > 0
                      ? "让 AI 根据你当前目标的所处阶段，一次性生成本周行动清单。"
                      : "前往「人生主线」添加目标后，AI 才能为你生成计划。"}
                  </p>
                </div>
                {goals.length > 0 ? (
                  <Button
                    disabled={generating !== null}
                    onClick={() => void generateForAll()}
                    variant="primary"
                  >
                    {generating === "all" ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={14} />
                        正在生成周计划...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Sparkles size={14} />
                        为所有目标生成周计划
                      </span>
                    )}
                  </Button>
                ) : (
                  <Link
                    className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                    href="/life-path"
                    style={{ background: "var(--m-accent)", color: "#fff" }}
                  >
                    前往人生主线
                  </Link>
                )}
              </Panel>
            )}

            {/* ── Task groups ── */}
            {!isEmpty && (
              <div className="space-y-4">
                {goals.map((g) => {
                  const list = tasksByGoal[g.id] ?? [];
                  // Skip goals with zero tasks in readonly mode
                  if (readonly && list.length === 0) return null;
                  return (
                    <GoalTaskGroup
                      generating={generating === g.id}
                      goal={g}
                      key={g.id}
                      onAddTask={(text) => addTask(g.id, text)}
                      onDeleteTask={deleteTask}
                      onEditTask={editTask}
                      onGenerate={() => void generateForGoal(g.id)}
                      onToggleTask={toggleTask}
                      readonly={readonly}
                      tasks={list}
                    />
                  );
                })}

                {/* Standalone tasks */}
                {(tasksByGoal[""]?.length ?? 0) > 0 && (
                  <GoalTaskGroup
                    generating={false}
                    goal={null}
                    onAddTask={(text) => addTask("", text)}
                    onDeleteTask={deleteTask}
                    onEditTask={editTask}
                    onToggleTask={toggleTask}
                    readonly={readonly}
                    tasks={tasksByGoal[""] ?? []}
                  />
                )}

                {/* Bottom action: regenerate all */}
                {!readonly && goals.length > 0 && (
                  <div className="flex justify-center pt-2">
                    <Button
                      disabled={generating !== null}
                      onClick={() => void generateForAll()}
                      variant="ghost"
                    >
                      {generating === "all" ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="animate-spin" size={14} />
                          生成中...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles size={14} />
                          重新为所有目标生成
                        </span>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageTransition>
  );
}
