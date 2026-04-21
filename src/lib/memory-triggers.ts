import { parseISODate, toISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

export type MemoryTriggerType =
  | "on_this_day"
  | "mood_echo"
  | "long_forgotten"
  | "tag_resonance";

export type MemoryCard = {
  entry: DailyLog;
  trigger: {
    type: MemoryTriggerType;
    label: string;
    subLabel?: string;
  };
};

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDateCN(dateStr: string): string {
  const d = parseISODate(dateStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 · ${WEEKDAYS[d.getDay()]}`;
}

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toISODate(d);
}

/** 触发器：一年前的今天 — 同月同日，按年份远近排序，取最近一年 */
export function pickOnThisDay(logs: DailyLog[]): MemoryCard | null {
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const todayIso = toISODate(today);

  const matched = logs
    .filter((entry) => {
      if (entry.date >= todayIso) return false;
      const d = parseISODate(entry.date);
      return d.getMonth() + 1 === month && d.getDate() === day;
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (matched.length === 0) return null;

  const picked = matched[0];
  const yearsAgo = today.getFullYear() - parseISODate(picked.date).getFullYear();
  return {
    entry: picked,
    trigger: {
      type: "on_this_day",
      label: yearsAgo <= 1 ? "一年前的今天" : `${yearsAgo} 年前的今天`,
      subLabel: formatDateCN(picked.date),
    },
  };
}

/** 触发器：心情回响 — ±1 范围内、排除最近 7 天，随机一条 */
export function pickMoodEcho(
  logs: DailyLog[],
  todayMood: number,
): MemoryCard | null {
  const cutoff = daysAgoIso(7);

  const matched = logs.filter(
    (entry) =>
      entry.date < cutoff &&
      entry.mood >= todayMood - 1 &&
      entry.mood <= todayMood + 1,
  );

  const picked = pickRandom(matched);
  if (!picked) return null;

  return {
    entry: picked,
    trigger: {
      type: "mood_echo",
      label: "和今天心情相似的日子",
      subLabel: `${formatDateCN(picked.date)} · 情绪 ${picked.mood}/10`,
    },
  };
}

/** 触发器：很久没回看 — 至少 30 天前，随机一条 */
export function pickLongForgotten(logs: DailyLog[]): MemoryCard | null {
  const cutoff = daysAgoIso(30);

  const matched = logs.filter((entry) => entry.date < cutoff);
  const picked = pickRandom(matched);
  if (!picked) return null;

  return {
    entry: picked,
    trigger: {
      type: "long_forgotten",
      label: "很久没回看的日记",
      subLabel: formatDateCN(picked.date),
    },
  };
}

/** 触发器：标签共振 — 最近一条的首个标签，在历史里出现的，随机一条 */
export function pickTagResonance(
  logs: DailyLog[],
  recentTag: string | null,
  excludeId?: string,
): MemoryCard | null {
  if (!recentTag) return null;
  const cutoff = daysAgoIso(7);

  const matched = logs.filter(
    (entry) =>
      entry.id !== excludeId &&
      entry.date < cutoff &&
      entry.tags.includes(recentTag),
  );

  const picked = pickRandom(matched);
  if (!picked) return null;

  return {
    entry: picked,
    trigger: {
      type: "tag_resonance",
      label: `这个标签你也写过 · #${recentTag}`,
      subLabel: formatDateCN(picked.date),
    },
  };
}

/**
 * 聚合：并行执行四个触发器，返回有结果的卡片（最多 4 张）。
 * mood_echo 和 tag_resonance 以"最近一条日记"为种子；若没有任何日记，返回空数组。
 */
export function buildMemoryCards(logs: DailyLog[]): MemoryCard[] {
  if (logs.length === 0) return [];

  const sortedDesc = [...logs].sort((a, b) => (a.date < b.date ? 1 : -1));
  const latest = sortedDesc[0];
  const todayMood = latest.mood;
  const recentTag = latest.tags[0] ?? null;

  const cards: (MemoryCard | null)[] = [
    pickOnThisDay(logs),
    pickMoodEcho(logs, todayMood),
    pickLongForgotten(logs),
    pickTagResonance(logs, recentTag, latest.id),
  ];

  return cards.filter((c): c is MemoryCard => c !== null).slice(0, 4);
}
