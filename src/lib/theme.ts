"use client";

/**
 * 三态主题：浅色 / 深色 / 跟随系统。
 * 解析结果通过 html[data-theme="dark"] 生效（浅色不加属性），
 * layout.tsx 里有一段同逻辑的内联脚本负责首屏防闪烁。
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "mind365-theme";
export const THEME_CHANGE_EVENT = "mind365:theme-changed";

const DARK_META_COLOR = "#1b140e";
const LIGHT_META_COLOR = "#8B5E3C";

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
  return raw === "light" || raw === "dark" ? raw : "system";
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

function applyResolvedTheme(resolved: "light" | "dark") {
  const root = document.documentElement;
  if (resolved === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? DARK_META_COLOR : LIGHT_META_COLOR);
}

export function setThemePreference(pref: ThemePreference) {
  if (typeof window === "undefined") return;
  if (pref === "system") {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  }
  applyResolvedTheme(resolveTheme(pref));
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** 跟随系统时响应系统切换。模块加载即注册（仅浏览器）。 */
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getThemePreference() === "system") {
        applyResolvedTheme(resolveTheme("system"));
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }
    });
}
