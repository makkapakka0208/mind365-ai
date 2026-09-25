"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { getTodayISODate } from "@/lib/date";
import {
  addTodo,
  clearCompletedTodos,
  deleteTodo,
  setTodoDueDate,
  toggleTodo,
  updateTodoText,
} from "@/lib/storage";
import { useTodosStore } from "@/lib/storage-store";
import type { TodoItem, TodoQuadrant } from "@/types";

const SERIF = "var(--v5-serif)";

// ── Quadrant metadata (Eisenhower matrix) ──
// 不再用红橙绿蓝四色：统一走主题强调色，按重要度递减（Ⅰ 最强 → Ⅳ 最淡），
// 用罗马数字 + 行动词区分象限。
interface QuadrantMeta {
  id: TodoQuadrant;
  numeral: string;
  action: string;
  label: string;
  empty: string;
  tone: string;
}

const QUADRANTS: QuadrantMeta[] = [
  { id: "q1", numeral: "I", action: "立即做", label: "重要且紧急", empty: "没有火烧眉毛的事", tone: "var(--v5-accent)" },
  { id: "q2", numeral: "II", action: "计划做", label: "重要不紧急", empty: "为长期的事留一点时间", tone: "rgba(var(--v5-accent-rgb),0.72)" },
  { id: "q3", numeral: "III", action: "速办或委派", label: "不重要但紧急", empty: "能快速了结的放这里", tone: "var(--v5-ink3)" },
  { id: "q4", numeral: "IV", action: "放一放", label: "不重要不紧急", empty: "可以放下的事", tone: "var(--v5-ink-mute)" },
];

const HAIRLINE = "1px solid rgba(var(--v5-ink-rgb),0.07)";

function quadFromFlags(important: boolean, urgent: boolean): TodoQuadrant {
  if (important && urgent) return "q1";
  if (important && !urgent) return "q2";
  if (!important && urgent) return "q3";
  return "q4";
}

// ── Due-date formatting ────────────────────────────────────────
type DueTone = "overdue" | "today" | "tomorrow" | "future";

function describeDue(due: string, done: boolean): { label: string; tone: DueTone } {
  const today = getTodayISODate();
  const t = new Date(`${today}T00:00:00`);
  const d = new Date(`${due}T00:00:00`);
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);
  let tone: DueTone = "future";
  if (!done && diffDays < 0) tone = "overdue";
  else if (diffDays === 0) tone = "today";
  else if (diffDays === 1) tone = "tomorrow";
  let label: string;
  if (diffDays === 0) label = "今天";
  else if (diffDays === 1) label = "明天";
  else if (diffDays === -1) label = "昨天";
  else {
    const [, mm, dd] = due.split("-");
    label = `${Number(mm)}月${Number(dd)}日`;
    if (!done && diffDays < 0) label += ` · 逾期${-diffDays}天`;
  }
  return { label, tone };
}

const TONE_COLORS: Record<DueTone, { fg: string; bg: string }> = {
  overdue: { fg: "var(--m-danger)", bg: "color-mix(in srgb, var(--m-danger) 12%, transparent)" },
  today: { fg: "var(--v5-accent)", bg: "rgba(var(--v5-accent-rgb),0.12)" },
  tomorrow: { fg: "var(--v5-ink2)", bg: "rgba(var(--v5-ink-rgb),0.07)" },
  future: { fg: "var(--v5-ink3)", bg: "rgba(var(--v5-ink-rgb),0.05)" },
};

function DueChip({ todo }: { todo: TodoItem }) {
  const info = todo.dueDate ? describeDue(todo.dueDate, todo.done) : null;
  const colors = info ? TONE_COLORS[info.tone] : null;
  const overlayInput = (
    <input
      type="date"
      value={todo.dueDate ?? ""}
      aria-label="设置截止日期"
      onChange={(e) => setTodoDueDate(todo.id, e.target.value || undefined)}
      onClick={(e) => {
        const el = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
        if (typeof el.showPicker === "function") {
          try { el.showPicker(); } catch { /* native fallback */ }
        }
      }}
      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
    />
  );
  if (info && colors) {
    return (
      <span className="relative inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ color: colors.fg, background: colors.bg }}>
        <CalendarDays size={11} />
        {info.label}
        {overlayInput}
      </span>
    );
  }
  return (
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-50 transition-all sm:opacity-0 sm:group-hover:opacity-50" style={{ color: "var(--v5-ink3)" }}>
      <CalendarDays size={13} />
      {overlayInput}
    </span>
  );
}

