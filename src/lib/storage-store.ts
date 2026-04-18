"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import {
  getDailyLogs,
  getNotes,
  getQuotes,
  getReviewReports,
  refreshDailyLogs,
  refreshNotes,
  refreshQuotes,
  refreshReviewReports,
  STORAGE_CHANGE_EVENT,
  STORAGE_KEYS,
} from "@/lib/storage";
import type { DailyLog, Note, Quote, ReviewReport } from "@/types";

type StoreCallback = () => void;

const EMPTY_DAILY_LOGS: DailyLog[] = [];
const EMPTY_QUOTES: Quote[] = [];
const EMPTY_NOTES: Note[] = [];
const EMPTY_REVIEW_REPORTS: ReviewReport[] = [];

let hasRequestedInitialDailySync = false;
let hasRequestedInitialQuotesSync = false;
let hasRequestedInitialNotesSync = false;
let hasRequestedInitialReviewSync = false;

let dailyLogsRawCache: string | null | undefined;
let quotesRawCache: string | null | undefined;
let notesRawCache: string | null | undefined;
let reviewReportsRawCache: string | null | undefined;

let dailyLogsSnapshot: DailyLog[] = EMPTY_DAILY_LOGS;
let quotesSnapshot: Quote[] = EMPTY_QUOTES;
let notesSnapshot: Note[] = EMPTY_NOTES;
let reviewReportsSnapshot: ReviewReport[] = EMPTY_REVIEW_REPORTS;

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

export function useReviewReportsStore(): ReviewReport[] {
  const snapshot = useSyncExternalStore(subscribe, getReviewReportsSnapshot, () => EMPTY_REVIEW_REPORTS);
  useEffect(() => {
    if (hasRequestedInitialReviewSync) return;
    hasRequestedInitialReviewSync = true;
    void refreshReviewReports();
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
