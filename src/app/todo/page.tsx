"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Check, ListTodo, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";

import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
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

// ── Quadrant metadata (Eisenhower matrix) ──────────────────────
interface QuadrantMeta {
  id: TodoQuadrant;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  border: string;
}

const QUADRANTS: QuadrantMeta[] = [
  { id: "q1", title: "重要 · 紧急", subtitle: "立刻去做", color: "#C0392B", bg: "rgba(192,57,43,0.05)", border: "rgba(192,57,43,0.18)" },
  { id: "q2", title: "重要 · 不紧急", subtitle: "规划去做", color: "#4E7A64", bg: "rgba(78,122,100,0.05)", border: "rgba(78,122,100,0.18)" },
  { id: "q3", title: "不重要 · 紧急", subtitle: "尽量委托", color: "#C8893A", bg: "rgba(200,137,58,0.06)", border: "rgba(200,137,58,0.2)" },
  { id: "q4", title: "不重要 · 不紧急", subtitle: "尽量少做", color: "#8C7A6B", bg: "rgba(140,122,107,0.05)", border: "rgba(140,122,107,0.18)" },
];

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

// ── Due-date chip / picker ─────────────────────────────────────
function DueChip({ todo }: { todo: TodoItem }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = inputRef.current;
    if (!el) return;
    const withPicker = el as HTMLInputElement & { showPicker?: () => void };
    if (typeof withPicker.showPicker === "function") {
      try { withPicker.showPicker(); return; } catch { /* fall through */ }
    }
    el.focus();
    el.click();
  };

  const info = todo.dueDate ? describeDue(todo.dueDate, todo.done) : null;
  const colors = info ? TONE_COLORS[info.tone] : null;

  return (
    <span className="relative inline-flex shrink-0 items-center">
      {info && colors ? (
        <button
          type="button"
          onClick={openPicker}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition-opacity hover:opacity-80"
          style={{ color: colors.fg, background: colors.bg }}
        >
          <CalendarDays size={11} />
          {info.label}
        </button>
      ) : (
        <button
          type="button"
          aria-label="设置截止日期"
          onClick={openPicker}
          className="flex h-7 w-7 items-center justify-center rounded-full opacity-60 transition-all hover:bg-[rgba(0,0,0,0.05)] sm:opacity-0 sm:group-hover:opacity-60"
          style={{ color: "var(--m-ink3)" }}
        >
          <CalendarDays size={14} />
        </button>
      )}
      <input
        ref={inputRef}
        type="date"
        value={todo.dueDate ?? ""}
        onChange={(e) => setTodoDueDate(todo.id, e.target.value || undefined)}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
        tabIndex={-1}
      />
    </span>
  );
}

// ── Single row ─────────────────────────────────────────────────
function TodoRow({ todo }: { todo: TodoItem }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.text);

  const commitEdit = () => {
    setEditing(false);
    if (draft.trim() && draft.trim() !== todo.text) {
      updateTodoText(todo.id, draft);
    } else {
      setDraft(todo.text);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="group flex items-center gap-2.5 rounded-xl px-3 py-2.5"
      style={{ background: "var(--m-base-light)", border: "1px solid var(--m-rule)" }}
    >
      {/* Checkbox */}
      <button
        type="button"
        aria-label={todo.done ? "标记为未完成" : "标记为完成"}
        onClick={() => toggleTodo(todo.id)}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all"
        style={{
          border: `1.5px solid ${todo.done ? "var(--m-accent)" : "var(--m-ink3)"}`,
          background: todo.done ? "var(--m-accent)" : "transparent",
        }}
      >
        {todo.done && <Check size={11} color="#fffaf3" strokeWidth={3} />}
      </button>

      {/* Text / inline edit */}
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
          className="flex-1 truncate text-left text-sm leading-6 transition-colors"
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
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-60 transition-all hover:bg-[rgba(0,0,0,0.05)] sm:opacity-0 sm:group-hover:opacity-60"
        style={{ color: "var(--m-ink3)" }}
      >
        <Trash2 size={13} />
      </button>
    </motion.div>
  );
}

