"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ChevronDown, ChevronRight, Clock, Inbox, Target, Trash2, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

const SERIF = '"Noto Serif SC", "Songti SC", serif';

// ── Quadrant metadata (Eisenhower matrix) — colors per design QUAD_CFG ──
interface QuadrantMeta {
  id: TodoQuadrant;
  label: string;
  icon: LucideIcon;
  color: string;
}

const QUADRANTS: QuadrantMeta[] = [
  { id: "q1", label: "重要且紧急", icon: Zap, color: "#b04040" },
  { id: "q2", label: "重要不紧急", icon: Target, color: "#c8893a" },
  { id: "q3", label: "不重要且紧急", icon: Clock, color: "#5a8a3c" },
  { id: "q4", label: "不重要不紧急", icon: Inbox, color: "#4a7a9b" },
];

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
  overdue: { fg: "#C0392B", bg: "rgba(192,57,43,0.1)" },
  today: { fg: "var(--m-accent)", bg: "rgba(139,94,60,0.12)" },
  tomorrow: { fg: "#7e6046", bg: "rgba(126,96,70,0.1)" },
  future: { fg: "var(--m-ink3)", bg: "rgba(139,94,60,0.07)" },
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
    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-50 transition-all sm:opacity-0 sm:group-hover:opacity-50" style={{ color: "var(--m-ink3)" }}>
      <CalendarDays size={13} />
      {overlayInput}
    </span>
  );
}

