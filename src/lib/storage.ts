import type { DailyLog, Note, Quote } from "@/types";

export const STORAGE_KEYS = {
  dailyLogs: "daily_logs",
  quotes: "quotes",
  notes: "notes",
  settings: "settings",
} as const;

export const STORAGE_CHANGE_EVENT = "mind365:storage";

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export interface Mind365BackupData {
  daily_logs: DailyLog[];
  quotes: Quote[];
  notes: Note[];
  settings: unknown;
}

export interface BackupImportResult {
  dailyLogs: number;
  quotes: number;
  notes: number;
}

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function parseDailyLog(value: unknown): DailyLog | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.date !== "string" ||
    typeof value.mood !== "number" ||
    !Number.isFinite(value.mood) ||
    typeof value.thoughts !== "string" ||
    typeof value.reading !== "string" ||
    typeof value.studyHours !== "number" ||
    !Number.isFinite(value.studyHours) ||
    !isStringArray(value.tags)
  ) {
    return null;
  }

  const createdAt =
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
      ? value.createdAt
      : Number.isFinite(Date.parse(`${value.date}T00:00:00`))
        ? new Date(`${value.date}T00:00:00`).toISOString()
        : new Date().toISOString();

  return {
    id: typeof value.id === "string" && value.id.trim().length > 0 ? value.id : createId(),
    createdAt,
    date: value.date,
    mood: value.mood,
    thoughts: value.thoughts,
    reading: value.reading,
    studyHours: value.studyHours,
    tags: value.tags,
  };
}

function normalizeDailyLogs(values: unknown): DailyLog[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const dedupe = new Set<string>();

  return values
    .map(parseDailyLog)
    .filter((log): log is DailyLog => log !== null)
    .map((log) => {
      if (!dedupe.has(log.id)) {
        dedupe.add(log.id);
        return log;
      }

      const nextId = createId();
      dedupe.add(nextId);

      return {
        ...log,
        id: nextId,
      };
    });
}

function isQuote(value: unknown): value is Quote {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.author === "string" &&
    typeof value.book === "string" &&
    isStringArray(value.tags)
  );
}

function isNote(value: unknown): value is Note {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    isStringArray(value.tags)
  );
}

function normalizeCollection<T>(values: unknown, guard: (value: unknown) => value is T): T[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.filter(guard);
}

function readCollection<T>(key: StorageKey, guard: (value: unknown) => value is T): T[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeCollection(parsed, guard);
  } catch {
    return [];
  }
}

function readDailyLogs(): DailyLog[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.dailyLogs);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return normalizeDailyLogs(parsed);
  } catch {
    return [];
  }
}

function writeCollection<T>(key: StorageKey, data: T[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
}

function readSettingsValue(): unknown {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.settings);

  if (raw === null) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export function getDailyLogs(): DailyLog[] {
  return readDailyLogs();
}

export function setDailyLogs(logs: DailyLog[]) {
  writeCollection(STORAGE_KEYS.dailyLogs, logs);
}

export function saveDailyLog(log: DailyLog): DailyLog[] {
  const logs = getDailyLogs();
  const normalized: DailyLog = {
    ...log,
    id: log.id || createId(),
    createdAt: log.createdAt || new Date().toISOString(),
  };
  const updated = [normalized, ...logs];
  setDailyLogs(updated);
  return updated;
}

export function updateDailyLog(nextLog: DailyLog): DailyLog[] {
  const logs = getDailyLogs();
  const updated = logs.map((log) => (log.id === nextLog.id ? nextLog : log));
  setDailyLogs(updated);
  return updated;
}

export function getQuotes(): Quote[] {
  return readCollection(STORAGE_KEYS.quotes, isQuote);
}

export function setQuotes(quotes: Quote[]) {
  writeCollection(STORAGE_KEYS.quotes, quotes);
}

export function saveQuote(quote: Quote): Quote[] {
  const quotes = getQuotes();
  const updated = [quote, ...quotes];
  setQuotes(updated);
  return updated;
}

export function getNotes(): Note[] {
  return readCollection(STORAGE_KEYS.notes, isNote);
}

export function setNotes(notes: Note[]) {
  writeCollection(STORAGE_KEYS.notes, notes);
}

export function saveNote(note: Note): Note[] {
  const notes = getNotes();
  const updated = [note, ...notes];
  setNotes(updated);
  return updated;
}

export function getMind365BackupData(): Mind365BackupData {
  return {
    daily_logs: getDailyLogs(),
    quotes: getQuotes(),
    notes: getNotes(),
    settings: readSettingsValue(),
  };
}

export function downloadMind365Backup(filename = "mind365-backup.json") {
  if (typeof window === "undefined") {
    return;
  }

  const json = JSON.stringify(getMind365BackupData(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function importMind365Backup(raw: string): BackupImportResult {
  if (typeof window === "undefined") {
    throw new Error("Import is only available in browser.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Invalid JSON file.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Invalid backup format.");
  }

  const dailyLogs = normalizeDailyLogs(parsed.daily_logs);
  const quotes = normalizeCollection(parsed.quotes, isQuote);
  const notes = normalizeCollection(parsed.notes, isNote);
  const hasSettings = Object.prototype.hasOwnProperty.call(parsed, "settings");

  window.localStorage.setItem(STORAGE_KEYS.dailyLogs, JSON.stringify(dailyLogs));
  window.localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(quotes));
  window.localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));

  if (!hasSettings || parsed.settings === null || parsed.settings === undefined) {
    window.localStorage.removeItem(STORAGE_KEYS.settings);
  } else if (typeof parsed.settings === "string") {
    try {
      JSON.parse(parsed.settings);
      window.localStorage.setItem(STORAGE_KEYS.settings, parsed.settings);
    } catch {
      window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(parsed.settings));
    }
  } else {
    window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(parsed.settings));
  }

  window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));

  return {
    dailyLogs: dailyLogs.length,
    quotes: quotes.length,
    notes: notes.length,
  };
}