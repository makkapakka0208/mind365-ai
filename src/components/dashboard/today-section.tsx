"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import { getTodayISODate, getWeekRange, parseISODate, toISODate } from "@/lib/date";
import { useBooks } from "@/lib/books";
import { currentWeekKey, loadGoals, loadWeekPlan, refreshLifePathState } from "@/lib/life-path-storage";
import { pickOnThisDay } from "@/lib/memory-triggers";
import { useDailyLogsStore, useTodosStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";

/**
 * 首页「今天」板块：今天的记录状态 + 最近的你（本周）/ 正在发生 / 那年今日。
 * 只用现有数据、不调用 AI；每一栏没有内容时整栏不显示。
 * 结果都是确定的（不随机），刷新页面不会变。
 */

const SERIF = "var(--v5-serif)";
const noopSubscribe = () => () => {};

function daysAgoIso(days: number, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

function countChars(text: string) {
  return text.replace(/\s/g, "").length;
}

function excerpt(text: string, max: number) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function streakDays(logs: DailyLog[]) {
  const dates = new Set(logs.map((l) => l.date));
  let n = 0;
  // 今天没写不打断连续：从今天或昨天开始往回数
  let offset = dates.has(getTodayISODate()) ? 0 : 1;
  while (dates.has(daysAgoIso(offset))) {
    n++;
    offset++;
  }
  return n;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 最近的你：和问候卡、统计卡用同一个时间口径（本周从周一开始），
 * 篇数与「上周同期」比；心情分统计卡里已有，这里不重复，只补卡片里没有的观察。
 */
function recentLines(logs: DailyLog[]): string[] {
  const now = new Date();
  const week = getWeekRange(now);
  const weekStart = toISODate(week.start);
  const todayIso = toISODate(now);
  const thisWeek = logs.filter((l) => l.date >= weekStart && l.date <= todayIso);

  const lastWeekStart = new Date(week.start);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekSameDay = new Date(now);
  lastWeekSameDay.setDate(lastWeekSameDay.getDate() - 7);
  const lastWeekSoFar = logs.filter((l) => l.date >= toISODate(lastWeekStart) && l.date <= toISODate(lastWeekSameDay));

  if (thisWeek.length === 0 && lastWeekSoFar.length === 0) return [];

  const lines: string[] = [];
  const diff = thisWeek.length - lastWeekSoFar.length;
  const cmp = lastWeekSoFar.length === 0 && thisWeek.length > 0
    ? "，上周同期还没写"
    : diff > 0 ? `，比上周同期多 ${diff} 篇` : diff < 0 ? `，比上周同期少 ${-diff} 篇` : "，和上周同期一样";
  lines.push(thisWeek.length === 0 ? "本周还没有记录" : `本周写了 ${thisWeek.length} 篇${cmp}`);

  if (thisWeek.length >= 2) {
    const longest = [...thisWeek].sort((x, y) => countChars(y.thoughts) - countChars(x.thoughts))[0];
    const chars = countChars(longest.thoughts);
    if (chars > 0) lines.push(`写得最多的一天是${WEEKDAYS[parseISODate(longest.date).getDay()]}，${chars.toLocaleString("zh-CN")} 字`);
  }

  const tagCount = new Map<string, number>();
  for (const log of thisWeek) for (const tag of new Set(log.tags)) tagCount.set(tag, (tagCount.get(tag) ?? 0) + 1);
  const top = [...tagCount.entries()].sort((x, y) => y[1] - x[1])[0];
  if (top && top[1] >= 2) lines.push(`有 ${top[1]} 篇都写到了 #${top[0]}`);

  return lines;
}

/** 那年今日：先找往年同月同日；没有就找「几个月前的今天」（同一日号，最近的那个月）。 */
function pickMemory(logs: DailyLog[]): { label: string; entry: DailyLog } | null {
  const onThisDay = pickOnThisDay(logs);
  if (onThisDay) return { label: onThisDay.trigger.label, entry: onThisDay.entry };

  const byDate = new Map(logs.map((l) => [l.date, l]));
  const today = new Date();
  for (let k = 1; k <= 11; k++) {
    const d = new Date(today.getFullYear(), today.getMonth() - k, today.getDate());
    if (d.getDate() !== today.getDate()) continue; // 该月没有这一天（如 2 月 30 日）
    const entry = byDate.get(toISODate(d));
    if (entry && entry.thoughts.trim()) return { label: k === 1 ? "一个月前的今天" : `${k} 个月前的今天`, entry };
  }
  return null;
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-6 py-5">
      <div className="v5-eyebrow" style={{ marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5" style={{ fontFamily: SERIF, fontSize: 15, lineHeight: 1.75, color: "var(--v5-ink2)" }}>
      <span aria-hidden style={{ color: "var(--v5-accent)", opacity: 0.7 }}>·</span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function TodaySection({ onOpenLog }: { onOpenLog: (id: string) => void }) {
  const logs = useDailyLogsStore();
  const todos = useTodosStore();
  const books = useBooks();
  // 书架、目标、本周计划：拉一次云端最新数据
  useEffect(() => {
    void refreshLifePathState();
  }, []);
  // 目标 / 本周计划存在本地账号数据里，只在浏览器读取，避免服务端渲染不一致
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);

  const todayIso = getTodayISODate();
  const todayLog = useMemo(() => logs.find((l) => l.date === todayIso) ?? null, [logs, todayIso]);
  const recent = useMemo(() => recentLines(logs), [logs]);
  const memory = useMemo(() => pickMemory(logs), [logs]);
  const streak = useMemo(() => streakDays(logs), [logs]);

  const happening = useMemo(() => {
    const lines: React.ReactNode[] = [];
    if (streak >= 2) lines.push(`已连续记录 ${streak} 天`);

    // 在读：优先用书架（带进度），书架没有在读的书时退回日记里的阅读记录
    const readingBooks = books
      .filter((b) => b.status === "reading")
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 2);
    if (readingBooks.length) {
      for (const b of readingBooks) lines.push(b.progress > 0 ? `《${b.title}》读到 ${b.progress}%` : `在读《${b.title}》`);
    } else {
      const reading = [...logs]
        .filter((l) => l.reading.trim() && l.date > daysAgoIso(14))
        .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      if (reading) lines.push(`在读 ${excerpt(reading.reading, 24)}`);
    }

    if (isClient) {
      const focus = loadWeekPlan(currentWeekKey())?.focus?.trim();
      if (focus) lines.push(`本周重点：${excerpt(focus, 28)}`);
      for (const goal of loadGoals().filter((g) => g.targetValue > 0).slice(0, 2)) {
        const pct = Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
        lines.push(`${goal.title} · 进度 ${pct}%`);
      }
    }

    const openTodos = todos.filter((t) => !t.done).length;
    if (openTodos > 0) lines.push(`还有 ${openTodos} 项待办`);
    return lines;
  }, [logs, todos, books, streak, isClient]);

  const columns = [
    recent.length > 0 && (
      <Column key="recent" title="最近的你">
        <ul className="m-0 space-y-1.5 p-0">{recent.map((l) => <Line key={l}>{l}</Line>)}</ul>
      </Column>
    ),
    happening.length > 0 && (
      <Column key="happening" title="正在发生">
        <ul className="m-0 space-y-1.5 p-0">{happening.map((l, i) => <Line key={i}>{l}</Line>)}</ul>
      </Column>
    ),
    memory && (
      <Column key="memory" title="那年今日">
        <button type="button" className="group block w-full text-left" onClick={() => onOpenLog(memory.entry.id)}>
          <div style={{ fontFamily: SERIF, fontSize: 13, color: "var(--v5-ink3)" }}>
            {memory.label} · {parseISODate(memory.entry.date).getFullYear()} 年 {parseISODate(memory.entry.date).getMonth() + 1} 月 {parseISODate(memory.entry.date).getDate()} 日
          </div>
          <p
            className="mt-2 transition-colors group-hover:text-[var(--v5-ink)]"
            style={{
              margin: "8px 0 0",
              fontFamily: SERIF,
              fontSize: 15,
              lineHeight: 1.8,
              fontStyle: "italic",
              color: "var(--v5-ink2)",
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {excerpt(memory.entry.thoughts, 120) || "那天只记下了心情。"}
          </p>
          <span className="mt-2 inline-block text-[13px] transition-transform group-hover:translate-x-0.5" style={{ fontFamily: SERIF, color: "var(--v5-accent)" }}>
            翻开那一页 →
          </span>
        </button>
      </Column>
    ),
  ].filter(Boolean);

  return (
    <section
      className="overflow-hidden"
      style={{ background: "var(--v5-card)", border: "1px solid var(--v5-rule)", borderRadius: 28, boxShadow: "var(--v5-sh-2)" }}
    >
      {/* 今天：记录状态 */}
      <div
        className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4"
        style={{ borderBottom: columns.length ? "1px solid var(--v5-rule)" : "none", background: "rgba(var(--v5-accent-rgb),0.04)" }}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="v5-eyebrow">今天</span>
          {todayLog ? (
            <span style={{ fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink2)" }}>
              写了 {countChars(todayLog.thoughts)} 字
              {todayLog.mood > 0 ? ` · 心情 ${todayLog.mood}/10` : ""}
              {todayLog.thoughts.trim() && (
                <span style={{ fontStyle: "italic", color: "var(--v5-ink3)" }}>　“{excerpt(todayLog.thoughts, 36)}”</span>
              )}
            </span>
          ) : (
            <span style={{ fontFamily: SERIF, fontSize: 15, color: "var(--v5-ink2)" }}>还没有记录。</span>
          )}
        </div>
        <Link href="/daily-log" className="shrink-0 text-[14px] transition-opacity hover:opacity-80" style={{ fontFamily: SERIF, color: "var(--v5-accent)" }}>
          {todayLog ? "继续写 →" : "写一笔 →"}
        </Link>
      </div>

      {columns.length > 0 && (
        <div
          className="today-columns grid"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
        >
          {columns}
        </div>
      )}
    </section>
  );
}
