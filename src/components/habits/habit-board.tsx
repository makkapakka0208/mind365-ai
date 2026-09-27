"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { ConfirmButton } from "@/components/ui/confirm-button";
import { getTodayISODate, parseISODate } from "@/lib/date";
import {
  archiveHabit,
  canEditDate,
  currentWeekDates,
  dayState,
  describeFactor,
  indexLogs,
  keepCount,
  logKey,
  saveHabit,
  setHabitLog,
  shouldNudge,
  suggestGoalFactor,
  useGoals,
  useHabitLogs,
  useHabits,
  weekProgress,
  type DayState,
} from "@/lib/habits";
import type { Habit, HabitUnit } from "@/types/life-path";

/**
 * 人生主线 · 习惯打卡：每个习惯一行——名称与规则 / 本周七天 / 本周进度与坚持天数。
 * 点最近 7 天内的任一天即可打卡、改量、设为休息日或清除。
 */

const SERIF = "var(--v5-serif)";
const UNITS: HabitUnit[] = ["分钟", "小时", "页", "次"];
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function DayDot({ state, backfilled }: { state: DayState; backfilled: boolean }) {
  const size = 26;
  const base: React.CSSProperties = { width: size, height: size, borderRadius: 999, display: "grid", placeItems: "center" };
  if (state === "done" && backfilled) {
    // 补记：空心 + 小点，和当天打卡区分开
    return (
      <span style={{ ...base, border: "2px solid var(--v5-accent)" }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--v5-accent)" }} />
      </span>
    );
  }
  if (state === "done") return <span style={{ ...base, background: "var(--v5-accent)" }} />;
  if (state === "partial")
    return <span style={{ ...base, border: "1px solid var(--v5-accent)", background: "linear-gradient(90deg, rgba(var(--v5-accent-rgb),0.55) 50%, transparent 50%)" }} />;
  if (state === "rest")
    return <span style={{ ...base, border: "1px dashed var(--v5-rule-strong)", fontFamily: SERIF, fontSize: 11.5, color: "var(--v5-ink3)" }}>休</span>;
  if (state === "pending") return <span style={{ ...base, border: "1.5px dashed var(--v5-accent)" }} />;
  if (state === "missed") return <span style={{ ...base, border: "1px solid var(--v5-rule-strong)" }} />;
  return <span style={{ ...base, border: "1px solid var(--v5-rule)", opacity: 0.45 }} />;
}

type FormState = {
  id?: string;
  name: string;
  unit: HabitUnit;
  dailyTarget: string;
  weeklyDays: number;
  goalId: string;
  trackAs: "" | "reading" | "study";
};

const emptyForm: FormState = { name: "", unit: "分钟", dailyTarget: "30", weeklyDays: 5, goalId: "", trackAs: "" };

