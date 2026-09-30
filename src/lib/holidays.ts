"use client";

import { useEffect, useSyncExternalStore } from "react";

import { getTodayISODate, parseISODate, toISODate } from "@/lib/date";

/**
 * 中国法定节假日与调休。
 * 数据来自开源项目 holiday-cn（NateScarlet/holiday-cn，随国务院每年的放假通知更新），
 * 经 jsDelivr 获取，按年缓存在本机；取不到时退回「周六日休息」。
 * isOffDay=true 为放假，false 为调休上班（落在周末也要上班）。
 */

interface HolidayDay {
  name: string;
  isOffDay: boolean;
}

const CACHE_PREFIX = "mind365:holiday-cn:";
const CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
const EVENT = "mind365:holidays";

const memory = new Map<number, Record<string, HolidayDay>>();
const inflight = new Set<number>();
let version = 0;

function readCache(year: number): { fetchedAt: number; days: Record<string, HolidayDay> } | null {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + year);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function loadYear(year: number) {
  if (inflight.has(year)) return;
  const cached = readCache(year);
  if (cached) {
    memory.set(year, cached.days);
    if (Date.now() - cached.fetchedAt < CACHE_TTL_MS) return;
  }
  inflight.add(year);
  try {
    const resp = await fetch(`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${year}.json`, { cache: "no-cache" });
    if (!resp.ok) return; // 下一年的数据通常要到当年 11 月前后才公布，取不到是正常的
    const json = (await resp.json()) as { days?: Array<{ name: string; date: string; isOffDay: boolean }> };
    const days: Record<string, HolidayDay> = {};
    for (const d of json.days ?? []) days[d.date] = { name: d.name, isOffDay: d.isOffDay };
    memory.set(year, days);
    try {
      window.localStorage.setItem(CACHE_PREFIX + year, JSON.stringify({ fetchedAt: Date.now(), days }));
    } catch {
      /* 本机存储满了也不影响使用 */
    }
  } catch {
    /* 离线：沿用缓存或只按周末算 */
  } finally {
    inflight.delete(year);
    version++;
    window.dispatchEvent(new Event(EVENT));
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** 返回节假日数据的版本号（数据加载完成后变化，用来触发重算）；首次使用时自动加载今年和明年 */
export function useHolidayVersion(): number {
  useEffect(() => {
    const year = new Date().getFullYear();
    void loadYear(year);
    void loadYear(year + 1);
  }, []);
  return useSyncExternalStore(subscribe, () => version, () => 0);
}

function lookup(date: string): HolidayDay | undefined {
  return memory.get(Number(date.slice(0, 4)))?.[date];
}

/** 这一天休不休息：官方数据优先（含调休），否则周六日休息 */
export function isOffDay(date: string): boolean {
  const h = lookup(date);
  if (h) return h.isOffDay;
  const day = parseISODate(date).getDay();
  return day === 0 || day === 6;
}

function shift(date: string, days: number) {
  const d = parseISODate(date);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export interface RestBlock {
  /** 第一天 / 最后一天（yyyy-MM-dd） */
  start: string;
  end: string;
  dates: string[];
  /** 节日名（如「国庆节」），普通周末为「周末」 */
  name: string;
  /** 距离开始还有几天：0 = 今天就在休息 */
  startsIn: number;
}

/** 今天所在的、或接下来最近的一段连续休息日（最多往后找 21 天） */
export function findRestBlock(today = getTodayISODate()): RestBlock | null {
  let start: string | null = null;
  if (isOffDay(today)) {
    start = today;
    while (isOffDay(shift(start, -1))) start = shift(start, -1);
  } else {
    for (let i = 1; i <= 21; i++) {
      const d = shift(today, i);
      if (isOffDay(d)) {
        start = d;
        break;
      }
    }
  }
  if (!start) return null;

  const dates = [start];
  while (dates.length < 16 && isOffDay(shift(dates[dates.length - 1], 1))) dates.push(shift(dates[dates.length - 1], 1));

  // 节日名：取这段日子里出现的法定节日（中秋、国庆连在一起时会是「中秋节 · 国庆节」）
  const names = [...new Set(dates.map((d) => lookup(d)).filter((h): h is HolidayDay => !!h && h.isOffDay).map((h) => h.name))];
  const startsIn = Math.round((parseISODate(start).getTime() - parseISODate(today).getTime()) / 86400000);
  return { start, end: dates[dates.length - 1], dates, name: names.length ? names.join(" · ") : "周末", startsIn: Math.max(0, startsIn) };
}

/** 首页是否显示：休息日当天，或休息日的前一天（比如周五、节前最后一个工作日） */
export function isRestSeason(block: RestBlock | null): boolean {
  return !!block && block.startsIn <= 1;
}
