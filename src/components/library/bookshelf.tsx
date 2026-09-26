"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { addBook, quoteCountFor, removeBook, suggestTitlesFromQuotes, updateBook, useBooks } from "@/lib/books";
import { getTodayISODate, parseISODate } from "@/lib/date";
import { refreshLifePathState } from "@/lib/life-path-storage";
import type { Quote } from "@/types";
import type { Book, BookStatus } from "@/types/life-path";

/**
 * 书架：在读 / 想读 / 读完。进度、开始与读完日期都记下来，
 * 供首页「正在发生」和生命时间线使用。
 */

const SERIF = "var(--v5-serif)";
const STATUS_LABEL: Record<BookStatus, string> = { want: "想读", reading: "在读", done: "读完" };

const panel: React.CSSProperties = {
  background: "var(--v5-card)",
  border: "1px solid var(--v5-rule)",
  borderRadius: 22,
  boxShadow: "var(--v5-sh-1)",
};

function formatDay(iso?: string) {
  if (!iso) return "";
  const d = parseISODate(iso);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function SectionTitle({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <span className="v5-eyebrow">{children}</span>
      {extra}
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <span className="relative block h-[5px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(var(--v5-ink-rgb),0.09)" }}>
      <span className="absolute inset-y-0 left-0 block rounded-full" style={{ width: `${value}%`, background: "var(--v5-accent)", transition: "width 400ms var(--v5-ease-out)" }} />
    </span>
  );
}

function BookEditor({ book, onClose }: { book: Book; onClose: () => void }) {
  return (
    <div className="mt-4 grid gap-3 pt-4" style={{ borderTop: "1px solid var(--v5-rule)" }} onClick={(e) => e.stopPropagation()}>
      {book.status !== "done" && (
        <label className="flex items-center gap-3" style={{ fontFamily: SERIF, fontSize: 14, color: "var(--v5-ink3)" }}>
          进度
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={book.progress}
            onChange={(e) => updateBook(book.id, { progress: Number(e.target.value) })}
            className="flex-1 accent-[var(--v5-accent)]"
          />
          <span className="w-10 text-right" style={{ color: "var(--v5-ink)" }}>{book.progress}%</span>
        </label>
      )}
      {book.status === "done" && (
        <label className="flex items-center gap-3" style={{ fontFamily: SERIF, fontSize: 14, color: "var(--v5-ink3)" }}>
          读完于
          <input
            type="date"
            max={getTodayISODate()}
            value={book.finishedAt ?? ""}
            onChange={(e) => e.target.value && updateBook(book.id, { finishedAt: e.target.value })}
            className="rounded-full bg-transparent px-3 py-1 outline-none"
            style={{ border: "1px solid var(--v5-rule-strong)", color: "var(--v5-ink)" }}
          />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2" style={{ fontFamily: SERIF, fontSize: 13.5 }}>
        {(["want", "reading", "done"] as BookStatus[])
          .filter((s) => s !== book.status)
          .map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => updateBook(book.id, { status: s })}
              className="rounded-full px-3 py-1.5 transition-opacity hover:opacity-80"
              style={{ background: "rgba(var(--v5-accent-rgb),0.10)", color: "var(--v5-accent)" }}
            >
              {s === "done" ? "读完了" : s === "reading" ? "开始读 / 在读" : "移回想读"}
            </button>
          ))}
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`把《${book.title}》从书架移除？`)) removeBook(book.id);
          }}
          className="ml-auto inline-flex items-center gap-1 transition-opacity hover:opacity-80"
          style={{ color: "var(--v5-ink3)" }}
        >
          <Trash2 size={13} /> 移除
        </button>
        <button type="button" onClick={onClose} style={{ color: "var(--v5-ink3)" }}>
          收起
        </button>
      </div>
    </div>
  );
}