function HabitForm({ initial, onDone }: { initial: FormState; onDone: () => void }) {
  const [form, setForm] = useState(initial);
  const goals = useGoals();
  const goal = goals.find((g) => g.id === form.goalId);
  const factor = suggestGoalFactor(form.unit, goal);
  const timeUnit = form.unit === "分钟" || form.unit === "小时";

  const field: React.CSSProperties = { fontFamily: SERIF, color: "var(--v5-ink)", borderBottom: "1px solid var(--v5-rule)", background: "transparent" };
  const select: React.CSSProperties = { fontFamily: SERIF, color: "var(--v5-ink)", background: "var(--m-base)", border: "1px solid var(--v5-rule)", borderRadius: 999, padding: "5px 12px" };

  return (
    <form
      className="grid gap-4 rounded-[20px] px-6 py-5"
      style={{ background: "var(--m-base)", border: "1px solid var(--v5-rule)" }}
      onSubmit={(e) => {
        e.preventDefault();
        const target = Number(form.dailyTarget);
        if (!form.name.trim() || !(target > 0)) return;
        saveHabit({
          id: form.id,
          name: form.name.trim(),
          unit: form.unit,
          dailyTarget: target,
          weeklyDays: form.weeklyDays,
          goalId: form.goalId || undefined,
          goalFactor: form.goalId ? factor : undefined,
          trackAs: timeUnit && form.trackAs ? form.trackAs : undefined,
        });
        onDone();
      }}
    >
      <div className="flex flex-wrap items-end gap-4" style={{ fontSize: 15 }}>
        <input
          autoFocus
          required
          value={form.name}
          onChange={(e) => {
            const name = e.target.value;
            // 名字里有「读 / 学」时，顺手推荐计入阅读 / 学习时长
            const trackAs = form.trackAs || (/读/.test(name) ? "reading" : /学/.test(name) ? "study" : "");
            setForm({ ...form, name, trackAs });
          }}
          placeholder="习惯名称，比如：阅读"
          className="min-w-[180px] flex-1 py-1.5 text-[17px] outline-none placeholder:text-[var(--v5-ink-mute)]"
          style={field}
        />
        <label className="flex items-center gap-2" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
          每天
          <input
            required
            type="number"
            min={0.1}
            step="any"
            value={form.dailyTarget}
            onChange={(e) => setForm({ ...form, dailyTarget: e.target.value })}
            className="w-16 py-1 text-center outline-none"
            style={field}
          />
          <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value as HabitUnit })} style={select}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
          每周
          <select value={form.weeklyDays} onChange={(e) => setForm({ ...form, weeklyDays: Number(e.target.value) })} style={select}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n} 天</option>)}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4" style={{ fontFamily: SERIF, fontSize: 14.5, color: "var(--v5-ink3)" }}>
        <label className="flex items-center gap-2">
          计入目标
          <select value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })} style={select}>
            <option value="">不关联</option>
            {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>
        {goal && <span style={{ fontStyle: "italic" }}>{describeFactor(form.unit, factor)}</span>}
        {timeUnit && (
          <label className="flex items-center gap-2">
            计入时长
            <select value={form.trackAs} onChange={(e) => setForm({ ...form, trackAs: e.target.value as FormState["trackAs"] })} style={select}>
              <option value="">不计入</option>
              <option value="reading">阅读时长</option>
              <option value="study">学习时长</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-3" style={{ fontFamily: SERIF }}>
        <button type="submit" className="rounded-full px-5 py-2 text-sm" style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)" }}>
          保存
        </button>
        <button type="button" onClick={onDone} className="text-sm" style={{ color: "var(--v5-ink3)" }}>
          取消
        </button>
        {form.id && (
          <ConfirmButton
            className="ml-auto text-sm"
            style={{ color: "var(--v5-ink3)" }}
            confirmLabel="确认归档？打卡历史会保留"
            onConfirm={() => {
              archiveHabit(form.id as string);
              onDone();
            }}
          >
            归档这个习惯
          </ConfirmButton>
        )}
      </div>
    </form>
  );
}

function DayEditor({ habit, date, onClose, onLogged }: { habit: Habit; date: string; onClose: () => void; onLogged?: () => void }) {
  const logs = useHabitLogs();
  const log = logs.find((l) => l.habitId === habit.id && l.date === date);
  const [amount, setAmount] = useState(String(log && !log.rest && log.amount > 0 ? log.amount : habit.dailyTarget));
  const [saving, setSaving] = useState(false);
  const today = getTodayISODate();
  const d = parseISODate(date);

  const run = async (value: number | "rest" | null) => {
    setSaving(true);
    try {
      await setHabitLog(habit, date, value);
      onLogged?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      className="col-span-full flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-3"
      style={{ background: "var(--m-base)", border: "1px solid var(--v5-rule)", fontFamily: SERIF, fontSize: 14.5 }}
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(amount);
        if (n >= 0) void run(n);
      }}
    >
      <span style={{ color: "var(--v5-ink)" }}>
        {d.getMonth() + 1} 月 {d.getDate()} 日{date === today ? "（今天）" : "（补记）"}
      </span>
      <input
        autoFocus
        type="number"
        min={0}
        step="any"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-20 bg-transparent py-1 text-center outline-none"
        style={{ color: "var(--v5-ink)", borderBottom: "1px solid var(--v5-rule-strong)" }}
      />
      <span style={{ color: "var(--v5-ink3)" }}>{habit.unit}</span>
      <button disabled={saving} type="submit" className="rounded-full px-4 py-1.5 text-sm" style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)" }}>
        {log && !log.rest && log.amount > 0 ? "更新" : "打卡"}
      </button>
      <button disabled={saving} type="button" onClick={() => void run("rest")} className="text-sm" style={{ color: "var(--v5-ink3)" }}>
        设为休息日
      </button>
      {log && (
        <button disabled={saving} type="button" onClick={() => void run(null)} className="text-sm" style={{ color: "var(--v5-ink3)" }}>
          清除
        </button>
      )}
      <button type="button" onClick={onClose} className="ml-auto text-sm" style={{ color: "var(--v5-ink3)" }}>
        收起
      </button>
    </form>
  );
}

