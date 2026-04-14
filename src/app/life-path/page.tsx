"use client";

import { Compass, Plus, Trash2, TrendingDown, TrendingUp, X, Zap } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { analyzeWithAI, shouldRunAI } from "@/lib/life-path-ai";
import { detectActionsByRules } from "@/lib/life-path-rules";
import { calculateAlignmentScoreWeighted, calculateGoalProgress, fuseActions } from "@/lib/life-path";
import { loadDirections, loadGoals, saveDirections, saveGoals } from "@/lib/life-path-storage";
import type { FusedAction, LifeDirection, UserGoal } from "@/types/life-path";

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = "today" | "directions" | "goals";

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 60 ? "#4A9B6F" : score >= 40 ? "#D4A42A" : "#C0392B";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg height={100} viewBox="0 0 100 100" width={100}>
        {/* Track */}
        <circle
          cx="50" cy="50" fill="none" r={r}
          stroke="var(--m-rule)" strokeWidth="9"
        />
        {/* Fill */}
        <circle
          cx="50" cy="50" fill="none" r={r}
          stroke={color}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          strokeWidth="9"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%", transition: "stroke-dasharray 0.5s ease" }}
        />
        <text
          dominantBaseline="middle"
          fill={color}
          fontFamily="inherit"
          fontSize="18"
          fontWeight="700"
          textAnchor="middle"
          x="50" y="50"
        >
          {score}
        </text>
      </svg>
      <span className="text-xs" style={{ color: "var(--m-ink3)" }}>对齐分</span>
    </div>
  );
}

// ── Action badge ──────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: FusedAction }) {
  const isPositive = action.category === "positive";
  const isRule = action.source === "rule";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        background: isPositive ? "rgba(74,155,111,0.1)" : "rgba(192,57,43,0.1)",
        color: isPositive ? "#4A9B6F" : "#C0392B",
        border: `1px solid ${isPositive ? "rgba(74,155,111,0.25)" : "rgba(192,57,43,0.25)"}`,
      }}
    >
      {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {action.type}
      {action.duration !== undefined && <span className="opacity-70">{action.duration}h</span>}
      <span
        className="ml-0.5 rounded px-1 text-[9px]"
        style={{
          background: isRule ? "rgba(139,94,60,0.12)" : "rgba(99,102,241,0.12)",
          color: isRule ? "#8B5E3C" : "#6366f1",
        }}
      >
        {isRule ? "规则" : `AI ${Math.round((action.confidence ?? 0) * 100)}%`}
      </span>
    </span>
  );
}

// ── Keyword pill list (editable) ──────────────────────────────────────────────

function KeywordPills({
  label,
  pills,
  onChange,
  color,
}: {
  label: string;
  pills: string[];
  onChange: (next: string[]) => void;
  color: "positive" | "negative";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  const add = () => {
    const kw = draft.trim();
    if (!kw || pills.includes(kw)) { setDraft(""); return; }
    onChange([...pills, kw]);
    setDraft("");
  };

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium" style={{ color: "var(--m-ink2)" }}>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {pills.map((p) => (
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs"
            key={p}
            style={{
              background: color === "positive" ? "rgba(74,155,111,0.1)" : "rgba(192,57,43,0.1)",
              color: color === "positive" ? "#4A9B6F" : "#C0392B",
            }}
          >
            {p}
            <button
              className="hover:opacity-70"
              onClick={() => onChange(pills.filter((x) => x !== p))}
              type="button"
            >
              <X size={10} />
            </button>
          </span>
        ))}
        <div className="flex items-center gap-1">
          <input
            className="h-6 rounded-full border px-2 text-xs outline-none"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="+ 添加"
            ref={inputRef}
            style={{ borderColor: "var(--m-rule)", background: "var(--m-base)", color: "var(--m-ink)", width: 72 }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button
            className="text-xs hover:opacity-70"
            onClick={add}
            style={{ color: "var(--m-ink3)" }}
            type="button"
          >确认</button>
        </div>
      </div>
    </div>
  );
}

