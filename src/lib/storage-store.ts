"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { AUTH_CHANGE_EVENT } from "@/lib/auth";
import {
  getDailyLogs,
  getNotes,
  getQuotes,
  getReviewReports,
  getTimeEntries,
  getTodos,
  refreshDailyLogs,
  refreshNotes,
  refreshQuotes,
  refreshReviewReports,
  refreshTimeEntries,
  refreshTodos,
  STORAGE_CHANGE_EVENT,
  STORAGE_KEYS,
} from "@/lib/storage";
import type { DailyLog, Note, Quote, ReviewReport, TimeEntry, TodoItem } from "@/types";

type StoreCallback = () => void;

const EMPTY_DAILY_LOGS: DailyLog[] = [];
const EMPTY_QUOTES: Quote[] = [];
const EMPTY_NOTES: Note[] = [];
const EMPTY_REVIEW_REPORTS: ReviewReport[] = [];
const EMPTY_TIME_ENTRIES: TimeEntry[] = [];
const EMPTY_TODOS: TodoItem[] = [];

let hasRequestedInitialDailySync = false;
let hasRequestedInitialQuotesSync = false;
let hasRequestedInitialNotesSync = false;
let hasRequestedInitialReviewSync = false;
let hasRequestedInitialTimeEntriesSync = false;
let hasRequestedInitialTodosSync = false;

let dailyLogsRawCache: string | null | undefined;
let quotesRawCache: string | null | undefined;
let notesRawCache: string | null | undefined;
let reviewReportsRawCache: string | null | undefined;
let timeEntriesRawCache: string | null | undefined;
let todosRawCache: string | null | undefined;

let dailyLogsSnapshot: DailyLog[] = EMPTY_DAILY_LOGS;
let quotesSnapshot: Quote[] = EMPTY_QUOTES;
let notesSnapshot: Note[] = EMPTY_NOTES;
let reviewReportsSnapshot: ReviewReport[] = EMPTY_REVIEW_REPORTS;
let timeEntriesSnapshot: TimeEntry[] = EMPTY_TIME_ENTRIES;
let todosSnapshot: TodoItem[] = EMPTY_TODOS;

// 登录/登出后重新拉一次全量同步：初始同步可能发生在会话恢复之前，
// 没有这一步的话登录后要等下次手动刷新才能看到云端数据。
if (typeof window !== "undefined") {
  window.addEventListener(AUTH_CHANGE_EVENT, () => {
    void refreshDailyLogs({ force: true });
    void refreshQuotes();
    void refreshNotes();
    void refreshReviewReports();
    void refreshTimeEntries();
    void refreshTodos();
  });
}

function subscribe(callback: StoreCallback) {
  if (typeof window === "undefined") return () => undefined;
  const onChange = () => callback();
  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onChange);
  };
}

function getDailyLogsSnapshot() {
  if (typeof window === "undefined") return EMPTY_DAILY_LOGS;
  const raw = window.localStorage.getItem(STORAGE_KEYS.dailyLogs);
  if (raw === dailyLogsRawCache) return dailyLogsSnapshot;
  dailyLogsRawCache = raw;
  dailyLogsSnapshot = raw ? getDailyLogs() : EMPTY_DAILY_LOGS;
  return dailyLogsSnapshot;
}

function getQuotesSnapshot() {
  if (typeof window === "undefined") return EMPTY_QUOTES;
  const raw = window.localStorage.getItem(STORAGE_KEYS.quotes);
  if (raw === quotesRawCache) return quotesSnapshot;
  quotesRawCache = raw;
  quotesSnapshot = raw ? getQuotes() : EMPTY_QUOTES;
  return quotesSnapshot;
}

function getNotesSnapshot() {
  if (typeof window === "undefined") return EMPTY_NOTES;
  const raw = window.localStorage.getItem(STORAGE_KEYS.notes);
  if (raw === notesRawCache) return notesSnapshot;
  notesRawCache = raw;
  notesSnapshot = raw ? getNotes() : EMPTY_NOTES;
  return notesSnapshot;
}