/** onLogged：打卡改动了关联目标的进度，页面据此刷新目标列表 */
export function HabitBoard({ onLogged }: { onLogged?: () => void } = {}) {
  const habits = useHabits();
  const logs = useHabitLogs();
  const [form, setForm] = useState<FormState | null>(null);
  const [editing, setEditing] = useState<{ habitId: string; date: string } | null>(null);

  const active = habits.filter((h) => !h.archivedAt);
  const index = useMemo(() => indexLogs(logs), [logs]);
  const today = getTodayISODate();
  const week = currentWeekDates(today);
  const goals = useGoals();

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="v5-eyebrow">HABITS · 习惯打卡</div>
        <button
          type="button"
          onClick={() => setForm(emptyForm)}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-opacity hover:opacity-90"
          style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)", fontFamily: SERIF }}
        >
          <Plus size={14} /> 新建习惯
        </button>
      </div>

      {form && (
        <div className="mb-5">
          <HabitForm initial={form} onDone={() => setForm(null)} />
        </div>
      )}

      {active.length === 0 && !form ? (
        <p style={{ fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink3)" }}>
          还没有习惯。比如「阅读 · 每天 30 分钟 · 每周 5 天」，还可以关联「阅读 300 小时」，打卡时长会自动计入。
        </p>
      ) : (
        <div className="overflow-hidden" style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 24, boxShadow: "var(--v5-sh-2)" }}>
          {active.map((habit, i) => {
            const progress = weekProgress(habit, index, today);
            const keep = keepCount(habit, index, today);
            const nudge = shouldNudge(habit, index, today);
            const goal = goals.find((g) => g.id === habit.goalId);
            return (
              <div
                key={habit.id}
                className="grid items-center gap-x-6 gap-y-3 px-6 py-5 lg:grid-cols-[minmax(160px,220px)_auto_minmax(150px,1fr)]"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--v5-rule)" }}
              >
                {/* 名称与规则 */}
                <button
                  type="button"
                  title="编辑"
                  className="min-w-0 text-left"
                  onClick={() =>
                    setForm({
                      id: habit.id,
                      name: habit.name,
                      unit: habit.unit,
                      dailyTarget: String(habit.dailyTarget),
                      weeklyDays: habit.weeklyDays,
                      goalId: habit.goalId ?? "",
                      trackAs: habit.trackAs ?? "",
                    })
                  }
                >
                  <span className="block truncate" style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 600, color: "var(--v5-ink)" }}>{habit.name}</span>
                  <span className="mt-0.5 block" style={{ fontFamily: SERIF, fontSize: 13, color: "var(--v5-ink3)" }}>
                    每天 {habit.dailyTarget} {habit.unit} · 每周 {habit.weeklyDays} 天
                    {goal ? ` · 计入「${goal.title}」` : ""}
                  </span>
                </button>

                {/* 本周七天 */}
                <div className="flex gap-2">
                  {week.map((date, di) => {
                    const state = dayState(habit, date, index, today);
                    const log = index.get(logKey(habit.id, date));
                    const editable = canEditDate(date, today) && state !== "before";
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={!editable}
                        onClick={() => setEditing(editing?.habitId === habit.id && editing.date === date ? null : { habitId: habit.id, date })}
                        title={`${parseISODate(date).getMonth() + 1} 月 ${parseISODate(date).getDate()} 日${log && !log.rest ? ` · ${log.amount} ${habit.unit}` : ""}${log?.backfilled ? " · 补记" : ""}`}
                        className="flex flex-col items-center gap-1 disabled:cursor-default"
                      >
                        <span style={{ fontFamily: SERIF, fontSize: 11.5, color: date === today ? "var(--v5-accent)" : "var(--v5-ink-mute)" }}>{WEEKDAYS[di]}</span>
                        <DayDot state={state} backfilled={!!log?.backfilled} />
                      </button>
                    );
                  })}
                </div>

                {/* 本周进度 */}
                <div className="lg:text-right" style={{ fontFamily: SERIF }}>
                  <div style={{ fontSize: 15, color: "var(--v5-ink)" }}>
                    本周 <span style={{ fontSize: 20, color: "var(--v5-accent)" }}>{progress.done}</span> / {progress.required} 天
                    <span style={{ fontSize: 13, color: "var(--v5-ink3)" }}>
                      {progress.met ? " · 已达成" : progress.daysLeft >= progress.required - progress.done ? ` · 还剩 ${progress.daysLeft} 天` : ` · 还剩 ${progress.daysLeft} 天，这周差一点`}
                    </span>
                  </div>
                  <div className="mt-0.5" style={{ fontSize: 13, color: "var(--v5-ink3)" }}>
                    已坚持 {keep} 天{nudge ? " · 昨天没打卡，别连续错过两天" : ""}
                  </div>
                </div>

                {editing?.habitId === habit.id && (
                  <DayEditor key={editing.date} date={editing.date} habit={habit} onClose={() => setEditing(null)} onLogged={onLogged} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