// ── Goal progress bar ─────────────────────────────────────────────────────────

function GoalCard({ goal, onDelete }: { goal: UserGoal; onDelete: () => void }) {
  const progress = useMemo(() => calculateGoalProgress(goal), [goal]);

  return (
    <div
      className="relative rounded-xl p-4"
      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" style={{ color: "var(--m-ink)" }}>{goal.title}</p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--m-ink3)" }}>
            {goal.currentValue.toLocaleString()} / {goal.targetValue.toLocaleString()}
            {goal.deadline && (
              <span className="ml-2">
                {progress.daysLeft !== null && progress.daysLeft >= 0
                  ? `剩 ${progress.daysLeft} 天`
                  : "已逾期"}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold" style={{ color: progress.isCompleted ? "#4A9B6F" : "var(--m-accent)" }}>
            {progress.percentage}%
          </span>
          <button className="hover:opacity-60" onClick={onDelete} type="button">
            <Trash2 size={13} style={{ color: "var(--m-ink3)" }} />
          </button>
        </div>
      </div>
      {/* Progress track */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--m-rule)" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progress.percentage}%`,
            background: progress.isCompleted ? "#4A9B6F" : "var(--m-accent)",
          }}
        />
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LifePathPage() {
  const [tab, setTab] = useState<Tab>("today");

  // ── Today state ──────────────────────────────────────────────────────────────
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    positiveDelta: number;
    negativeDelta: number;
    contributions: FusedAction[];
  } | null>(null);

  // ── Directions state ─────────────────────────────────────────────────────────
  const [directions, setDirections] = useState<LifeDirection[]>([]);
  const [dirModal, setDirModal] = useState(false);
  const [draftDir, setDraftDir] = useState<Omit<LifeDirection, "id">>({
    name: "",
    positiveActions: [],
    negativeActions: [],
  });

  // ── Goals state ──────────────────────────────────────────────────────────────
  const [goals, setGoals] = useState<UserGoal[]>([]);
  const [goalModal, setGoalModal] = useState(false);
  const [draftGoal, setDraftGoal] = useState({ title: "", targetValue: "", currentValue: "", deadline: "" });

  // ── Hydrate from localStorage ────────────────────────────────────────────────
  useEffect(() => {
    setDirections(loadDirections());
    setGoals(loadGoals());
  }, []);

  // ── Handlers: Today ──────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setAnalyzing(true);
    setResult(null);
    try {
      const rules = detectActionsByRules(text);
      const aiActions = shouldRunAI(text, rules)
        ? await analyzeWithAI(text)
        : [];
      const fused = fuseActions(rules, aiActions);
      setResult(calculateAlignmentScoreWeighted(fused));
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Handlers: Directions ─────────────────────────────────────────────────────
  const openDirModal = () => {
    setDraftDir({ name: "", positiveActions: [], negativeActions: [] });
    setDirModal(true);
  };

  const submitDir = (e: FormEvent) => {
    e.preventDefault();
    if (!draftDir.name.trim()) return;
    const next: LifeDirection = {
      id: crypto.randomUUID(),
      name: draftDir.name.trim(),
      positiveActions: draftDir.positiveActions,
      negativeActions: draftDir.negativeActions,
    };
    const updated = [...directions, next];
    setDirections(updated);
    saveDirections(updated);
    setDirModal(false);
  };

  const deleteDir = (id: string) => {
    const updated = directions.filter((d) => d.id !== id);
    setDirections(updated);
    saveDirections(updated);
  };

  // ── Handlers: Goals ──────────────────────────────────────────────────────────
  const openGoalModal = () => {
    setDraftGoal({ title: "", targetValue: "", currentValue: "", deadline: "" });
    setGoalModal(true);
  };

  const submitGoal = (e: FormEvent) => {
    e.preventDefault();
    const target = Number(draftGoal.targetValue);
    const current = Number(draftGoal.currentValue);
    if (!draftGoal.title.trim() || !target) return;
    const next: UserGoal = {
      id: crypto.randomUUID(),
      title: draftGoal.title.trim(),
      targetValue: target,
      currentValue: current || 0,
      ...(draftGoal.deadline ? { deadline: draftGoal.deadline } : {}),
    };
    const updated = [...goals, next];
    setGoals(updated);
    saveGoals(updated);
    setGoalModal(false);
  };

  const deleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    saveGoals(updated);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabs: { key: Tab; label: string }[] = [
    { key: "today",      label: "今日分析" },
    { key: "directions", label: "人生方向" },
    { key: "goals",      label: "目标进度" },
  ];

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="设定人生方向与量化目标，用每日记录持续对齐。"
        eyebrow="LIFE PATH"
        icon={Compass}
        title="人生主线"
      />

      {/* Tab bar */}
      <div
        className="flex gap-0.5 rounded-xl p-1"
        style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
      >
        {tabs.map((t) => (
          <button
            className="flex-1 rounded-lg py-2 text-sm font-medium transition-all"
            key={t.key}
            onClick={() => setTab(t.key)}
            style={
              tab === t.key
                ? { background: "white", color: "var(--m-accent)", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }
                : { color: "var(--m-ink3)" }
            }
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Today tab ── */}
      {tab === "today" && (
        <div className="space-y-4">
          <Panel className="space-y-4 p-5">
            <p className="text-sm font-medium" style={{ color: "var(--m-ink)" }}>今天的记录</p>
            <Textarea
              onChange={(e) => { setText(e.target.value); setResult(null); }}
              placeholder="写下今天做了什么……例如：今天学习2小时，刷视频半小时，晚上有点摆烂。"
              rows={5}
              value={text}
            />
            <Button
              disabled={!text.trim() || analyzing}
              onClick={() => void handleAnalyze()}
              variant="primary"
            >
              <Zap className="mr-2" size={14} />
              {analyzing ? "分析中..." : "对齐分析"}
            </Button>
          </Panel>

          {result && (
            <Panel className="p-5">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                <ScoreRing score={result.score} />

                <div className="flex-1 space-y-4">
                  {/* Deltas */}
                  <div className="flex gap-4 text-sm">
                    <span style={{ color: "#4A9B6F" }}>
                      <TrendingUp className="mr-1 inline" size={13} />
                      +{result.positiveDelta.toFixed(1)}
                    </span>
                    <span style={{ color: "#C0392B" }}>
                      <TrendingDown className="mr-1 inline" size={13} />
                      −{result.negativeDelta.toFixed(1)}
                    </span>
                    <span className="text-xs" style={{ color: "var(--m-ink3)" }}>（基准 50）</span>
                  </div>

                  {/* Action badges */}
                  {result.contributions.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {result.contributions.map((a) => (
                        <ActionBadge action={a} key={a.type} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
                      未检测到已知行为关键词，请尝试在「人生方向」中添加更多关键词。
                    </p>
                  )}
                </div>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ── Directions tab ── */}
      {tab === "directions" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={openDirModal} variant="primary">
              <Plus className="mr-2" size={14} />
              新增方向
            </Button>
          </div>

          {directions.length === 0 ? (
            <Panel className="py-12 text-center">
              <Compass className="mx-auto mb-3" size={28} style={{ color: "var(--m-ink3)" }} />
              <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
                还没有人生方向。例如：财富、健康、成长、人际。
              </p>
            </Panel>
          ) : (
            <div className="space-y-3">
              {directions.map((dir) => (
                <Panel className="p-4" key={dir.id}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: "var(--m-ink)" }}>{dir.name}</p>
                    <button className="hover:opacity-60" onClick={() => deleteDir(dir.id)} type="button">
                      <Trash2 size={13} style={{ color: "var(--m-ink3)" }} />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {dir.positiveActions.map((k) => (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        key={k}
                        style={{ background: "rgba(74,155,111,0.1)", color: "#4A9B6F" }}
                      >
                        {k}
                      </span>
                    ))}
                    {dir.negativeActions.map((k) => (
                      <span
                        className="rounded-full px-2 py-0.5 text-xs"
                        key={k}
                        style={{ background: "rgba(192,57,43,0.1)", color: "#C0392B" }}
                      >
                        {k}
                      </span>
                    ))}
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Goals tab ── */}
      {tab === "goals" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button onClick={openGoalModal} variant="primary">
              <Plus className="mr-2" size={14} />
              新增目标
            </Button>
          </div>

          {goals.length === 0 ? (
            <Panel className="py-12 text-center">
              <Compass className="mx-auto mb-3" size={28} style={{ color: "var(--m-ink3)" }} />
              <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
                还没有量化目标。例如：存款 100 万、阅读 50 本书。
              </p>
            </Panel>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => (
                <GoalCard goal={g} key={g.id} onDelete={() => deleteGoal(g.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Direction Dialog ── */}
      <Dialog onClose={() => setDirModal(false)} open={dirModal} title="新增人生方向">
        <form className="space-y-4" onSubmit={submitDir}>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            方向名称 *
            <Input
              autoFocus
              onChange={(e) => setDraftDir((d) => ({ ...d, name: e.target.value }))}
              placeholder="例：健康  /  财富  /  成长"
              required
              value={draftDir.name}
            />
          </label>

          <KeywordPills
            color="positive"
            label="正向关键词（做了这些 +分）"
            onChange={(kws) => setDraftDir((d) => ({ ...d, positiveActions: kws }))}
            pills={draftDir.positiveActions}
          />

          <KeywordPills
            color="negative"
            label="负向关键词（做了这些 −分）"
            onChange={(kws) => setDraftDir((d) => ({ ...d, negativeActions: kws }))}
            pills={draftDir.negativeActions}
          />

          <div className="flex justify-end gap-3 pt-1">
            <Button onClick={() => setDirModal(false)} type="button" variant="ghost">取消</Button>
            <Button disabled={!draftDir.name.trim()} type="submit" variant="primary">确认添加</Button>
          </div>
        </form>
      </Dialog>

      {/* ── Add Goal Dialog ── */}
      <Dialog onClose={() => setGoalModal(false)} open={goalModal} title="新增量化目标">
        <form className="space-y-4" onSubmit={submitGoal}>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            目标名称 *
            <Input
              autoFocus
              onChange={(e) => setDraftGoal((d) => ({ ...d, title: e.target.value }))}
              placeholder="例：存款达到 100 万"
              required
              value={draftGoal.title}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              目标值 *
              <Input
                min="1"
                onChange={(e) => setDraftGoal((d) => ({ ...d, targetValue: e.target.value }))}
                placeholder="1000000"
                required
                type="number"
                value={draftGoal.targetValue}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
              当前进度
              <Input
                min="0"
                onChange={(e) => setDraftGoal((d) => ({ ...d, currentValue: e.target.value }))}
                placeholder="0"
                type="number"
                value={draftGoal.currentValue}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
            截止日期（选填）
            <Input
              onChange={(e) => setDraftGoal((d) => ({ ...d, deadline: e.target.value }))}
              type="date"
              value={draftGoal.deadline}
            />
          </label>
          <div className="flex justify-end gap-3 pt-1">
            <Button onClick={() => setGoalModal(false)} type="button" variant="ghost">取消</Button>
            <Button disabled={!draftGoal.title.trim() || !draftGoal.targetValue} type="submit" variant="primary">确认添加</Button>
          </div>
        </form>
      </Dialog>
    </PageTransition>
  );
}
