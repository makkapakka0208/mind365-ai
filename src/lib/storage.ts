import {
  createDefaultSupabaseUserId,
  createMind365SupabaseClient,
  DEFAULT_SETTINGS,
  getSupabaseConfig,
  normalizeMind365Settings,
} from "@/lib/supabase";
import type { DailyLog, Mind365Settings, Note, Quote } from "@/types";

export const STORAGE_KEYS = {
  dailyLogs: "daily_logs",
  quotes: "quotes",
  notes: "notes",
  settings: "settings",
} as const;

export const STORAGE_CHANGE_EVENT = "mind365:storage";

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

interface SupabaseDiaryRow {
  ai_analysis: string | null;
  content: string;
  created_at: string;
  id: string;
  user_id: string;
}

export interface Mind365BackupData {
  daily_logs: DailyLog[];
  quotes: Quote[];
  notes: Note[];
  settings: Mind365Settings;
}

export interface BackupImportResult {
  dailyLogs: number;
  notes: number;
  quotes: number;
}

export interface DailyLogMutationResult {
  logs: DailyLog[];
  synced: boolean;
}

export interface CloudSyncStatus {
  configured: boolean;
  enabled: boolean;
  message: string;
  userId: string;
}

let refreshPromise: Promise<DailyLog[]> | null = null;
let refreshSignature = "";

