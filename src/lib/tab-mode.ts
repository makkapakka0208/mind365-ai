"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * "Tab 四" mode — controls whether the 4th mobile tab is 灵感书库 (library)
 * or 人生主线 (life path). Persisted in localStorage, reactive across tabs
 * and within the same tab via a custom event.
 */

const KEY = "mind365_tab_mode";
const EVENT = "mind365:tab-mode";

export type TabMode = "library" | "lifepath";

export function getTabMode(): TabMode {
  if (typeof window === "undefined") return "library";
  try {
    return window.localStorage.getItem(KEY) === "lifepath" ? "lifepath" : "library";
  } catch {
    return "library";
  }
}

export function setTabMode(mode: TabMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, mode);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function toggleTabMode(): TabMode {
  const next: TabMode = getTabMode() === "library" ? "lifepath" : "library";
  setTabMode(next);
  return next;
}

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENT, callback);
  };
}

/** Reactive hook returning the current tab mode. */
export function useTabMode(): TabMode {
  const mode = useSyncExternalStore(subscribe, getTabMode, () => "library" as TabMode);
  // Touch effect so SSR/CSR hydration stays consistent.
  useEffect(() => {}, []);
  return mode;
}