// ── Single todo row (lives inside a quadrant card, hairline-separated) ──
function TodoRow({ todo, color }: { todo: TodoItem; color: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

  const commitEdit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== todo.text) updateTodoText(todo.id, draft);
    else setDraft(todo.text);
  };

  return (
    <div className="group flex items-center gap-2.5 px-3.5 py-2.5">
      <button
        type="button"
        aria-label={todo.done ? "标记为未完成" : "标记为完成"}
        onClick={() => toggleTodo(todo.id)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all"
        style={{
          border: `1.5px solid ${todo.done ? color : "rgba(139,94,60,0.30)"}`,
          background: todo.done ? color : "transparent",
        }}
      >
        {todo.done && <Check size={11} color="#fff" strokeWidth={3} />}
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
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--m-ink)", fontFamily: SERIF }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(todo.text); setEditing(true); }}
          className="flex-1 truncate text-left text-sm leading-6"
          style={{
            color: todo.done ? "var(--m-ink3)" : "var(--m-ink)",
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
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full opacity-60 transition-all hover:bg-[rgba(0,0,0,0.05)] sm:opacity-0 sm:group-hover:opacity-60"
        style={{ color: "var(--m-ink3)" }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ── Quadrant card ──────────────────────────────────────────────
function QuadCard({ meta, items }: { meta: QuadrantMeta; items: TodoItem[] }) {
  const Icon = meta.icon;
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 22, boxShadow: "var(--v5-sh-2)", minHeight: 150 }}
    >
      {/* top color bar */}
      <div style={{ height: 3, background: meta.color, opacity: 0.65 }} />

      {/* header */}
      <div className="flex items-center justify-between px-3.5 py-2.5" style={{ borderBottom: "1px solid var(--m-rule)" }}>
        <div className="flex items-center gap-2">
          <Icon size={14} style={{ color: meta.color }} />
          <span className="text-[13px] font-semibold" style={{ color: meta.color }}>{meta.label}</span>
        </div>
        <span
          className="grid place-items-center text-xs font-semibold"
          style={{ minWidth: 20, height: 20, borderRadius: 6, background: `${meta.color}1a`, color: meta.color }}
        >
          {items.length}
        </span>
      </div>

      {/* rows or empty */}
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center py-7">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ border: "1.5px solid rgba(139,94,60,0.16)", color: "rgba(139,94,60,0.22)" }}
          >
            <Check size={15} />
          </span>
        </div>
      ) : (
        <div>
          <AnimatePresence initial={false}>
            {items.map((t, i) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                style={{ borderTop: i === 0 ? "none" : "1px solid rgba(139,94,60,0.08)" }}
              >
                <TodoRow todo={t} color={meta.color} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

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
          <p className="text-[11px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--m-ink3)" }}>
            TODAY&apos;S TASKS · 今日待办
          </p>
          <h2 className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em]" style={{ color: "var(--m-ink)", fontFamily: SERIF }}>
            四象限清单
          </h2>
        </div>
        {todos.length > 0 ? (
          <div className="flex flex-col items-end gap-1.5 pt-1">
            <span style={{ fontSize: 13, color: "var(--m-ink3)" }}>
              {activeCount > 0 ? (
                <>还剩 <span style={{ color: "var(--m-accent)", fontWeight: 600 }}>{activeCount}</span> 项 · {pct}%</>
              ) : (
                <span style={{ color: "#5a8a3c", fontWeight: 600 }}>全部完成 · {pct}%</span>
              )}
            </span>
            <div className="overflow-hidden" style={{ width: 120, height: 3, borderRadius: 99, background: "rgba(139,94,60,0.12)" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#5a8a3c" : "var(--m-accent)", borderRadius: 99, transition: "width 400ms" }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Add bar */}
      <div
        className="mb-5 overflow-hidden"
        style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 22, boxShadow: "var(--v5-sh-2)" }}
      >
        <div className="flex items-center gap-2.5 px-4 py-3">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full transition-colors" style={{ background: targetMeta.color }} />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") add(); }}
            placeholder="添加今日待办，回车确认…"
            maxLength={200}
            className="min-w-0 flex-1 bg-transparent text-[14.5px] outline-none"
            style={{ color: "var(--m-ink)", fontFamily: SERIF }}
          />
          <button
            type="button"
            onClick={add}
            disabled={!text.trim()}
            className="shrink-0 rounded-[9px] px-3.5 text-xs transition-all disabled:cursor-not-allowed"
            style={{
              height: 30,
              background: text.trim() ? "var(--m-ink)" : "rgba(139,94,60,0.10)",
              color: text.trim() ? "#fff" : "var(--m-ink3)",
              fontFamily: SERIF,
            }}
          >
            添加
          </button>
        </div>
        <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderTop: "1px solid rgba(139,94,60,0.08)" }}>
          <span className="text-[11px]" style={{ color: "var(--m-ink3)" }}>象限：</span>
          {[
            { label: "重要", value: important, set: setImportant, color: "#c8893a" },
            { label: "紧急", value: urgent, set: setUrgent, color: "#b04040" },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => b.set((v) => !v)}
              className="rounded-lg px-2.5 py-1 text-xs transition-all"
              style={{
                fontFamily: SERIF,
                background: b.value ? `${b.color}15` : "rgba(139,94,60,0.05)",
                color: b.value ? b.color : "var(--m-ink3)",
                outline: b.value ? `1.5px solid ${b.color}40` : "1.5px solid transparent",
              }}
            >
              {b.label}
            </button>
          ))}
          <span className="ml-auto inline-flex items-center gap-1 text-xs" style={{ color: targetMeta.color, fontWeight: 600 }}>
            → {targetMeta.label}
          </span>
        </div>
      </div>

      {/* Matrix */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {QUADRANTS.map((meta) => (
          <QuadCard key={meta.id} meta={meta} items={byQuadrant[meta.id]} />
        ))}
      </div>

      {/* Completed (collapsible) */}
      {done.length > 0 && (
        <div className="mt-5">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowDone((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
              style={{ color: "var(--m-ink3)", fontFamily: SERIF }}
            >
              {showDone ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              已完成 · {done.length} 项
            </button>
            <button
              type="button"
              onClick={() => clearCompletedTodos()}
              className="text-xs transition-opacity hover:opacity-70"
              style={{ color: "var(--m-ink3)" }}
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
                style={{ background: "rgba(244,236,220,0.4)", border: "1px solid var(--m-rule)" }}
              >
                {done.map((t, i) => {
                  const meta = QUADRANTS.find((q) => q.id === t.quadrant) ?? QUADRANTS[3];
                  return (
                    <div key={t.id} style={{ borderTop: i === 0 ? "none" : "1px solid rgba(139,94,60,0.08)", opacity: 0.7 }}>
                      <TodoRow todo={t} color={meta.color} />
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
