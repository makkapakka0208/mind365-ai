"use client";

import { apiFetch } from "@/lib/api";
import { parseISODate } from "@/lib/date";
import { useParsedList } from "@/lib/habits";
import type { RestBlock } from "@/lib/holidays";
import {
  currentWeekKey,
  loadBooks,
  loadGoals,
  loadHabits,
  loadRestPlans,
  loadWeekPlan,
  readRestPlansRaw,
  saveRestPlans,
  saveWeekPlan,
} from "@/lib/life-path-storage";
import { getTodos, toggleTodo } from "@/lib/storage";
import type { RestItemKind, RestPlan, RestPlanDay, RestPlanItem, RestPlanPace } from "@/types/life-path";

/**
 * 周末 / 假期计划：根据本周任务、待办、习惯、目标和在读的书，给一段连续休息日排出精确到时间的计划。
 * 优先用大模型（/api/rest-plan）；AI 不可用时按本地规则排一份，保证功能始终可用。
 * 只发送计划相关的标题文字，不发送日记内容。
 */

export const useRestPlans = () => useParsedList<RestPlan>(readRestPlansRaw);

export const PACE_LABEL: Record<RestPlanPace, string> = { relaxed: "轻松", balanced: "平衡", full: "充实" };

export const KIND_LABEL: Record<RestItemKind, string> = {
  fixed: "已定",
  task: "任务",
  todo: "待办",
  habit: "习惯",
  goal: "目标",
  reading: "阅读",
  rest: "休息",
  life: "生活",
};

export const WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

// ── 生成用的素材 ────────────────────────────────────────────────────────────

export interface RestPlanContext {
  tasks: Array<{ id: string; text: string; goal?: string }>;
  todos: Array<{ id: string; text: string; urgent: boolean; important: boolean; due?: string }>;
  habits: Array<{ id: string; name: string; target: string; weeklyDays: number }>;
  goals: Array<{ id: string; title: string; progress: number; deadline?: string }>;
  reading: Array<{ title: string; progress: number }>;
}

export function buildRestPlanContext(): RestPlanContext {
  const goals = loadGoals();
  const goalTitle = new Map(goals.map((g) => [g.id, g.title]));
  const week = loadWeekPlan(currentWeekKey());
  return {
    tasks: (week?.tasks ?? [])
      .filter((t) => !t.done && t.text.trim())
      .slice(0, 20)
      .map((t) => ({ id: t.id, text: t.text.trim(), goal: goalTitle.get(t.goalId) })),
    todos: getTodos()
      .filter((t) => !t.done && t.text.trim())
      .sort((a, b) => a.quadrant.localeCompare(b.quadrant) || a.order - b.order)
      .slice(0, 25)
      .map((t) => ({
        id: t.id,
        text: t.text.trim(),
        // 四象限：q1 重要紧急、q2 重要不紧急、q3 紧急不重要、q4 都不
        urgent: t.quadrant === "q1" || t.quadrant === "q3",
        important: t.quadrant === "q1" || t.quadrant === "q2",
        ...(t.dueDate ? { due: t.dueDate } : {}),
      })),
    habits: loadHabits()
      .filter((h) => !h.archivedAt)
      .map((h) => ({ id: h.id, name: h.name, target: `${h.dailyTarget} ${h.unit}`, weeklyDays: h.weeklyDays })),
    goals: goals
      .filter((g) => g.targetValue > 0 && g.currentValue < g.targetValue)
      .slice(0, 8)
      .map((g) => ({
        id: g.id,
        title: g.title,
        progress: Math.round((g.currentValue / g.targetValue) * 100),
        ...(g.deadline ? { deadline: g.deadline } : {}),
      })),
    reading: loadBooks()
      .filter((b) => b.status === "reading")
      .slice(0, 3)
      .map((b) => ({ title: b.title, progress: b.progress })),
  };
}

// ── 生成 ────────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID();
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const KINDS: RestItemKind[] = ["fixed", "task", "todo", "habit", "goal", "reading", "rest", "life"];