// ── Quadrant panel ─────────────────────────────────────────────
function Quadrant({ meta, items }: { meta: QuadrantMeta; items: TodoItem[] }) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!draft.trim()) return;
    addTodo(draft, undefined, meta.id);
    setDraft("");
  };

  return (
    <div
      className="flex flex-col rounded-2xl p-4"
      style={{ background: meta.bg, border: `1px solid ${meta.border}`, minHeight: 200 }}
    >
      {/* Header */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
            <h3 className="text-sm font-semibold tracking-[0.02em]" style={{ color: meta.color }}>
              {meta.title}
            </h3>
            {items.length > 0 && (
              <span className="text-xs" style={{ color: "var(--m-ink3)" }}>
                {items.length}
              </span>
            )}
          </div>
          <p className="mt-0.5 pl-4 text-[11px]" style={{ color: "var(--m-ink3)" }}>
            {meta.subtitle}
          </p>
        </div>
        <button
          type="button"
          aria-label={`在「${meta.title}」添加待办`}
          onClick={() => setAdding((v) => !v)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all hover:scale-105"
          style={{ background: meta.color, color: "#fffaf3" }}
        >
          <motion.span animate={{ rotate: adding ? 45 : 0 }} transition={{ duration: 0.18 }}>
            <Plus size={15} />
          </motion.span>
        </button>
      </div>

      {/* Inline add */}
      <AnimatePresence initial={false}>
        {adding && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            onSubmit={submit}
            className="mb-2 overflow-hidden"
          >
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setDraft(""); setAdding(false); } }}
              onBlur={() => { if (!draft.trim()) setAdding(false); }}
              placeholder="写点什么，回车添加…"
              maxLength={200}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--m-base-light)",
                border: `1px solid ${meta.border}`,
                color: "var(--m-ink)",
                fontFamily: SERIF,
              }}
            />
          </motion.form>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <TodoRow key={t.id} todo={t} />
          ))}
        </AnimatePresence>
      </div>

      {items.length === 0 && !adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 flex flex-1 items-center justify-center rounded-xl border border-dashed py-6 text-xs transition-colors hover:bg-[rgba(0,0,0,0.02)]"
          style={{ borderColor: meta.border, color: "var(--m-ink3)" }}
        >
          + 添加一项
        </button>
      )}
    </div>
  );
}

export default function TodoPage() {
  const todos = useTodosStore();

  const { byQuadrant, done, activeCount } = useMemo(() => {
    const active = todos.filter((t) => !t.done);
    const map: Record<TodoQuadrant, TodoItem[]> = { q1: [], q2: [], q3: [], q4: [] };
    for (const t of active) map[t.quadrant].push(t);
    return {
      byQuadrant: map,
      done: todos.filter((t) => t.done),
      activeCount: active.length,
    };
  }, [todos]);

  return (
    <PageTransition className="mx-auto w-full max-w-4xl space-y-6">
      <PageTitle
        eyebrow="TODO · 四象限"
        icon={ListTodo}
        title="待办清单"
        description="用艾森豪威尔矩阵给事情分类：先做重要且紧急的，规划重要不紧急的。点右上角 + 在对应象限添加。"
        rightSlot={
          activeCount > 0 ? (
            <span style={{ color: "var(--m-ink3)" }}>
              还剩 <span style={{ color: "var(--m-accent)", fontWeight: 600 }}>{activeCount}</span> 项
            </span>
          ) : null
        }
      />

      {/* Matrix */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {QUADRANTS.map((meta) => (
          <Quadrant key={meta.id} meta={meta} items={byQuadrant[meta.id]} />
        ))}
      </div>

      {/* Completed */}
      {done.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs tracking-[0.12em]" style={{ color: "var(--m-ink3)" }}>
              已完成 · {done.length}
            </span>
            <button
              type="button"
              onClick={() => clearCompletedTodos()}
              className="inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-70"
              style={{ color: "var(--m-ink3)" }}
            >
              <X size={12} />
              清除已完成
            </button>
          </div>
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {done.map((t) => (
                <TodoRow key={t.id} todo={t} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