function getReviewReportsSnapshot() {
  if (typeof window === "undefined") return EMPTY_REVIEW_REPORTS;
  const raw = window.localStorage.getItem(STORAGE_KEYS.reviewReports);
  if (raw === reviewReportsRawCache) return reviewReportsSnapshot;
  reviewReportsRawCache = raw;
  reviewReportsSnapshot = raw ? getReviewReports() : EMPTY_REVIEW_REPORTS;
  return reviewReportsSnapshot;
}

function getTimeEntriesSnapshot() {
  if (typeof window === "undefined") return EMPTY_TIME_ENTRIES;
  const raw = window.localStorage.getItem(STORAGE_KEYS.timeEntries);
  if (raw === timeEntriesRawCache) return timeEntriesSnapshot;
  timeEntriesRawCache = raw;
  timeEntriesSnapshot = raw ? getTimeEntries() : EMPTY_TIME_ENTRIES;
  return timeEntriesSnapshot;
}

function getTodosSnapshot() {
  if (typeof window === "undefined") return EMPTY_TODOS;
  const raw = window.localStorage.getItem(STORAGE_KEYS.todos);
  if (raw === todosRawCache) return todosSnapshot;
  todosRawCache = raw;
  todosSnapshot = raw ? getTodos() : EMPTY_TODOS;
  return todosSnapshot;
}

export function useDailyLogsStore(): DailyLog[] {
  const snapshot = useSyncExternalStore(subscribe, getDailyLogsSnapshot, () => EMPTY_DAILY_LOGS);
  useEffect(() => {
    if (hasRequestedInitialDailySync) return;
    hasRequestedInitialDailySync = true;
    void refreshDailyLogs();
  }, []);
  return snapshot;
}

export function useQuotesStore(): Quote[] {
  const snapshot = useSyncExternalStore(subscribe, getQuotesSnapshot, () => EMPTY_QUOTES);
  useEffect(() => {
    if (hasRequestedInitialQuotesSync) return;
    hasRequestedInitialQuotesSync = true;
    void refreshQuotes();
  }, []);
  return snapshot;
}

export function useNotesStore(): Note[] {
  const snapshot = useSyncExternalStore(subscribe, getNotesSnapshot, () => EMPTY_NOTES);
  useEffect(() => {
    if (hasRequestedInitialNotesSync) return;
    hasRequestedInitialNotesSync = true;
    void refreshNotes();
  }, []);
  return snapshot;
}

export function useTodosStore(): TodoItem[] {
  const snapshot = useSyncExternalStore(subscribe, getTodosSnapshot, () => EMPTY_TODOS);
  useEffect(() => {
    if (hasRequestedInitialTodosSync) return;
    hasRequestedInitialTodosSync = true;
    void refreshTodos();
  }, []);
  return snapshot;
}

export function useReviewReportsStore(): ReviewReport[] {
  const snapshot = useSyncExternalStore(subscribe, getReviewReportsSnapshot, () => EMPTY_REVIEW_REPORTS);
  useEffect(() => {
    if (hasRequestedInitialReviewSync) return;
    hasRequestedInitialReviewSync = true;
    void refreshReviewReports();
  }, []);
  return snapshot;
}

export function useTimeEntriesStore(): TimeEntry[] {
  const snapshot = useSyncExternalStore(subscribe, getTimeEntriesSnapshot, () => EMPTY_TIME_ENTRIES);
  useEffect(() => {
    if (hasRequestedInitialTimeEntriesSync) return;
    hasRequestedInitialTimeEntriesSync = true;
    void refreshTimeEntries();
  }, []);
  return snapshot;
}

/**
 * 强制拉一次云端日记数据，返回 { logs, isSyncing }。
 * 用于复盘页等需要确保数据最新的场景。
 */
export function useSyncedDailyLogs(): { logs: DailyLog[]; isSyncing: boolean } {
  const logs = useSyncExternalStore(subscribe, getDailyLogsSnapshot, () => EMPTY_DAILY_LOGS);
  const [isSyncing, setIsSyncing] = useState(true);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (hasSynced.current) return;
    hasSynced.current = true;
    refreshDailyLogs({ force: true }).finally(() => setIsSyncing(false));
  }, []);

  return { logs, isSyncing };
}