/** 把 AI（或任何来源）的结果整理成合法的计划：只保留这段休息日里的日期、时间格式正确的条目，按时间排序 */
function normalizeDays(block: RestBlock, raw: unknown, ctx: RestPlanContext): RestPlanDay[] {
  const validRefs = new Set([...ctx.tasks, ...ctx.todos, ...ctx.habits, ...ctx.goals].map((x) => x.id));
  const byDate = new Map<string, RestPlanItem[]>();
  for (const day of Array.isArray(raw) ? raw : []) {
    if (!day || typeof day !== "object" || !block.dates.includes(day.date) || !Array.isArray(day.items)) continue;
    const items: RestPlanItem[] = [];
    for (const it of day.items) {
      if (!it || typeof it.title !== "string" || !it.title.trim() || !TIME_RE.test(it.start)) continue;
      items.push({
        id: uid(),
        start: it.start,
        ...(typeof it.end === "string" && TIME_RE.test(it.end) && it.end > it.start ? { end: it.end } : {}),
        title: it.title.trim().slice(0, 40),
        kind: KINDS.includes(it.kind) ? it.kind : "life",
        ...(typeof it.refId === "string" && validRefs.has(it.refId) ? { refId: it.refId } : {}),
      });
    }
    byDate.set(day.date, items.sort((a, b) => a.start.localeCompare(b.start)));
  }
  return block.dates.map((date) => ({ date, items: byDate.get(date) ?? [] }));
}

/** AI 不可用时的本地排法：每天固定的作息骨架 + 按优先级把习惯、待办、任务、阅读填进空档 */
function generateLocally(block: RestBlock, pace: RestPlanPace, ctx: RestPlanContext): RestPlanDay[] {
  const slotsByPace: Record<RestPlanPace, Array<[string, string]>> = {
    relaxed: [["10:00", "11:00"], ["15:00", "16:00"]],
    balanced: [["09:30", "10:30"], ["10:45", "11:45"], ["14:30", "15:30"], ["16:00", "17:00"]],
    full: [["08:30", "09:30"], ["09:45", "11:15"], ["11:30", "12:00"], ["14:00", "15:30"], ["15:45", "17:00"], ["20:00", "21:00"]],
  };
  const wake = pace === "full" ? "08:00" : pace === "balanced" ? "09:00" : "09:30";

  // 需要排的事，按优先级：重要紧急待办 → 本周任务 → 重要不紧急待办 → 其他待办
  const queue: Array<{ title: string; kind: RestItemKind; refId?: string }> = [
    ...ctx.todos.filter((t) => t.important && t.urgent).map((t) => ({ title: t.text, kind: "todo" as const, refId: t.id })),
    ...ctx.tasks.map((t) => ({ title: t.text, kind: "task" as const, refId: t.id })),
    ...ctx.todos.filter((t) => t.important && !t.urgent).map((t) => ({ title: t.text, kind: "todo" as const, refId: t.id })),
    ...ctx.todos.filter((t) => !t.important).map((t) => ({ title: t.text, kind: "todo" as const, refId: t.id })),
  ];
  const long = block.dates.length >= 3;

  return block.dates.map((date, dayIndex) => {
    const items: RestPlanItem[] = [];
    const add = (start: string, end: string | undefined, title: string, kind: RestItemKind, refId?: string) =>
      items.push({ id: uid(), start, ...(end ? { end } : {}), title, kind, ...(refId ? { refId } : {}) });

    add(wake, undefined, "起床 · 早餐", "life");
    add("12:00", "13:30", "午饭 · 午休", "rest");
    add("18:00", "19:00", "晚饭", "life");

    // 长假里每三天留一整天休息 / 出门
    const dayOff = long && dayIndex % 3 === 1;
    if (dayOff) {
      add("10:00", "17:00", "出门走走 / 见朋友，不安排任务", "rest");
    } else {
      const slots = [...slotsByPace[pace]];
      // 习惯：每天做（按每周目标天数，周末优先安排）
      for (const h of ctx.habits) {
        const slot = slots.shift();
        if (!slot) break;
        add(slot[0], slot[1], `${h.name} ${h.target}`, "habit", h.id);
      }
      if (ctx.reading[0] && slots.length) {
        const slot = slots.pop()!;
        add(slot[0], slot[1], `读《${ctx.reading[0].title}》`, "reading");
      }
      for (const slot of slots) {
        const next = queue.shift();
        if (!next) break;
        add(slot[0], slot[1], next.title, next.kind, next.refId);
      }
    }
    // 最后一天晚上：为回到工作日做准备
    if (dayIndex === block.dates.length - 1) add("21:00", "21:30", "整理下周要做的事", "life");
    add(dayIndex === block.dates.length - 1 ? "21:30" : "19:30", undefined, "自由时间", "rest");
    return { date, items: items.sort((a, b) => a.start.localeCompare(b.start)) };
  });
}

