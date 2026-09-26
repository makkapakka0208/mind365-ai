"use client";

import { useMemo, useSyncExternalStore } from "react";

import { ACCOUNT_STORAGE_EVENT } from "@/lib/account-storage";
import { getTodayISODate } from "@/lib/date";
import { loadBooks, readBooksRaw, saveBooks } from "@/lib/life-path-storage";
import type { Quote } from "@/types";
import type { Book, BookStatus } from "@/types/life-path";

/** 书架读写。数据存在 life_path_state（kind = books），随账号同步。 */

function subscribe(cb: () => void) {
  window.addEventListener("mind365:storage", cb);
  window.addEventListener(ACCOUNT_STORAGE_EVENT, cb);
  return () => {
    window.removeEventListener("mind365:storage", cb);
    window.removeEventListener(ACCOUNT_STORAGE_EVENT, cb);
  };
}

export function useBooks(): Book[] {
  const raw = useSyncExternalStore(subscribe, readBooksRaw, () => null);
  return useMemo(() => {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as Book[]) : [];
    } catch {
      return [];
    }
  }, [raw]);
}

/** 书名比较用：去掉书名号和空白 */
export function normalizeTitle(title: string) {
  return title.replace(/[《》〈〉「」\s]/g, "").toLowerCase();
}

export function addBook(input: { title: string; author?: string; status: BookStatus }): Book {
  const now = new Date().toISOString();
  const today = getTodayISODate();
  const book: Book = {
    id: crypto.randomUUID(),
    title: input.title.trim().replace(/^《|》$/g, ""),
    author: input.author?.trim() || undefined,
    status: input.status,
    progress: input.status === "done" ? 100 : 0,
    startedAt: input.status === "reading" ? today : undefined,
    finishedAt: input.status === "done" ? today : undefined,
    createdAt: now,
    updatedAt: now,
  };
  saveBooks([...loadBooks(), book]);
  return book;
}

/** 更新一本书。进度到 100 自动标为读完；首次改为在读时记下开始日期。 */
export function updateBook(id: string, patch: Partial<Omit<Book, "id" | "createdAt">>) {
  const today = getTodayISODate();
  saveBooks(
    loadBooks().map((b) => {
      if (b.id !== id) return b;
      const next: Book = { ...b, ...patch, updatedAt: new Date().toISOString() };
      if (typeof patch.progress === "number") {
        next.progress = Math.max(0, Math.min(100, Math.round(patch.progress)));
        if (next.progress >= 100 && next.status !== "done") next.status = "done";
        if (next.progress > 0 && next.status === "want") next.status = "reading";
      }
      if (next.status === "reading" && !next.startedAt) next.startedAt = today;
      if (next.status === "done") {
        next.progress = 100;
        next.finishedAt = next.finishedAt ?? today;
      } else {
        next.finishedAt = undefined;
      }
      return next;
    }),
  );
}

export function removeBook(id: string) {
  saveBooks(loadBooks().filter((b) => b.id !== id));
}

/** 金句里提到过、但还没上书架的书名（按出现次数排序） */
export function suggestTitlesFromQuotes(quotes: Quote[], books: Book[], limit = 8): { title: string; count: number }[] {
  const onShelf = new Set(books.map((b) => normalizeTitle(b.title)));
  const count = new Map<string, { title: string; count: number }>();
  for (const q of quotes) {
    const raw = (q.book ?? "").trim().replace(/^《+|》+$/g, "");
    if (!raw) continue;
    const key = normalizeTitle(raw);
    if (!key || onShelf.has(key)) continue;
    const cur = count.get(key);
    count.set(key, { title: cur?.title ?? raw, count: (cur?.count ?? 0) + 1 });
  }
  return [...count.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/** 一本书在金句库里有几条金句 */
export function quoteCountFor(book: Book, quotes: Quote[]) {
  const key = normalizeTitle(book.title);
  return quotes.filter((q) => normalizeTitle(q.book ?? "") === key).length;
}
