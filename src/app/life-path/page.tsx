"use client";

import { Compass, Pencil, Plus, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { calculateGoalProgress } from "@/lib/life-path";
import { loadGoals, saveGoals } from "@/lib/life-path-storage";
import type { UserGoal } from "@/types/life-path";

// ── Goal card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: UserGoal;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const progress = useMemo(() => calculateGoalProgress(goal), [goal]);
  const color = progress.isCompleted ? "#4A9B6F" : "var(--m-accent)";

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug" style={{ color: "var(--m-ink)" }}>
            {goal.title}
          </p>
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

        <div className="flex items-center gap-1.5">
          <button
            className="rounded-lg p-1 hover:opacity-60 transition-opacity"
            onClick={onEdit}
            title="更新进度"
            type="button"
          >
            <Pencil size={13} style={{ color: "var(--m-ink3)" }} />
          </button>
          <button
            className="rounded-lg p-1 hover:opacity-60 transition-opacity"
            onClick={onDelete}
            title="删除目标"
            type="button"
          >
            <Trash2 size={13} style={{ color: "var(--m-ink3)" }} />
          </button>
        </div>
      </div>

      {/* Progress numbers */}
      <div className="mt-3 flex items-end justify-between">
        <div>
          <span className="text-2xl font-bold" style={{ color }}>
            {progress.percentage}%
          </span>
          <span className="ml-2 text-xs" style={{ color: "var(--m-ink3)" }}>
            {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
          </span>
        </div>
        {progress.isCompleted && (
          <span className="text-xs font-medium" style={{ color: "#4A9B6F" }}>已完成 ✓</span>
        )}
        {!progress.isCompleted && progress.remaining > 0 && (
          <span className="text-xs" style={{ color: "var(--m-ink3)" }}>
            还差 {progress.remaining.toLocaleString()}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-2 overflow-hidden rounded-full" style={{ background: "var(--m-rule)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${progress.percentage}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LifePathPage() {
  const [goals, setGoals] = useState<UserGoal[]>([]);

  // ── Add goal dialog ──────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftTarget, setDraftTarget] = useState("");
  const [draftCurrent, setDraftCurrent] = useState("");
  const [draftDeadline, setDraftDeadline] = useState("");

  // ── Update progress dialog ───────────────────────────────────────────────────
  const [editGoal, setEditGoal] = useState<UserGoal | null>(null);
  const [editCurrent, setEditCurrent] = useState("");

  // Hydrate from localStorage
  useEffect(() => { setGoals(loadGoals()); }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const persist = (next: UserGoal[]) => { setGoals(next); saveGoals(next); };

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

  const openEdit = (goal: UserGoal) => {
    setEditGoal(goal);
    setEditCurrent(String(goal.currentValue));
  };

  const submitEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editGoal) return;
    const newValue = Math.max(0, Number(editCurrent) || 0);
    persist(goals.map((g) => g.id === editGoal.id ? { ...g, currentValue: newValue } : g));
    setEditGoal(null);
  };

  const deleteGoal = (id: string) => {
    if (!window.confirm("确认删除该目标？")) return;
    persist(goals.filter((g) => g.id !== id));
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="设定量化目标，每天更新进度，用数字见证自己的成长轨迹。"
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
            {goals.filter((g) => calculateGoalProgress(g).isCompleted).length} / {goals.length} 已完成
          </span>
        )}
      </div>

      {/* Goal list */}
      {goals.length === 0 ? (
        <Panel className="py-16 text-center">
          <Compass className="mx-auto mb-3" size={30} style={{ color: "var(--m-ink3)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--m-ink2)" }}>还没有人生目标</p>
          <p className="mt-1 text-xs" style={{ color: "var(--m-ink3)" }}>
            例如：存款 100 万 · 读完 50 本书 · 跑完一个马拉松
          </p>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {goals.map((g) => (
            <GoalCard
              goal={g}
              key={g.id}
              onDelete={() => deleteGoal(g.id)}
              onEdit={() => openEdit(g)}
            />
          ))}
        </div>
      )}

      {/* ── Add Goal Dialog ── */}
      <Dialog onClose={() => setAddOpen(false)} open={addOpen} title="新增人生目标">
        <form className="space-y-4" onSubmit={submitAdd}>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            目标名称 *
            <Input
              autoFocus
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder="例：存款达到 100 万"
              required
              value={draftTitle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              目标值 *
              <Input
                min="1"
                onChange={(e) => setDraftTarget(e.target.value)}
                placeholder="1000000"
                required
                type="number"
                value={draftTarget}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              当前进度
              <Input
                min="0"
                onChange={(e) => setDraftCurrent(e.target.value)}
                placeholder="0"
                type="number"
                value={draftCurrent}
              />
            </label>
          </div>

          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            截止日期（选填）
            <Input
              onChange={(e) => setDraftDeadline(e.target.value)}
              type="date"
              value={draftDeadline}
            />
          </label>

          <div className="flex justify-end gap-3 pt-1">
            <Button onClick={() => setAddOpen(false)} type="button" variant="ghost">取消</Button>
            <Button disabled={!draftTitle.trim() || !draftTarget} type="submit" variant="primary">
              确认添加
            </Button>
          </div>
        </form>
      </Dialog>

      {/* ── Update Progress Dialog ── */}
      <Dialog
        onClose={() => setEditGoal(null)}
        open={editGoal !== null}
        title={editGoal ? `更新进度 — ${editGoal.title}` : "更新进度"}
      >
        {editGoal && (
          <form className="space-y-4" onSubmit={submitEdit}>
            <div className="rounded-xl p-3 text-sm" style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}>
              <span style={{ color: "var(--m-ink3)" }}>目标值：</span>
              <span className="font-semibold" style={{ color: "var(--m-ink)" }}>
                {editGoal.targetValue.toLocaleString()}
              </span>
            </div>
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              当前进度（绝对值）
              <Input
                autoFocus
                min="0"
                onChange={(e) => setEditCurrent(e.target.value)}
                placeholder={String(editGoal.currentValue)}
                type="number"
                value={editCurrent}
              />
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