export async function generateRestPlan(block: RestBlock, pace: RestPlanPace, fixed: string): Promise<RestPlan> {
  const ctx = buildRestPlanContext();
  const now = new Date().toISOString();
  const base = { id: block.start, name: block.name, start: block.start, end: block.end, pace, fixed: fixed.trim(), createdAt: now, updatedAt: now };

  // 深度推理模型排长假可能要一两分钟；超过 150 秒就不等了，改用本地排法
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 150_000);
  try {
    const resp = await apiFetch("/api/rest-plan", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        block: {
          name: block.name,
          dates: block.dates.map((d) => ({ date: d, weekday: WEEKDAY_CN[parseISODate(d).getDay()] })),
        },
        pace,
        fixed: fixed.trim().slice(0, 500),
        context: ctx,
      }),
    });
    const json = (await resp.json()) as { available?: boolean; data?: { summary?: unknown; days?: unknown } | null };
    if (resp.ok && json.available && json.data) {
      const days = normalizeDays(block, json.data.days, ctx);
      if (days.some((d) => d.items.length > 0)) {
        return {
          ...base,
          days,
          summary: typeof json.data.summary === "string" ? json.data.summary.slice(0, 120) : undefined,
          source: "ai",
        };
      }
    }
  } catch {
    /* 网络问题或超时：退回本地排法 */
  } finally {
    window.clearTimeout(timer);
  }
  return {
    ...base,
    days: generateLocally(block, pace, ctx),
    summary: fixed.trim()
      ? "AI 暂时不可用，先按待办和习惯排了一份；已定的安排请手动加到对应时间。"
      : "AI 暂时不可用，先按你的待办和习惯排了一份，可以随时修改。",
    source: "local",
  };
}

// ── 修改 ────────────────────────────────────────────────────────────────────

export function saveRestPlan(plan: RestPlan) {
  // 只保留最近 12 份，避免越积越多
  const others = loadRestPlans().filter((p) => p.id !== plan.id);
  saveRestPlans([...others, plan].sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12));
}

function mutate(planId: string, fn: (plan: RestPlan) => void) {
  const plan = loadRestPlans().find((p) => p.id === planId);
  if (!plan) return;
  fn(plan);
  plan.updatedAt = new Date().toISOString();
  saveRestPlan(plan);
}

export function updateRestItem(planId: string, date: string, itemId: string, patch: Partial<Omit<RestPlanItem, "id">>) {
  mutate(planId, (plan) => {
    const day = plan.days.find((d) => d.date === date);
    const item = day?.items.find((i) => i.id === itemId);
    if (!day || !item) return;
    Object.assign(item, patch);
    if (patch.end === undefined && "end" in patch) delete item.end;
    day.items.sort((a, b) => a.start.localeCompare(b.start));
  });
}

export function removeRestItem(planId: string, date: string, itemId: string) {
  mutate(planId, (plan) => {
    const day = plan.days.find((d) => d.date === date);
    if (day) day.items = day.items.filter((i) => i.id !== itemId);
  });
}

export function addRestItem(planId: string, date: string, item: Omit<RestPlanItem, "id">) {
  mutate(planId, (plan) => {
    const day = plan.days.find((d) => d.date === date);
    if (!day) return;
    day.items.push({ ...item, id: uid() });
    day.items.sort((a, b) => a.start.localeCompare(b.start));
  });
}

/** 勾选完成；关联了待办 / 本周任务的，原条目也一起勾掉（取消勾选时一起恢复） */
export function toggleRestItem(planId: string, date: string, item: RestPlanItem) {
  const done = !item.done;
  updateRestItem(planId, date, item.id, { done });
  if (!item.refId) return;
  if (item.kind === "todo") {
    const todo = getTodos().find((t) => t.id === item.refId);
    if (todo && todo.done !== done) toggleTodo(todo.id);
  } else if (item.kind === "task") {
    const week = loadWeekPlan(currentWeekKey());
    const task = week?.tasks.find((t) => t.id === item.refId);
    if (week && task && task.done !== done) {
      saveWeekPlan({
        ...week,
        tasks: week.tasks.map((t) => (t.id === task.id ? { ...t, done, completedAt: done ? new Date().toISOString() : null } : t)),
      });
    }
  }
}

export function removeRestPlan(planId: string) {
  saveRestPlans(loadRestPlans().filter((p) => p.id !== planId));
}
