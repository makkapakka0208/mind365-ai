"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ListTodo, Plus, Trash2, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import {
  addTodo,
  clearCompletedTodos,
  deleteTodo,
  toggleTodo,
  updateTodoText,
} from "@/lib/storage";
import { useTodosStore } from "@/lib/storage-store";
import type { TodoItem } from "@/types";

const SERIF = '"Noto Serif SC", "Songti SC", serif';

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
      className="group flex items-center gap-3 rounded-2xl px-3.5 py-3"
      style={{
        background: "var(--m-base)",
        border: "1px solid var(--m-rule)",
      }}
    >
      {/* Checkbox */}
      <button
        type="button"
        aria-label={todo.done ? "标记为未完成" : "标记为完成"}
        onClick={() => toggleTodo(todo.id)}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all"
        style={{
          border: `1.5px solid ${todo.done ? "var(--m-accent)" : "var(--m-ink3)"}`,
          background: todo.done ? "var(--m-accent)" : "transparent",
        }}
      >
        {todo.done && <Check size={13} color="#fffaf3" strokeWidth={3} />}
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
          className="flex-1 bg-transparent text-[15px] outline-none"
          style={{ color: "var(--m-ink)", fontFamily: SERIF }}
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(todo.text); setEditing(true); }}
          className="flex-1 text-left text-[15px] leading-6 transition-colors"
          style={{
            color: todo.done ? "var(--m-ink3)" : "var(--m-ink)",
            textDecoration: todo.done ? "line-through" : "none",
            fontFamily: SERIF,
          }}
        >
          {todo.text}
        </button>
      )}

      {/* Delete */}
      <button
        type="button"
        aria-label="删除"
        onClick={() => deleteTodo(todo.id)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full opacity-60 transition-all hover:bg-[rgba(0,0,0,0.05)] sm:opacity-0 sm:group-hover:opacity-60"
        style={{ color: "var(--m-ink3)" }}
      >
        <Trash2 size={14} />
      </button>
    </motion.div>
  );
}

export default function TodoPage() {
  const todos = useTodosStore();
  const [text, setText] = useState("");

  const { active, done } = useMemo(() => {
    return {
      active: todos.filter((t) => !t.done),
      done: todos.filter((t) => t.done),
    };
  }, [todos]);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) return;
    addTodo(text);
    setText("");
  };

  return (
    <PageTransition className="mx-auto w-full max-w-2xl space-y-6">
      <PageTitle
        eyebrow="TODO"
        icon={ListTodo}
        title="待办清单"
        description="随手记下今天要做的事，完成后打勾。轻量、即时，只属于此刻。"
        rightSlot={
          active.length > 0 ? (
            <span style={{ color: "var(--m-ink3)" }}>
              还剩 <span style={{ color: "var(--m-accent)", fontWeight: 600 }}>{active.length}</span> 项
            </span>
          ) : null
        }
      />

      {/* Add bar */}
      <form onSubmit={onSubmit} className="flex items-center gap-2.5">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="添加一项待办，回车确认…"
          maxLength={200}
        />
        <Button type="submit" disabled={!text.trim()} className="shrink-0 px-4">
          <Plus size={16} className="mr-1" />
          添加
        </Button>
      </form>

      {/* Empty state */}
      {todos.length === 0 && (
        <Panel className="flex flex-col items-center gap-2 px-6 py-14 text-center" inset>
          <ListTodo size={28} style={{ color: "var(--m-ink3)" }} />
          <p className="text-[15px]" style={{ color: "var(--m-ink2)", fontFamily: SERIF }}>
            还没有待办。写下第一件想做的事吧。
          </p>
        </Panel>
      )}

      {/* Active list */}
      {active.length > 0 && (
        <div className="space-y-2">
          <AnimatePresence initial={false}>
            {active.map((t) => (
              <TodoRow key={t.id} todo={t} />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Done section */}
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