export function Bookshelf({ quotes }: { quotes: Quote[] }) {
  const books = useBooks();
  // 打开书架时从云端拉一次最新数据（其他设备上的改动）
  useEffect(() => {
    void refreshLifePathState();
  }, []);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ title: string; author: string; status: BookStatus }>({ title: "", author: "", status: "reading" });
  const [editingId, setEditingId] = useState<string | null>(null);

  const reading = books.filter((b) => b.status === "reading").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const want = books.filter((b) => b.status === "want").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const doneByYear = useMemo(() => {
    const m = new Map<string, Book[]>();
    for (const b of books.filter((x) => x.status === "done")) {
      const y = (b.finishedAt ?? b.updatedAt).slice(0, 4);
      m.set(y, [...(m.get(y) ?? []), b]);
    }
    return [...m.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([y, list]) => [y, list.sort((a, b) => (b.finishedAt ?? "").localeCompare(a.finishedAt ?? ""))] as const);
  }, [books]);
  const suggestions = useMemo(() => suggestTitlesFromQuotes(quotes, books), [quotes, books]);

  const thisYear = getTodayISODate().slice(0, 4);
  const doneThisYear = doneByYear.find(([y]) => y === thisYear)?.[1].length ?? 0;

  const submit = () => {
    if (!form.title.trim()) return;
    addBook({ title: form.title, author: form.author, status: form.status });
    setForm({ title: "", author: "", status: "reading" });
    setAdding(false);
  };

  const quoteLabel = (b: Book) => {
    const n = quoteCountFor(b, quotes);
    return n ? ` · ${n} 条金句` : "";
  };

  return (
    <div className="grid gap-8">
      {/* 摘要 + 添加 */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 18, color: "var(--v5-ink)" }}>
          在读 <span style={{ fontSize: 22, color: "var(--v5-accent)" }}>{reading.length}</span> 本
          <span aria-hidden style={{ margin: "0 10px", color: "var(--v5-ink-mute)" }}>·</span>
          想读 <span style={{ fontSize: 22, color: "var(--v5-accent)" }}>{want.length}</span> 本
          <span aria-hidden style={{ margin: "0 10px", color: "var(--v5-ink-mute)" }}>·</span>
          今年读完 <span style={{ fontSize: 22, color: "var(--v5-accent)" }}>{doneThisYear}</span> 本
        </p>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-opacity hover:opacity-90"
          style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)", fontFamily: SERIF }}
        >
          <Plus size={14} /> 添加一本书
        </button>
      </div>

      {adding && (
        <form
          className="grid gap-3 px-6 py-5"
          style={panel}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-wrap gap-4">
            <input
              autoFocus
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="书名"
              className="min-w-[220px] flex-[2] bg-transparent py-1.5 text-[17px] outline-none placeholder:text-[var(--v5-ink-mute)]"
              style={{ color: "var(--v5-ink)", fontFamily: SERIF, borderBottom: "1px solid var(--v5-rule)" }}
            />
            <input
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              placeholder="作者（可选）"
              className="min-w-[160px] flex-1 bg-transparent py-1.5 text-[15px] outline-none placeholder:text-[var(--v5-ink-mute)]"
              style={{ color: "var(--v5-ink)", fontFamily: SERIF, borderBottom: "1px solid var(--v5-rule)" }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2" style={{ fontFamily: SERIF, fontSize: 14 }}>
            {(["reading", "want", "done"] as BookStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setForm({ ...form, status: s })}
                className="rounded-full px-3.5 py-1.5"
                style={{
                  background: form.status === s ? "var(--v5-accent-fill)" : "transparent",
                  color: form.status === s ? "var(--v5-accent-fill-ink)" : "var(--v5-ink3)",
                  border: `1px solid ${form.status === s ? "var(--v5-accent-fill-ring)" : "var(--v5-rule)"}`,
                }}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
            <button type="submit" className="ml-auto rounded-full px-5 py-1.5" style={{ background: "var(--v5-pill-bg)", color: "var(--v5-pill-ink)" }}>
              放上书架
            </button>
            <button type="button" onClick={() => setAdding(false)} style={{ color: "var(--v5-ink3)" }}>
              取消
            </button>
          </div>
        </form>
      )}

      {/* 金句里提到过的书 */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" style={{ fontFamily: SERIF, fontSize: 14.5 }}>
          <span style={{ color: "var(--v5-ink3)" }}>金句里提到过：</span>
          {suggestions.map((s) => (
            <button
              key={s.title}
              type="button"
              title="加到书架（在读）"
              onClick={() => addBook({ title: s.title, status: "reading" })}
              className="transition-colors hover:text-[var(--v5-accent)]"
              style={{ color: "var(--v5-ink2)" }}
            >
              《{s.title}》<span style={{ color: "var(--v5-ink-mute)", fontSize: 12.5 }}>+</span>
            </button>
          ))}
        </div>
      )}

      {/* 在读 */}
      {reading.length > 0 && (
        <section>
          <SectionTitle>在读</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            {reading.map((b) => (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditingId(editingId === b.id ? null : b.id)}
                onKeyDown={(e) => e.key === "Enter" && setEditingId(editingId === b.id ? null : b.id)}
                className="cursor-pointer px-6 py-5 transition-colors hover:bg-[rgba(var(--v5-accent-rgb),0.04)]"
                style={panel}
              >
                <div style={{ fontFamily: SERIF, fontSize: 19, fontWeight: 600, color: "var(--v5-ink)" }}>《{b.title}》</div>
                <div className="mt-1" style={{ fontFamily: SERIF, fontSize: 13.5, color: "var(--v5-ink3)" }}>
                  {b.author ? `${b.author} · ` : ""}
                  {b.startedAt ? `${formatDay(b.startedAt)}开始` : "在读"}
                  {quoteLabel(b)}
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <ProgressBar value={b.progress} />
                  <span style={{ fontFamily: SERIF, fontSize: 16, color: "var(--v5-ink)", fontFeatureSettings: '"lnum" 1' }}>{b.progress}%</span>
                </div>
                {editingId === b.id && <BookEditor book={b} onClose={() => setEditingId(null)} />}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 想读 */}
      {want.length > 0 && (
        <section>
          <SectionTitle>想读</SectionTitle>
          <div className="overflow-hidden" style={panel}>
            {want.map((b, i) => (
              <div key={b.id} className="flex items-center gap-4 px-6 py-3.5" style={{ borderTop: i === 0 ? "none" : "1px solid var(--v5-rule)" }}>
                <span className="min-w-0 flex-1 truncate" style={{ fontFamily: SERIF, fontSize: 16, color: "var(--v5-ink)" }}>
                  《{b.title}》
                  {b.author && <span style={{ fontSize: 13.5, color: "var(--v5-ink3)" }}> {b.author}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => updateBook(b.id, { status: "reading" })}
                  className="shrink-0 text-[13.5px] transition-opacity hover:opacity-80"
                  style={{ fontFamily: SERIF, color: "var(--v5-accent)" }}
                >
                  开始读 →
                </button>
                <button type="button" aria-label="移除" onClick={() => removeBook(b.id)} style={{ color: "var(--v5-ink-mute)" }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 读完：按年份 */}
      {doneByYear.map(([year, list]) => (
        <section key={year}>
          <SectionTitle extra={<span style={{ fontFamily: SERIF, fontSize: 13.5, color: "var(--v5-ink3)" }}>{list.length} 本</span>}>
            {year} · 读完
          </SectionTitle>
          <div className="overflow-hidden" style={panel}>
            {list.map((b, i) => (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditingId(editingId === b.id ? null : b.id)}
                onKeyDown={(e) => e.key === "Enter" && setEditingId(editingId === b.id ? null : b.id)}
                className="cursor-pointer px-6 py-3.5 transition-colors hover:bg-[rgba(var(--v5-accent-rgb),0.04)]"
                style={{ borderTop: i === 0 ? "none" : "1px solid var(--v5-rule)" }}
              >
                <div className="flex items-baseline gap-4">
                  <span className="min-w-0 flex-1 truncate" style={{ fontFamily: SERIF, fontSize: 16, color: "var(--v5-ink)" }}>
                    《{b.title}》
                    <span style={{ fontSize: 13.5, color: "var(--v5-ink3)" }}>
                      {b.author ? ` ${b.author}` : ""}
                      {quoteLabel(b)}
                    </span>
                  </span>
                  <span className="shrink-0" style={{ fontFamily: SERIF, fontSize: 13.5, color: "var(--v5-ink3)" }}>{formatDay(b.finishedAt)}</span>
                </div>
                {editingId === b.id && <BookEditor book={b} onClose={() => setEditingId(null)} />}
              </div>
            ))}
          </div>
        </section>
      ))}

      {books.length === 0 && !adding && (
        <p style={{ fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink3)" }}>
          书架还是空的。添加正在读的书，或者从上面「金句里提到过」的书开始。
        </p>
      )}
    </div>
  );
}