function dispatchStorageChange() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
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
    })
    .sort((left, right) => {
      if (left.date === right.date) {
        if (left.createdAt === right.createdAt) {
          return right.id.localeCompare(left.id);
        }

        return right.createdAt.localeCompare(left.createdAt);
      }

      return right.date.localeCompare(left.date);
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
  dispatchStorageChange();
}

function readSettingsValue(): unknown {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }

  const raw = window.localStorage.getItem(STORAGE_KEYS.settings);

  if (raw === null) {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function writeSettings(settings: Mind365Settings) {
  if (typeof window === "undefined") {
    return settings;
  }

  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  dispatchStorageChange();
  return settings;
}

function ensureSettingsUserId(settings: Mind365Settings): Mind365Settings {
  if (settings.supabaseUserId.trim()) {
    return settings;
  }

  const nextSettings: Mind365Settings = {
    ...settings,
    supabaseUserId: createDefaultSupabaseUserId(),
  };

  writeSettings(nextSettings);
  return nextSettings;
}

function serializeDailyLog(log: DailyLog): string {
  return JSON.stringify({
    createdAt: log.createdAt,
    date: log.date,
    mood: log.mood,
    reading: log.reading,
    studyHours: log.studyHours,
    tags: log.tags,
    thoughts: log.thoughts,
    version: 2,
  });
}

function parseDiaryRow(row: SupabaseDiaryRow): DailyLog | null {
  const fallbackDate = Number.isFinite(Date.parse(row.created_at))
    ? new Date(row.created_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  try {
    const parsed = JSON.parse(row.content) as unknown;
    const candidate = parseDailyLog({
      ...(isRecord(parsed) ? parsed : {}),
      id: row.id,
      createdAt: isRecord(parsed) && typeof parsed.createdAt === "string" ? parsed.createdAt : row.created_at,
      date: isRecord(parsed) && typeof parsed.date === "string" ? parsed.date : fallbackDate,
    });

    if (candidate) {
      return candidate;
    }
  } catch {
    // Fallback to plain text content from older rows.
  }

  return parseDailyLog({
    id: row.id,
    createdAt: row.created_at,
    date: fallbackDate,
    mood: 5,
    thoughts: row.content,
    reading: "",
    studyHours: 0,
    tags: [],
  });
}

function mergeDailyLogs(localLogs: DailyLog[], remoteLogs: DailyLog[]): DailyLog[] {
  const merged = new Map<string, DailyLog>();

  for (const log of remoteLogs) {
    merged.set(log.id, log);
  }

  for (const log of localLogs) {
    merged.set(log.id, log);
  }

  return normalizeDailyLogs([...merged.values()]);
}

function areDailyLogsEqual(left: DailyLog[], right: DailyLog[]): boolean {
  return JSON.stringify(normalizeDailyLogs(left)) === JSON.stringify(normalizeDailyLogs(right));
}

async function fetchRemoteDailyLogs(settings: Mind365Settings): Promise<DailyLog[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);

  if (!client || !config) {
    return [];
  }

  const { data, error } = await client
    .from("diaries")
    .select("id, user_id, content, ai_analysis, created_at")
    .eq("user_id", config.userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rows = Array.isArray(data) ? (data as SupabaseDiaryRow[]) : [];
  return normalizeDailyLogs(rows.map(parseDiaryRow).filter((log): log is DailyLog => log !== null));
}

async function upsertRemoteDailyLogs(logs: DailyLog[], settings: Mind365Settings): Promise<boolean> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);

  if (!client || !config || logs.length === 0) {
    return false;
  }

  const payload = logs.map((log) => ({
    ai_analysis: null,
    content: serializeDailyLog(log),
    created_at: log.createdAt,
    id: log.id,
    user_id: config.userId,
  }));

  const { error } = await client.from("diaries").upsert(payload, { onConflict: "id" });

  if (error) {
    throw new Error(error.message);
  }

  return true;
}

export function getSettings(): Mind365Settings {
  return normalizeMind365Settings(readSettingsValue());
}

function getSettingsForSync(): Mind365Settings {
  if (typeof window === "undefined") {
    return getSettings();
  }

  return ensureSettingsUserId(getSettings());
}

export function saveSettings(settings: Mind365Settings): Mind365Settings {
  const normalized = normalizeMind365Settings(settings);
  return writeSettings(ensureSettingsUserId(normalized));
}

export function getCloudSyncStatus(): CloudSyncStatus {
  const settings = getSettings();
  const envConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
  const config = getSupabaseConfig(settings);

  if (!settings.enableSupabaseSync && !envConfigured) {
    return {
      configured: false,
      enabled: false,
      message: "云同步未启用，当前仍使用本地缓存。",
      userId: settings.supabaseUserId,
    };
  }

  if (!config) {
    return {
      configured: false,
      enabled: true,
      message: "请补全 Supabase URL、Anon Key 和同步用户 ID。",
      userId: settings.supabaseUserId,
    };
  }

  return {
    configured: true,
    enabled: true,
    message: "已连接到 Supabase，日记会优先同步到云端。",
    userId: config.userId,
  };
}

export function getDailyLogs(): DailyLog[] {
  return readDailyLogs();
}

export function setDailyLogs(logs: DailyLog[]) {
  writeCollection(STORAGE_KEYS.dailyLogs, normalizeDailyLogs(logs));
}

export async function refreshDailyLogs(options?: { force?: boolean }): Promise<DailyLog[]> {
  if (typeof window === "undefined") {
    return [];
  }

  const settings = getSettingsForSync();
  const config = getSupabaseConfig(settings);

  if (!config) {
    return readDailyLogs();
  }

  const signature = `${config.url}::${config.userId}`;

  if (!options?.force && refreshPromise && refreshSignature === signature) {
    return refreshPromise;
  }

  refreshSignature = signature;
  refreshPromise = (async () => {
    const localLogs = readDailyLogs();

    try {
      const remoteLogs = await fetchRemoteDailyLogs(settings);
      const mergedLogs = mergeDailyLogs(localLogs, remoteLogs);

      if (!areDailyLogsEqual(localLogs, mergedLogs)) {
        writeCollection(STORAGE_KEYS.dailyLogs, mergedLogs);
      }

      if (!areDailyLogsEqual(remoteLogs, mergedLogs)) {
        await upsertRemoteDailyLogs(mergedLogs, settings);
      }

      return mergedLogs;
    } catch {
      return localLogs;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function saveDailyLog(log: DailyLog): Promise<DailyLogMutationResult> {
  const logs = getDailyLogs();
  const normalized: DailyLog = {
    ...log,
    id: log.id || createId(),
    createdAt: log.createdAt || new Date().toISOString(),
  };
  const updated = normalizeDailyLogs([normalized, ...logs]);
  setDailyLogs(updated);

  try {
    const synced = await upsertRemoteDailyLogs([normalized], getSettingsForSync());
    return { logs: updated, synced };
  } catch {
    return { logs: updated, synced: false };
  }
}

export async function updateDailyLog(nextLog: DailyLog): Promise<DailyLogMutationResult> {
  const logs = getDailyLogs();
  const updatedLog: DailyLog = {
    ...nextLog,
    id: nextLog.id || createId(),
    createdAt: nextLog.createdAt || new Date().toISOString(),
  };
  const updated = normalizeDailyLogs(logs.map((log) => (log.id === updatedLog.id ? updatedLog : log)));
  setDailyLogs(updated);

  try {
    const synced = await upsertRemoteDailyLogs([updatedLog], getSettingsForSync());
    return { logs: updated, synced };
  } catch {
    return { logs: updated, synced: false };
  }
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
    notes: getNotes(),
    quotes: getQuotes(),
    settings: getSettings(),
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
  const settings = normalizeMind365Settings(parsed.settings);

  window.localStorage.setItem(STORAGE_KEYS.dailyLogs, JSON.stringify(dailyLogs));
  window.localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(quotes));
  window.localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  window.localStorage.setItem(
    STORAGE_KEYS.settings,
    JSON.stringify({
      ...settings,
      supabaseUserId: settings.supabaseUserId || createDefaultSupabaseUserId(),
    }),
  );

  dispatchStorageChange();
  void upsertRemoteDailyLogs(dailyLogs, getSettingsForSync()).catch(() => undefined);

  return {
    dailyLogs: dailyLogs.length,
    notes: notes.length,
    quotes: quotes.length,
  };
}





