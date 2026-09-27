"use client";

/**
 * 主题偏好：浅色 / 深色 / 跟随系统，外加
 * - 质感主题（灰泥 / 铜绿）：html[data-skin]，纹理 + 毛玻璃 + 衬线复古排版（skins.css）；铜绿同时是深色，复用深色覆盖。
 * - 清新主题（天蓝 / 卡通）：html[data-tint]，浅色，只换配色和花纹背景（tints.css）。
 * 明暗通过 html[data-theme="dark"] 生效（浅色不加属性）。未设置时默认灰泥。
 * layout.tsx 里有一段同逻辑的内联脚本负责首屏防闪烁。
 */

export type ThemeSkin = "plaster" | "patina";
export type ThemeTint = "sky" | "sakura";
export type ThemePreference = "light" | "dark" | "system" | ThemeSkin | ThemeTint;

const SKINS: ThemeSkin[] = ["plaster", "patina"];
const TINTS: ThemeTint[] = ["sky", "sakura"];

export const THEME_STORAGE_KEY = "mind365-theme";
export const THEME_CHANGE_EVENT = "mind365:theme-changed";

const DARK_META_COLOR = "#1b140e";
const LIGHT_META_COLOR = "#8B5E3C";
const STYLED_META_COLOR: Record<ThemeSkin | ThemeTint, string> = {
  plaster: "#ece8df",
  patina: "#1f2b2c",
  sky: "#b9d9f5",
  sakura: "#f5e6e9",
};

const STORED_PREFS: ThemePreference[] = ["light", "dark", "system", ...SKINS, ...TINTS];

/** 没有保存过偏好时的默认主题（layout.tsx 首屏脚本里同步写死了一份）。 */
export const DEFAULT_THEME: ThemePreference = "plaster";

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const raw = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
  return raw && STORED_PREFS.includes(raw) ? raw : DEFAULT_THEME;
}

function systemPrefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  if (pref === "dark" || pref === "patina") return "dark";
  return "light";
}

function applyTheme(pref: ThemePreference) {
  const resolved = resolveTheme(pref);
  const skin = (SKINS as string[]).includes(pref) ? (pref as ThemeSkin) : null;
  const tint = (TINTS as string[]).includes(pref) ? (pref as ThemeTint) : null;
  const root = document.documentElement;
  if (resolved === "dark") {
    root.setAttribute("data-theme", "dark");
  } else {
    root.removeAttribute("data-theme");
  }
  if (skin) {
    root.setAttribute("data-skin", skin);
  } else {
    root.removeAttribute("data-skin");
  }
  if (tint) {
    root.setAttribute("data-tint", tint);
  } else {
    root.removeAttribute("data-tint");
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    const styled = skin ?? tint;
    const color = styled ? STYLED_META_COLOR[styled] : resolved === "dark" ? DARK_META_COLOR : LIGHT_META_COLOR;
    meta.setAttribute("content", color);
  }
}

export function setThemePreference(pref: ThemePreference) {
  if (typeof window === "undefined") return;
  // 「跟随系统」也显式保存：未保存时走 DEFAULT_THEME（灰泥），两者需要区分
  window.localStorage.setItem(THEME_STORAGE_KEY, pref);
  applyTheme(pref);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** 跟随系统时响应系统切换。模块加载即注册（仅浏览器）。 */
if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getThemePreference() === "system") {
        applyTheme("system");
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
      }
    });
}
