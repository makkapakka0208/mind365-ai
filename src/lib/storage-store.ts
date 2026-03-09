"use client";

import { useEffect, useSyncExternalStore } from "react";

import {
  getDailyLogs,
  getNotes,
  getQuotes,
  refreshDailyLogs,
  refreshNotes,
  refreshQuotes,
  STORAGE_CHANGE_EVENT,
  STORAGE_KEYS,
} from "@/lib/storage";
import type { DailyLog, Note, Quote } from "@/types";

type StoreCallback = () => void;

const EMPTY_DAILY_LOGS: DailyLog[] = [];
const EMPTY_QUOTES: Quote[] = [];
const EMPTY_NOTES: Note[] = [];

let hasRequestedInitialDailySync = false;
let hasRequestedInitialQuotesSync = false;
let hasRequestedInitialNotesSync = false;

let dailyLogsRawCache: string | null | undefined;
let quotesRawCache: string | null | undefined;
let notesRawCache: string | null | undefined;

let dailyLogsSnapshot: DailyLog[] = EMPTY_DAILY_LOGS;
let quotesSnapshot: Quote[] = EMPTY_QUOTES;
let notesSnapshot: Note[] = EMPTY_NOTES;

function subscribe(callback: StoreCallback) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const onChange = () => callback();

  window.addEventListener("storage", onChange);
  window.addEventListener(STORAGE_CHANGE_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onChange);
  };
}

function getDailyLogsSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_DAILY_LOGS;
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.dailyLogs);

  if (raw === dailyLogsRawCache) {
    return dailyLogsSnapshot;
  }

  dailyLogsRawCache = raw;
  dailyLogsSnapshot = raw ? getDailyLogs() : EMPTY_DAILY_LOGS;

  return dailyLogsSnapshot;
}

function getQuotesSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_QUOTES;
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.quotes);

  if (raw === quotesRawCache) {
    return quotesSnapshot;
  }

  quotesRawCache = raw;
  quotesSnapshot = raw ? getQuotes() : EMPTY_QUOTES;

  return quotesSnapshot;
}

function getNotesSnapshot() {
  if (typeof window === "undefined") {
    return EMPTY_NOTES;
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.notes);

  if (raw === notesRawCache) {
    return notesSnapshot;
  }

  notesRawCache = raw;
  notesSnapshot = raw ? getNotes() : EMPTY_NOTES;

  return notesSnapshot;
}

function getServerDailyLogsSnapshot() {
  return EMPTY_DAILY_LOGS;
}

function getServerQuotesSnapshot() {
  return EMPTY_QUOTES;
}

function getServerNotesSnapshot() {
  return EMPTY_NOTES;
}

export function useDailyLogsStore(): DailyLog[] {
  const snapshot = useSyncExternalStore(subscribe, getDailyLogsSnapshot, getServerDailyLogsSnapshot);

  useEffect(() => {
    if (hasRequestedInitialDailySync) {
      return;
    }

    hasRequestedInitialDailySync = true;
    void refreshDailyLogs();
  }, []);

  return snapshot;
}

export function useQuotesStore(): Quote[] {
  const snapshot = useSyncExternalStore(subscribe, getQuotesSnapshot, getServerQuotesSnapshot);

  useEffect(() => {
    if (hasRequestedInitialQuotesSync) {
      return;
    }

    hasRequestedInitialQuotesSync = true;
    void refreshQuotes();
  }, []);

  return snapshot;
}

export function useNotesStore(): Note[] {
  const snapshot = useSyncExternalStore(subscribe, getNotesSnapshot, getServerNotesSnapshot);

  useEffect(() => {
    if (hasRequestedInitialNotesSync) {
      return;
    }

    hasRequestedInitialNotesSync = true;
    void refreshNotes();
  }, []);

  return snapshot;
}