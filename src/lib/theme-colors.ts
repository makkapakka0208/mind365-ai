"use client";

import { useMemo, useSyncExternalStore } from "react";

import { THEME_CHANGE_EVENT } from "@/lib/theme";

/**
 * 把当前主题的 CSS 变量读成具体颜色，给 Chart.js 这类不能直接用 var() 的地方。
 * 切换主题（setThemePreference 会派发 THEME_CHANGE_EVENT）后自动重读。
 */

const VARS = ["--v5-accent-rgb", "--v5-ink-rgb", "--v5-ink", "--v5-ink2", "--v5-ink3", "--v5-surface", "--v5-rule"] as const;

function subscribe(cb: () => void) {
  window.addEventListener(THEME_CHANGE_EVENT, cb);
  return () => window.removeEventListener(THEME_CHANGE_EVENT, cb);
}

function snapshot() {
  const style = getComputedStyle(document.documentElement);
  return VARS.map((v) => style.getPropertyValue(v).trim()).join("|");
}

function readTint() {
  return document.documentElement.getAttribute("data-tint") ?? "";
}

/** 当前清新主题（"sky" | "sakura"），不是清新主题时为空串 */
export function useThemeTint(): string {
  return useSyncExternalStore(subscribe, readTint, () => "");
}

export interface ThemeColors {
  /** 强调色，按透明度取 */
  accent: (alpha?: number) => string;
  /** 正文色通道，按透明度取（网格线、空状态等） */
  inkA: (alpha: number) => string;
  ink: string;
  ink2: string;
  ink3: string;
  surface: string;
  rule: string;
}

export function useThemeColors(): ThemeColors {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  return useMemo(() => {
    const [accentRgb, inkRgb, ink, ink2, ink3, surface, rule] = raw ? raw.split("|") : [];
    const a = accentRgb || "139, 94, 60";
    const i = inkRgb || "60, 50, 35";
    return {
      accent: (alpha = 1) => `rgba(${a}, ${alpha})`,
      inkA: (alpha) => `rgba(${i}, ${alpha})`,
      ink: ink || "#2a241d",
      ink2: ink2 || "#564b3e",
      ink3: ink3 || "#857865",
      surface: surface || "#ffffff",
      rule: rule || "rgba(60, 50, 35, 0.12)",
    };
  }, [raw]);
}