// ── Single todo row (lives inside a quadrant cell, hairline-separated) ──
function TodoRow({ todo, color }: { todo: TodoItem; color: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

  const commitEdit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== todo.text) updateTodoText(todo.id, draft);
    else setDraft(todo.text);
  };

  return (
    <div className="group flex items-center gap-2.5 py-2">
      <button
        type="button"
        aria-label={todo.done ? "标记为未完成" : "标记为完成"}
        onClick={() => toggleTodo(todo.id)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all"
        style={{
          border: `1.2px solid ${todo.done ? color : "rgba(var(--v5-ink-rgb),0.28)"}`,
          background: todo.done ? color : "transparent",
        }}
      >
        {todo.done && <Check size={11} color="var(--v5-surface)" strokeWidth={3} />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
            if (e.key === "Escape") { setDraft(todo.text); setEditing(false); }
          }}
          className="flex-1 bg-transparent text-[15px] outline-none"
          style={{ color: "var(--v5-ink)", fontFamily: SERIF }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(todo.text); setEditing(true); }}
          className="flex-1 truncate text-left text-[15px] leading-6"
          style={{
            color: todo.done ? "var(--v5-ink3)" : "var(--v5-ink)",
            textDecoration: todo.done ? "line-through" : "none",
            fontFamily: SERIF,
          }}
        >
          {todo.text}
        </button>
      )}

      <DueChip todo={todo} />

      <button
        type="button"
        aria-label="删除"
        onClick={() => deleteTodo(todo.id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-60 transition-all hover:bg-[rgba(var(--v5-ink-rgb),0.06)] sm:opacity-0 sm:group-hover:opacity-60"
        style={{ color: "var(--v5-ink3)" }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Quadrant cell（矩阵中的一格，靠发丝线分隔，不再是独立卡片）──
function QuadCell({ meta, items, style }: { meta: QuadrantMeta; items: TodoItem[]; style?: React.CSSProperties }) {
  return (
    <div
      className="flex min-h-[168px] flex-col px-5 pb-3 pt-4"
      style={{ background: meta.id === "q1" ? "rgba(var(--v5-accent-rgb),0.05)" : "transparent", ...style }}
    >
      {/* header：罗马数字 + 行动词 / 象限条件 + 计数 */}
      <div className="flex items-start gap-3">
        <span style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 500, lineHeight: 1, minWidth: 34, color: meta.tone }}>
          {meta.numeral}
        </span>
        <div className="min-w-0 flex-1">
          <div style={{ fontFamily: SERIF, fontSize: 16, fontWeight: 600, color: "var(--v5-ink)", lineHeight: 1.2 }}>
            {meta.action}
          </div>
          <div className="mt-1" style={{ fontSize: 10.5, letterSpacing: "0.22em", color: "var(--v5-ink3)" }}>
            {meta.label}
          </div>
        </div>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 22,
            lineHeight: 1,
            color: items.length ? meta.tone : "var(--v5-ink-mute)",
            fontFeatureSettings: '"lnum" 1',
          }}
        >
          {items.length}
        </span>
      </div>

      {/* rows or empty */}
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-6">
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 13.5, color: "var(--v5-ink-mute)" }}>
            {meta.empty}
          </span>
        </div>
      ) : (
        <div className="mt-3">
          <AnimatePresence initial={false}>
            {items.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                style={{ borderTop: i === 0 ? "none" : HAIRLINE }}
              >
                <TodoRow todo={t} color={meta.tone} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

const AXIS_LABEL: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.3em",
  color: "var(--v5-ink3)",
};

/**
 * Full four-quadrant todo manager — embedded in Life Path (no standalone page).
 * Single top add-bar with 重要/紧急 toggles selects the target quadrant.
 */
export function QuadrantTodos({ className }: { className?: string }) {
  const todos = useTodosStore();
  const [text, setText] = useState("");
  const [important, setImportant] = useState(true);
  const [urgent, setUrgent] = useState(true);
  const [showDone, setShowDone] = useState(false);

  const targetQuad = quadFromFlags(important, urgent);
  const targetMeta = QUADRANTS.find((q) => q.id === targetQuad)!;

  const { byQuadrant, done, activeCount, pct } = useMemo(() => {
    const active = todos.filter((t) => !t.done);
    const map: Record<TodoQuadrant, TodoItem[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const t of active) map[t.quadrant].push(t);
    const doneList = todos.filter((t) => t.done);
    return {
      byQuadrant: map,
      done: doneList,
      activeCount: active.length,
      pct: todos.length === 0 ? 0 : Math.round((doneList.length / todos.length) * 100),
    };
  }, [todos]);

  const add = () => {
    if (!text.trim()) return;
    addTodo(text, undefined, targetQuad);
    setText("");
  };

  return (
    <section className={className}>
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="v5-eyebrow">TODAY&apos;S TASKS · 今日待办</p>
          <h2 className="mt-1.5 text-[28px] font-semibold leading-none" style={{ color: "var(--v5-ink)", fontFamily: SERIF }}>
            四象限清单
          </h2>
        </div>
        {todos.length > 0 ? (
          <div className="flex flex-col items-end gap-1.5 pt-1">
            <span style={{ fontSize: 13, color: "var(--v5-ink3)", fontFamily: SERIF }}>
              {activeCount > 0 ? (
                <>还剩 <span style={{ color: "var(--v5-accent)", fontWeight: 600 }}>{activeCount}</span> 项 · {pct}%</>
              ) : (
                <span style={{ color: "var(--m-success)", fontWeight: 600 }}>全部完成 · {pct}%</span>
              )}
            </span>
            <div className="overflow-hidden" style={{ width: 120, height: 2, borderRadius: 99, background: "rgba(var(--v5-ink-rgb),0.10)" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "var(--m-success)" : "var(--v5-accent)", borderRadius: 99, transition: "width 400ms" }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Add bar */}
      <div
        className="mb-5 overflow-hidden"
        style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 20, boxShadow: "var(--v5-sh-2)" }}
      >
        <div className="flex items-center gap-3 px-5 py-3">
          <span
            className="shrink-0 text-center transition-colors"
            style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, minWidth: 26, color: targetMeta.tone }}
          >
            {targetMeta.numeral}
          </span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="添加今日待办，回车确认…"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            style={{ color: "var(--v5-ink)", fontFamily: SERIF }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!text.trim()}
            className="shrink-0 rounded-full px-4 text-[13px] transition-all disabled:cursor-not-allowed disabled:opacity-45"
            style={{ height: 30, background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)", fontFamily: SERIF }}
          >
            添加
          </button>
        </div>
        <div className="flex items-center gap-4 px-5 py-2.5" style={{ borderTop: HAIRLINE }}>
          {[
            { label: "重要", value: important, set: setImportant },
            { label: "紧急", value: urgent, set: setUrgent },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              aria-pressed={b.value}
              onClick={() => b.set((v) => !v)}
              className="text-[13px] transition-colors"
              style={{
                fontFamily: SERIF,
                color: b.value ? "var(--v5-ink)" : "var(--v5-ink-mute)",
                textDecoration: b.value ? "underline" : "line-through",
                textDecorationColor: b.value ? "var(--v5-accent)" : "var(--v5-ink-mute)",
                textDecorationThickness: 1,
                textUnderlineOffset: 5,
              }}
            >
              {b.label}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1.5 text-[13px]" style={{ fontFamily: SERIF, color: "var(--v5-ink3)" }}>
            →
            <span style={{ color: targetMeta.tone, fontWeight: 600 }}>{targetMeta.numeral}</span>
            <span style={{ color: "var(--v5-ink2)" }}>{targetMeta.action}</span>
          </span>
        </div>
      </div>

      {/* Matrix：一整块玻璃 + 十字发丝线；桌面端带坐标轴标签 */}
      <div className="grid grid-cols-1 sm:grid-cols-[22px_1fr] sm:gap-x-3">
        {/* 顶部轴：紧急 / 不紧急 */}
        <div className="hidden sm:block" />
        <div className="mb-2 hidden grid-cols-2 sm:grid">
          <span className="text-center" style={AXIS_LABEL}>紧急</span>
          <span className="text-center" style={AXIS_LABEL}>不紧急</span>
        </div>

        {/* 左侧轴：重要 / 不重要（竖排） */}
        <div className="hidden grid-rows-2 sm:grid">
          {["重要", "不重要"].map((l) => (
            <span key={l} className="flex items-center justify-center" style={{ ...AXIS_LABEL, writingMode: "vertical-rl" }}>
              {l}
            </span>
          ))}
        </div>

        <div
          className="quad-matrix grid grid-cols-1 overflow-hidden sm:grid-cols-2"
          style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 22, boxShadow: "var(--v5-sh-2)" }}
        >
          {QUADRANTS.map((meta) => (
            <QuadCell key={meta.id} meta={meta} items={byQuadrant[meta.id]} />
          ))}
        </div>
      </div>

      {/* Completed (collapsible) */}
      {done.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--v5-ink3)", fontFamily: SERIF }}
            >
              {showDone ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              已完成 · {done.length} 项
            </button>
            <button
              type="button"
              onClick={() => clearCompletedTodos()}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: "var(--v5-ink3)" }}
            >
              清除已完成
            </button>
          </div>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-2 overflow-hidden rounded-2xl"
                style={{ background: "var(--m-base)", border: "1px solid var(--v5-rule)" }}
              >
                {done.map((t, i) => {
                  const meta = QUADRANTS.find((q) => q.id === t.quadrant) ?? QUADRANTS[3];
                  return (
                    <div key={t.id} className="px-4" style={{ borderTop: i === 0 ? "none" : HAIRLINE, opacity: 0.7 }}>
                      <TodoRow todo={t} color={meta.tone} />
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
