"use client";

import { useMemo, useSyncExternalStore } from "react";

import { ACCOUNT_STORAGE_EVENT } from "@/lib/account-storage";
import { getSettings, STORAGE_CHANGE_EVENT } from "@/lib/storage";
import { DEFAULT_SETTINGS } from "@/lib/supabase";

/**
 * 每周学习 / 阅读目标（小时），随设置变化实时更新。
 * 目标会跨设备同步（life-path-storage 的 prefs），新设备拉到云端的值后，用到它的地方自动刷新。
 */

function subscribe(cb: () => void) {
  window.addEventListener(STORAGE_CHANGE_EVENT, cb);
  window.addEventListener(ACCOUNT_STORAGE_EVENT, cb);
  return () => {
    window.removeEventListener(STORAGE_CHANGE_EVENT, cb);
    window.removeEventListener(ACCOUNT_STORAGE_EVENT, cb);
  };
}

function snapshot() {
  const s = getSettings();
  return `${s.weeklyStudyTarget}|${s.weeklyReadingTarget}`;
}

const SERVER = `${DEFAULT_SETTINGS.weeklyStudyTarget}|${DEFAULT_SETTINGS.weeklyReadingTarget}`;

export function useWeeklyTargets(): { weeklyStudyTarget: number; weeklyReadingTarget: number } {
  const raw = useSyncExternalStore(subscribe, snapshot, () => SERVER);
  return useMemo(() => {
    const [s, r] = raw.split("|").map(Number);
    return { weeklyStudyTarget: s, weeklyReadingTarget: r };
  }, [raw]);
}
