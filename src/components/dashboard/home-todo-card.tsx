"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ListTodo, Plus } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { getTodayISODate } from "@/lib/date";
import { addTodo, toggleTodo } from "@/lib/storage";
import { useTodosStore } from "@/lib/storage-store";

const SERIF = '"Noto Serif SC", "Songti SC", serif';
const MAX_VISIBLE = 4;

function dueBadge(due: string): { label: string; color: string } | null {
  const today = getTodayISODate();
  const diff = Math.round(
    (new Date(`${due}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000,
  );
  if (diff < 0) return { label: `逾期${-diff}天`, color: "#C0392B" };
  if (diff === 0) return { label: "今天", color: "var(--m-accent)" };
  if (diff === 1) return { label: "明天", color: "#7e6046" };
  const [, mm, dd] = due.split("-");
  return { label: `${Number(mm)}/${Number(dd)}`, color: "var(--m-ink3)" };
}

export function HomeTodoCard({ className }: { className?: string }) {
  const todos = useTodosStore();
  const [text, setText] = useState("");

  const active = todos.filter((t) => !t.done);
  const visible = active.slice(0, MAX_VISIBLE);
  const overflow = active.length - visible.length;

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!text.trim()) return;
    addTodo(text);
    setText("");
  };

  return (
    <div
      className={className}
      style={{
        borderRadius: 24,
        background: "linear-gradient(180deg, rgba(255,250,242,0.96), rgba(240,230,211,0.85))",
        border: "1px solid rgba(139,94,60,0.1)",
        boxShadow: "0 8px 24px rgba(180,150,110,0.12)",
        padding: 20,
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo size={16} style={{ color: "var(--m-accent)" }} />
          <span className="text-sm font-semibold tracking-[0.04em]" style={{ color: "var(--m-ink)" }}>
            待办清单
          </span>
          {active.length > 0 && (
            <span className="text-xs" style={{ color: "var(--m-ink3)" }}>
              · 还剩 {active.length} 项
            </span>
          )}
        </div>
        <Link className="text-xs" href="/todo" style={{ color: "var(--m-accent)" }}>
          全部 →
        </Link>
      </div>

      {/* Quick add */}
      <form onSubmit={onSubmit} className="mb-3 flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="添加一项…"
          maxLength={200}
          className="h-9 flex-1 rounded-xl px-3 text-sm outline-none"
          style={{
            background: "var(--m-base)",
            border: "1px solid var(--m-rule)",
            color: "var(--m-ink)",
            fontFamily: SERIF,
          }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="添加待办"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-opacity disabled:opacity-40"
          style={{ background: "var(--m-accent)", color: "#fffaf3" }}
        >
          <Plus size={16} />
        </button>
      </form>

      {/* List */}
      {active.length === 0 ? (
        <p className="py-3 text-center text-sm" style={{ color: "var(--m-ink3)", fontFamily: SERIF }}>
          今天还没有待办，享受当下。
        </p>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {visible.map((t) => (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.18 } }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-2.5"
              >
                <button
                  type="button"
                  aria-label="标记为完成"
                  onClick={() => toggleTodo(t.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all"
                  style={{ border: "1.5px solid var(--m-ink3)", background: "transparent" }}
                >
                  <Check size={11} color="transparent" />
                </button>
                <span className="truncate text-sm leading-6" style={{ color: "var(--m-ink2)", fontFamily: SERIF }}>
                  {t.text}
                </span>
                {t.dueDate && (() => {
                  const b = dueBadge(t.dueDate);
                  return b ? (
                    <span className="ml-auto shrink-0 text-[11px]" style={{ color: b.color }}>
                      {b.label}
                    </span>
                  ) : null;
                })()}
              </motion.div>
            ))}
          </AnimatePresence>
          {overflow > 0 && (
            <Link
              href="/todo"
              className="block pt-1 text-xs"
              style={{ color: "var(--m-ink3)" }}
            >
              还有 {overflow} 项…
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
