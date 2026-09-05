import { accountStorage, captureStorageScope, getStorageScope, getGuestDocument } from "@/lib/account-storage";
﻿import {
  createDefaultSupabaseUserId,
  createMind365SupabaseClient,
  DEFAULT_SETTINGS,
  getActiveSyncConfig,
  getSupabaseConfig,
  normalizeMind365Settings,
} from "@/lib/supabase";
import { getCachedAuthUserId } from "@/lib/auth";
import { isJournalDraft, JOURNAL_DRAFTS_KEY } from "@/lib/journal-draft";
import {
  getLifePathBackupData,
  refreshLifePathState,
  importLifePathBackupData,
  type LifePathBackupData,
} from "@/lib/life-path-storage";
import { DailyLog, Mind365Settings, Note, Quote, ReviewReport, TimeEntry, TodoItem, TodoQuadrant } from "@/types";

export const STORAGE_KEYS = {
  dailyLogs: "daily_logs",
  quotes: "quotes",
  notes: "notes",
  settings: "settings",
  reviewReports: "review_reports",
  timeEntries: "time_entries",
  todos: "todos",
} as const;

/**
 * 本地删除墓碑：防止远端（或同步失败的离线删除）把已删记录复活。
 * 服务端另有 deleted 列做跨设备传播，两者配合。
 */
const DELETED_IDS_KEYS = {
  dailyLogs: "mind365-deleted-daily-log-ids",
  notes: "mind365-deleted-note-ids",
  quotes: "mind365-deleted-quote-ids",
  reviewReports: "mind365-deleted-review-report-ids",
} as const;

type TombstoneKind = keyof typeof DELETED_IDS_KEYS;

function getDeletedIds(kind: TombstoneKind): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = accountStorage.getItem(DELETED_IDS_KEYS[kind]);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? (arr as string[]).filter((v) => typeof v === "string") : []);
  } catch {
    return new Set();
  }
}

function addDeletedId(kind: TombstoneKind, id: string) {
  if (typeof window === "undefined") return;
  const ids = getDeletedIds(kind);
  ids.add(id);
  accountStorage.setItem(DELETED_IDS_KEYS[kind], JSON.stringify([...ids]));
}

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
  version: number;
  scope: string;
  exportedAt: string;
  todos: TodoItem[];
  extras: Record<string, unknown>;
  daily_logs: DailyLog[];
  quotes: Quote[];
  notes: Note[];
  settings: Mind365Settings;
  review_reports: ReviewReport[];
  time_entries: TimeEntry[];
  life_path: LifePathBackupData;
}

export interface BackupImportResult {
  todos: number;
  dailyLogs: number;
  directions: number;
  goals: number;
  mentorPlans: number;
  notes: number;
  quotes: number;
  reviewReports: number;
  timeEntries: number;
  weekPlans: number;
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

/** 给 Promise 加上超时，避免网络慢时无限等待 */
function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
  ]).finally(() => clearTimeout(timer));
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
  if (!isRecord(value)) return null;
  if (
    typeof value.date !== "string" ||
    typeof value.mood !== "number" ||
    !Number.isFinite(value.mood) ||
    typeof value.thoughts !== "string" ||
    typeof value.reading !== "string" ||
    typeof value.studyHours !== "number" ||
    !Number.isFinite(value.studyHours) ||
    !isStringArray(value.tags)
  ) return null;

  const createdAt =
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
      ? value.createdAt
      : Number.isFinite(Date.parse(`${value.date}T00:00:00`))
        ? new Date(`${value.date}T00:00:00`).toISOString()
        : new Date().toISOString();

  return {
    id: typeof value.id === "string" && value.id.trim().length > 0 ? value.id : createId(),
    createdAt,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : createdAt,
    date: value.date,
    mood: value.mood,
    thoughts: value.thoughts,
    reading: value.reading,
    studyHours: value.studyHours,
    tags: value.tags,
    images: isStringArray(value.images) ? value.images : [],
  };
}

function normalizeDailyLogs(values: unknown): DailyLog[] {
  if (!Array.isArray(values)) return [];
  const dedupe = new Set<string>();
  return values
    .map(parseDailyLog)
    .filter((log): log is DailyLog => log !== null)
    .map((log) => {
      if (!dedupe.has(log.id)) { dedupe.add(log.id); return log; }
      const nextId = createId();
      dedupe.add(nextId);
      return { ...log, id: nextId };
    })
    .sort((left, right) => {
      if (left.date === right.date) {
        if (left.createdAt === right.createdAt) return right.id.localeCompare(left.id);
        return right.createdAt.localeCompare(left.createdAt);
      }
      return right.date.localeCompare(left.date);
    });
}

function parseQuote(value: unknown): Quote | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.text !== "string" ||
    typeof value.author !== "string" ||
    typeof value.book !== "string" ||
    !isStringArray(value.tags)
  ) {
    return null;
  }

  const createdAt =
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
      ? value.createdAt
      : new Date().toISOString();

  const readingHours =
    typeof value.readingHours === "number" && Number.isFinite(value.readingHours)
      ? Math.max(0, value.readingHours)
      : 0;

  const themeCategory =
    typeof value.themeCategory === "string" && value.themeCategory.trim()
      ? value.themeCategory.trim()
      : undefined;

  return {
    id: value.id,
    createdAt,
    text: value.text,
    author: value.author,
    book: value.book,
    readingHours,
    tags: value.tags,
    themeCategory,
  };
}

function normalizeQuotes(values: unknown): Quote[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(parseQuote)
    .filter((quote): quote is Quote => quote !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function parseTimeEntry(value: unknown): TimeEntry | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.date !== "string" ||
    (value.type !== "study" && value.type !== "reading") ||
    typeof value.hours !== "number" ||
    !Number.isFinite(value.hours)
  ) {
    return null;
  }

  const createdAt =
    typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt))
      ? value.createdAt
      : new Date().toISOString();

  return {
    id: value.id,
    createdAt,
    date: value.date,
    type: value.type,
    hours: Math.max(0, value.hours),
    note: typeof value.note === "string" ? value.note : undefined,
  };
}

function normalizeTimeEntries(values: unknown): TimeEntry[] {
  if (!Array.isArray(values)) return [];
  return values
    .map(parseTimeEntry)
    .filter((entry): entry is TimeEntry => entry !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function isNote(value: unknown): value is Note {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.content === "string" &&
    isStringArray(value.tags)
  );
}

function isTodo(value: unknown): value is TodoItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.text === "string" &&
    typeof value.done === "boolean" &&
    typeof value.order === "number" &&
    typeof value.createdAt === "string"
  );
}

function isReviewReport(value: unknown): value is ReviewReport {
  if (!isRecord(value)) return false;
  const m = value.metrics;
  return (
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    (value.period === "week" || value.period === "month" || value.period === "year") &&
    typeof value.rangeStart === "string" &&
    typeof value.rangeEnd === "string" &&
    typeof value.title === "string" &&
    typeof value.notes === "string" &&
    isRecord(m) &&
    typeof m.averageMood === "number" &&
    typeof m.totalReadingHours === "number" &&
    typeof m.totalStudyHours === "number" &&
    typeof m.entries === "number"
  );
}

function normalizeCollection<T>(values: unknown, guard: (value: unknown) => value is T): T[] {
  if (!Array.isArray(values)) return [];
  return values.filter(guard);
}

function readCollection<T>(key: StorageKey, guard: (value: unknown) => value is T): T[] {
  if (typeof window === "undefined") return [];
  const raw = accountStorage.getItem(key);
  if (!raw) return [];
  try {
    return normalizeCollection(JSON.parse(raw) as unknown, guard);
  } catch {
    return [];
  }
}

function readDailyLogs(): DailyLog[] {
  if (typeof window === "undefined") return [];
  const raw = accountStorage.getItem(STORAGE_KEYS.dailyLogs);
  if (!raw) return [];
  try {
    return normalizeDailyLogs(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeCollection<T>(key: StorageKey, data: T[]) {
  if (typeof window === "undefined") return;
  try {
    accountStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    // localStorage 容量超限（手机端通常 5-10MB）：抛出友好错误供调用方处理
    if (err instanceof DOMException && (err.name === "QuotaExceededError" || err.code === 22)) {
      throw new Error("本地存储空间已满，请删除一些旧记录或减小图片大小后重试。");
    }
    throw err;
  }
}

function readSettingsValue(): unknown {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  const raw = accountStorage.getItem(STORAGE_KEYS.settings);
  if (raw === null) return { ...DEFAULT_SETTINGS };
  try { return JSON.parse(raw) as unknown; } catch { return { ...DEFAULT_SETTINGS }; }
}

function writeSettings(settings: Mind365Settings) {
  if (typeof window === "undefined") return settings;
  accountStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  return settings;
}

function ensureSettingsUserId(settings: Mind365Settings): Mind365Settings {
  if (settings.supabaseUserId.trim()) return settings;
  const nextSettings: Mind365Settings = { ...settings, supabaseUserId: createDefaultSupabaseUserId() };
  writeSettings(nextSettings);
  return nextSettings;
}

function serializeDailyLog(log: DailyLog): string {
  return JSON.stringify({
    createdAt: log.createdAt, updatedAt: log.updatedAt ?? log.createdAt, date: log.date, mood: log.mood,
    reading: log.reading, studyHours: log.studyHours, tags: log.tags,
    thoughts: log.thoughts, images: log.images ?? [], version: 2,
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
    if (candidate) return candidate;
  } catch {}
  return parseDailyLog({ id: row.id, createdAt: row.created_at, date: fallbackDate, mood: 5, thoughts: row.content, reading: "", studyHours: 0, tags: [] });
}

async function fetchRemoteDailyLogs(
  settings: Mind365Settings,
): Promise<{ logs: DailyLog[]; deletedIds: Set<string>; contents: Map<string, string> }> {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config) return { logs: [], deletedIds: new Set(), contents: new Map() };
  const { data, error } = await client.from("diaries").select("id, user_id, content, ai_analysis, created_at, deleted").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? (data as Array<SupabaseDiaryRow & { deleted?: boolean }>) : [];
  const deletedIds = new Set(rows.filter((r) => r.deleted).map((r) => r.id));
  const live = rows.filter((r) => !r.deleted);
  return {
    logs: normalizeDailyLogs(live.map(parseDiaryRow).filter((log): log is DailyLog => log !== null)),
    deletedIds,
    contents: new Map(rows.map(r => [r.id, r.content])),
  };
}

/** Mark rows as deleted on the remote (cross-device tombstone). Fire-safe. */
async function markRemoteDeleted(
  table: "diaries" | "notes" | "quotes" | "review_reports",
  ids: string[],
  settings: Mind365Settings,
): Promise<boolean> {
  if (ids.length === 0) return true;
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config) return false;
  const { error } = await client.from(table).update({ deleted: true }).in("id", ids).eq("user_id", config.userId);
  if (error) throw new Error(error.message);
  return true;
}

async function fetchRemoteQuotes(
  settings: Mind365Settings,
): Promise<{ quotes: Quote[]; deletedIds: Set<string> }> {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config) return { quotes: [], deletedIds: new Set() };
  const { data, error } = await client.from("quotes").select("*").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  const deletedIds = new Set(
    rows.filter((r) => r.deleted === true && typeof r.id === "string").map((r) => r.id as string),
  );
  const quotes = normalizeQuotes(
    rows
      .filter((r) => r.deleted !== true)
      .map((item) => ({
        ...item,
        createdAt: typeof item.created_at === "string" ? item.created_at : new Date().toISOString(),
      })),
  );
  return { quotes, deletedIds };
}

async function fetchRemoteNotes(
  settings: Mind365Settings,
): Promise<{ notes: Note[]; deletedIds: Set<string> }> {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config) return { notes: [], deletedIds: new Set() };
  const { data, error } = await client.from("notes").select("*").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? data.filter(isRecord) : [];
  const deletedIds = new Set(
    rows.filter((r) => r.deleted === true && typeof r.id === "string").map((r) => r.id as string),
  );
  return {
    notes: normalizeCollection(rows.filter((r) => r.deleted !== true), isNote),
    deletedIds,
  };
}

async function fetchRemoteTimeEntries(settings: Mind365Settings): Promise<TimeEntry[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config) return [];
  const { data, error } = await client.from("time_entries").select("*").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data
    .map((row: Record<string, unknown>) => parseTimeEntry({
      id: row.id,
      createdAt: row.created_at,
      date: row.date,
      type: row.type,
      hours: row.hours,
      note: row.note,
    }))
    .filter((e): e is TimeEntry => e !== null);
}

async function fetchRemoteReviewReports(
  settings: Mind365Settings,
): Promise<{ reports: ReviewReport[]; deletedIds: Set<string> }> {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config) return { reports: [], deletedIds: new Set() };
  const { data, error } = await client.from("review_reports").select("*").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return { reports: [], deletedIds: new Set() };
  const rows = data.filter(isRecord);
  const deletedIds = new Set(
    rows.filter((r) => r.deleted === true && typeof r.id === "string").map((r) => r.id as string),
  );
  const reports = rows
    .filter((r) => r.deleted !== true)
    .map((row: Record<string, unknown>) => {
      try {
        const content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
        const candidate = { ...(isRecord(content) ? content : {}), id: row.id, createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString() };
        return isReviewReport(candidate) ? candidate : null;
      } catch { return null; }
    })
    .filter((r): r is ReviewReport => r !== null);
  return { reports, deletedIds };
}

async function upsertRemoteQuotes(quotes: Quote[], settings: Mind365Settings) {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config || quotes.length === 0) return false;
  const payload = quotes.map((q) => ({
    id: q.id,
    user_id: config.userId,
    created_at: q.createdAt,
    text: q.text,
    author: q.author,
    book: q.book,
    tags: q.tags,
    deleted: false,
  }));
  const { error } = await client.from("quotes").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

async function upsertRemoteNotes(notes: Note[], settings: Mind365Settings) {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config || notes.length === 0) return false;
  const payload = notes.map((n) => ({ id: n.id, user_id: config.userId, title: n.title, content: n.content, tags: n.tags, deleted: false }));
  const { error } = await client.from("notes").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

async function upsertRemoteTimeEntries(entries: TimeEntry[], settings: Mind365Settings) {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config || entries.length === 0) return false;
  const payload = entries.map((e) => ({
    id: e.id,
    user_id: config.userId,
    created_at: e.createdAt,
    date: e.date,
    type: e.type,
    hours: e.hours,
    note: e.note ?? null,
  }));
  const { error } = await client.from("time_entries").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

async function upsertRemoteReviewReports(reports: ReviewReport[], settings: Mind365Settings) {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config || reports.length === 0) return false;
  const payload = reports.map((r) => ({
    id: r.id, user_id: config.userId, created_at: r.createdAt, deleted: false,
    content: JSON.stringify({ period: r.period, rangeStart: r.rangeStart, rangeEnd: r.rangeEnd, title: r.title, metrics: r.metrics, notes: r.notes }),
  }));
  const { error } = await client.from("review_reports").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

export function getSettings(): Mind365Settings {
  return normalizeMind365Settings(readSettingsValue());
}

/**
 * The auth module owns the session cache (initialized at client creation,
 * updated via onAuthStateChange); we just read its synchronous snapshot.
 */
function getAuthUserId(): string | null {
  return getCachedAuthUserId();
}

function getSettingsForSync(): Mind365Settings {
  if (typeof window === "undefined") return getSettings();
  const settings = ensureSettingsUserId(getSettings());

  // Override with auth user ID if available
  const authUserId = getAuthUserId();
  if (authUserId) {
    return { ...settings, supabaseUserId: authUserId };
  }
  return settings;
}

export function saveSettings(settings: Mind365Settings): Mind365Settings {
  const normalized = normalizeMind365Settings(settings);
  return writeSettings(ensureSettingsUserId(normalized));
}

export function getCloudSyncStatus(): CloudSyncStatus {
  const settings = getSettingsForSync();
  // 状态展示用原始 config：即使未登录也要能报告"已配置但未登录"
  const config = getSupabaseConfig(settings);

  if (!config) {
    return {
      configured: false,
      enabled: false,
      message: "云同步未启用，默认数据保存在本地缓存。",
      userId: settings.supabaseUserId,
    };
  }

  const authUserId = getAuthUserId();
  if (!authUserId) {
    return {
      configured: true,
      enabled: false,
      message: "已配置 Supabase，但当前未登录，默认仍使用本地缓存。",
      userId: config.userId,
    };
  }

  return {
    configured: true,
    enabled: true,
    message: "已连接到 Supabase，数据会自动同步。",
    userId: authUserId,
  };
}

export function getDailyLogs(): DailyLog[] { return readDailyLogs(); }
export function setDailyLogs(logs: DailyLog[]) { writeCollection(STORAGE_KEYS.dailyLogs, normalizeDailyLogs(logs)); }

interface PendingDiary { log: DailyLog; base: DailyLog | null; }
const DIARY_PENDING = "diary_pending";
const DIARY_BASE = "diary_synced";
const DIARY_STATUS = "diary_sync_status";
const diarySyncs = new Map<string, Promise<DailyLog[]>>();

function readMap<T>(key: string): Record<string, T> {
  return JSON.parse(accountStorage.getItem(key) ?? "{}") as Record<string, T>;
}

export function getDiarySyncState(): { pending: number; message: string } {
  return {
    pending: Object.keys(readMap(DIARY_PENDING)).length + getDeletedIds("dailyLogs").size,
    message: accountStorage.getItem(DIARY_STATUS) ?? "",
  };
}

function queueDiary(log: DailyLog, previous: DailyLog | null) {
  const pending = readMap<PendingDiary>(DIARY_PENDING);
  pending[log.id] = {
    log,
    base: pending[log.id] ? pending[log.id].base : previous ?? readMap<DailyLog>(DIARY_BASE)[log.id] ?? null,
  };
  accountStorage.setItem(DIARY_PENDING, JSON.stringify(pending));
}

// Serialize per account, including across tabs. CAS also protects other devices.
export async function refreshDailyLogs(_options?: { force?: boolean }): Promise<DailyLog[]> {
  void _options; // All refreshes reconcile durable pending operations.
  const scope = getStorageScope();
  const active = captureStorageScope();
  if (diarySyncs.has(scope)) return diarySyncs.get(scope)!;
  const run = () => active() ? syncDiaries() : Promise.resolve([]);
  const task = (async () => await (typeof navigator !== "undefined" && navigator.locks
    ? navigator.locks.request(`mind365:diaries:${scope}`, run)
    : run()))().finally(() => { diarySyncs.delete(scope); });
  diarySyncs.set(scope, task);
  return task;
}

async function syncDiaries(): Promise<DailyLog[]> {
  if (typeof window === "undefined") return [];
  const active = captureStorageScope();
  const settings = getSettingsForSync();
  const config = getActiveSyncConfig(settings, getAuthUserId());
  const client = createMind365SupabaseClient(settings);
  if (!config || !client) return getDailyLogs();
  try {
    const remote = await fetchRemoteDailyLogs(settings);
    if (!active()) return [];
    const remoteMap = new Map(remote.logs.map(log => [log.id, log]));
    const deleted = getDeletedIds("dailyLogs");
    if (deleted.size) {
      await markRemoteDeleted("diaries", [...deleted], settings);
      if (!active()) return [];
      const remaining = getDeletedIds("dailyLogs");
      for (const id of deleted) { remaining.delete(id); remoteMap.delete(id); }
      accountStorage.setItem(DELETED_IDS_KEYS.dailyLogs, JSON.stringify([...remaining]));
    }
    // Cached remote records are never uploaded just because local is older.
    for (const log of getDailyLogs()) {
      if (!remoteMap.has(log.id) && !remote.deletedIds.has(log.id) && !deleted.has(log.id) &&
          !readMap<PendingDiary>(DIARY_PENDING)[log.id]) queueDiary(log, null);
    }
    let conflicts = 0;
    for (const [id, operation] of Object.entries(readMap<PendingDiary>(DIARY_PENDING))) {
      if (!active()) return [];
      if (getDeletedIds("dailyLogs").has(id) || deleted.has(id)) continue;
      const current = remoteMap.get(id);
      const identical = current && serializeDailyLog(current) === serializeDailyLog(operation.log);
      const conflict = !identical && (remote.deletedIds.has(id) || (current &&
        (!operation.base || serializeDailyLog(current) !== serializeDailyLog(operation.base))));
      if (conflict) {
        const copy: DailyLog = { ...operation.log, id: createId(), createdAt: new Date().toISOString(), tags: [...new Set([...operation.log.tags, "同步冲突副本"])] };
        accountStorage.transaction(() => {
          const pending = readMap<PendingDiary>(DIARY_PENDING);
          if (JSON.stringify(pending[id]) !== JSON.stringify(operation)) return;
          delete pending[id];
          pending[copy.id] = { log: copy, base: null };
          accountStorage.setItem(DIARY_PENDING, JSON.stringify(pending));
          setDailyLogs([...getDailyLogs().filter(l => l.id !== id), ...(current ? [current] : []), copy]);
        });
        conflicts++;
        continue;
      }
      if (!identical) {
        const row = { id, user_id: config.userId, content: serializeDailyLog(operation.log), created_at: operation.log.createdAt, ai_analysis: null, deleted: false };
        const result = current
          ? await client.from("diaries").update(row).eq("id", id).eq("user_id", config.userId)
              .eq("content", remote.contents.get(id)!).eq("deleted", false).select("id")
          : await client.from("diaries").insert(row).select("id");
        if (!active()) return [];
        if (result.error) throw new Error(result.error.message);
        if (!result.data?.length) throw new Error("另一台设备刚刚修改了日记，修改已保留，等待重试。");
      }
      remoteMap.set(id, operation.log);
      accountStorage.transaction(() => {
        const pending = readMap<PendingDiary>(DIARY_PENDING);
        if (JSON.stringify(pending[id]) === JSON.stringify(operation)) delete pending[id];
        else if (pending[id]) pending[id].base = operation.log;
        accountStorage.setItem(DIARY_PENDING, JSON.stringify(pending));
      });
    }
    if (!active()) return [];
    accountStorage.transaction(() => {
      accountStorage.setItem(DIARY_BASE, JSON.stringify(Object.fromEntries(remoteMap)));
      const result = new Map(remoteMap);
      for (const p of Object.values(readMap<PendingDiary>(DIARY_PENDING))) result.set(p.log.id, p.log);
      for (const id of getDeletedIds("dailyLogs")) result.delete(id);
      setDailyLogs([...result.values()]);
      accountStorage.setItem(DIARY_STATUS, conflicts
        ? `发现 ${conflicts} 处冲突，双方内容已保留，副本标记为“同步冲突副本”。`
        : Object.keys(readMap(DIARY_PENDING)).length ? "仍有本地修改等待同步。" : "日记已同步。");
    });
    return getDailyLogs();
  } catch (error) {
    if (!active()) return [];
    accountStorage.setItem(DIARY_STATUS, `同步未完成，修改保留在本地。${error instanceof Error ? error.message : "请重试。"}`);
    return getDailyLogs();
  }
}

export async function refreshQuotes(): Promise<Quote[]> {
  const active = captureStorageScope();
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!config) return getQuotes();
  const local = getQuotes();
  try {
    const { quotes: remote, deletedIds: remoteDeleted } = await fetchRemoteQuotes(settings);
    if (!active()) return [];
    const localTombstones = getDeletedIds("quotes");
    const merged = new Map<string, Quote>();
    // Remote goes in first; local overwrites. Tombstoned IDs (local or remote)
    // are skipped so deleted quotes are never resurrected.
    for (const q of remote) {
      if (!localTombstones.has(q.id)) merged.set(q.id, q);
    }
    for (const q of local) {
      if (!localTombstones.has(q.id) && !remoteDeleted.has(q.id)) merged.set(q.id, q);
    }
    const offlineDeleted = remote.filter((q) => localTombstones.has(q.id)).map((q) => q.id);
    if (offlineDeleted.length > 0) {
      void markRemoteDeleted("quotes", offlineDeleted, settings).catch(() => undefined);
    }
    const mergedArr = [...merged.values()];
    setQuotes(mergedArr);
    const remoteIds = new Set(remote.map((q) => q.id));
    const toUpload = mergedArr.filter((q) => !remoteIds.has(q.id));
    if (toUpload.length > 0) await upsertRemoteQuotes(toUpload, settings);
    return mergedArr;
  } catch { return local; }
}

export async function refreshNotes(): Promise<Note[]> {
  const active = captureStorageScope();
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!config) return getNotes();
  const local = getNotes();
  try {
    const { notes: remote, deletedIds: remoteDeleted } = await fetchRemoteNotes(settings);
    if (!active()) return [];
    const localTombstones = getDeletedIds("notes");
    const merged = new Map<string, Note>();
    for (const n of remote) {
      if (!localTombstones.has(n.id)) merged.set(n.id, n);
    }
    for (const n of local) {
      if (!localTombstones.has(n.id) && !remoteDeleted.has(n.id)) merged.set(n.id, n);
    }
    const offlineDeleted = remote.filter((n) => localTombstones.has(n.id)).map((n) => n.id);
    if (offlineDeleted.length > 0) {
      void markRemoteDeleted("notes", offlineDeleted, settings).catch(() => undefined);
    }
    const mergedArr = [...merged.values()];
    setNotes(mergedArr);
    const remoteIds = new Set(remote.map((n) => n.id));
    const toUpload = mergedArr.filter((n) => !remoteIds.has(n.id));
    if (toUpload.length > 0) await upsertRemoteNotes(toUpload, settings);
    return mergedArr;
  } catch { return local; }
}

export async function refreshReviewReports(): Promise<ReviewReport[]> {
  const active = captureStorageScope();
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!config) return getReviewReports();
  const local = getReviewReports();
  try {
    const { reports: remote, deletedIds: remoteDeleted } = await fetchRemoteReviewReports(settings);
    if (!active()) return [];
    const localTombstones = getDeletedIds("reviewReports");
    const merged = new Map<string, ReviewReport>();
    for (const r of remote) {
      if (!localTombstones.has(r.id)) merged.set(r.id, r);
    }
    for (const r of local) {
      if (!localTombstones.has(r.id) && !remoteDeleted.has(r.id)) merged.set(r.id, r);
    }
    const offlineDeleted = remote.filter((r) => localTombstones.has(r.id)).map((r) => r.id);
    if (offlineDeleted.length > 0) {
      void markRemoteDeleted("review_reports", offlineDeleted, settings).catch(() => undefined);
    }
    const mergedArr = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setReviewReports(mergedArr);
    const remoteIds = new Set(remote.map((r) => r.id));
    const toUpload = mergedArr.filter((r) => !remoteIds.has(r.id));
    if (toUpload.length > 0) await upsertRemoteReviewReports(toUpload, settings);
    return mergedArr;
  } catch { return local; }
}

export async function refreshTimeEntries(): Promise<TimeEntry[]> {
  const active = captureStorageScope();
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!config) return getTimeEntries();
  const local = getTimeEntries();
  try {
    const remote = await fetchRemoteTimeEntries(settings);
    if (!active()) return [];
    const merged = new Map<string, TimeEntry>();
    for (const e of remote) merged.set(e.id, e);
    for (const e of local) merged.set(e.id, e);
    const mergedArr = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setTimeEntries(mergedArr);
    const remoteIds = new Set(remote.map((e) => e.id));
    const toUpload = mergedArr.filter((e) => !remoteIds.has(e.id));
    if (toUpload.length > 0) await upsertRemoteTimeEntries(toUpload, settings);
    return mergedArr;
  } catch { return local; }
}

export async function saveDailyLog(log: DailyLog): Promise<DailyLogMutationResult> {
  const active = captureStorageScope();
  const logs = getDailyLogs();
  const normalized: DailyLog = { ...log, id: log.id || createId(), createdAt: log.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const updated = normalizeDailyLogs([normalized, ...logs]);
  accountStorage.transaction(() => { queueDiary(normalized, null); setDailyLogs(updated); });
  await withTimeout(refreshDailyLogs(), 8000, updated);
  return { logs: active() ? getDailyLogs() : [], synced: active() && !readMap<PendingDiary>(DIARY_PENDING)[normalized.id] && getDiarySyncState().pending === 0 };
}

export async function updateDailyLog(nextLog: DailyLog, expectedBase?: DailyLog | null): Promise<DailyLogMutationResult> {
  const active = captureStorageScope();
  const logs = getDailyLogs();
  const updatedLog: DailyLog = { ...nextLog, id: nextLog.id || createId(), createdAt: nextLog.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
  const previous = logs.find(log => log.id === updatedLog.id);
  if (!previous) throw new Error("日记已被删除，请将内容另存为新日记。");
  const updated = normalizeDailyLogs(logs.map((log) => (log.id === updatedLog.id ? updatedLog : log)));
  accountStorage.transaction(() => { queueDiary(updatedLog, expectedBase ?? previous); setDailyLogs(updated); });
  await withTimeout(refreshDailyLogs(), 8000, updated);
  return { logs: active() ? getDailyLogs() : [], synced: active() && getDiarySyncState().pending === 0 };
}

export async function deleteDailyLog(id: string): Promise<DailyLogMutationResult> {
  const active = captureStorageScope();
  const logs = getDailyLogs().filter((log) => log.id !== id);
  accountStorage.transaction(() => {
    addDeletedId("dailyLogs", id);
    const pending = readMap<PendingDiary>(DIARY_PENDING);
    delete pending[id];
    accountStorage.setItem(DIARY_PENDING, JSON.stringify(pending));
    setDailyLogs(logs);
  });
  await withTimeout(refreshDailyLogs(), 8000, logs);
  return { logs, synced: active() && !getDeletedIds("dailyLogs").has(id) };
}

export function getQuotes(): Quote[] {
  if (typeof window === "undefined") return [];
  const raw = accountStorage.getItem(STORAGE_KEYS.quotes);
  if (!raw) return [];
  try {
    return normalizeQuotes(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}
export function setQuotes(quotes: Quote[]) { writeCollection(STORAGE_KEYS.quotes, normalizeQuotes(quotes)); }

export async function saveQuote(quote: Quote): Promise<Quote[]> {
  const normalized = parseQuote(quote);
  if (!normalized) {
    return getQuotes();
  }
  const updated = normalizeQuotes([normalized, ...getQuotes()]);
  setQuotes(updated);
  try { await upsertRemoteQuotes([normalized], getSettingsForSync()); } catch {}
  return updated;
}

/** Update an existing quote in place, preserving createdAt order. */
export async function updateQuote(quote: Quote): Promise<Quote[]> {
  const normalized = parseQuote(quote);
  if (!normalized) {
    return getQuotes();
  }
  const updated = normalizeQuotes(
    getQuotes().map((q) => (q.id === normalized.id ? normalized : q)),
  );
  setQuotes(updated);
  try { await upsertRemoteQuotes([normalized], getSettingsForSync()); } catch {}
  return updated;
}

/** Delete a quote by ID from local storage and remote (soft delete). */
export async function deleteQuote(id: string): Promise<Quote[]> {
  const updated = getQuotes().filter((q) => q.id !== id);
  setQuotes(updated);
  // Record tombstone so refreshQuotes won't restore this quote from Supabase.
  addDeletedId("quotes", id);
  try {
    await markRemoteDeleted("quotes", [id], getSettingsForSync());
  } catch {}
  return updated;
}

export function getNotes(): Note[] { return readCollection(STORAGE_KEYS.notes, isNote); }
export function setNotes(notes: Note[]) { writeCollection(STORAGE_KEYS.notes, notes); }

export async function saveNote(note: Note): Promise<Note[]> {
  const updated = [note, ...getNotes()];
  setNotes(updated);
  try { await upsertRemoteNotes([note], getSettingsForSync()); } catch {}
  return updated;
}

/** Delete a note by ID from local storage and remote (soft delete). */
export async function deleteNote(id: string): Promise<Note[]> {
  const updated = getNotes().filter((n) => n.id !== id);
  setNotes(updated);
  addDeletedId("notes", id);
  try {
    await markRemoteDeleted("notes", [id], getSettingsForSync());
  } catch {}
  return updated;
}

// ── Todos (轻量每日清单，本地 + Supabase 跨设备同步) ──────────────
function sortTodos(todos: TodoItem[]): TodoItem[] {
  // done 项沉底；同组按 order 升序
  return [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.order - b.order;
  });
}

const VALID_QUADRANTS: TodoQuadrant[] = ["q1", "q2", "q3", "q4"];
function normalizeQuadrant(value: unknown): TodoQuadrant {
  return VALID_QUADRANTS.includes(value as TodoQuadrant) ? (value as TodoQuadrant) : "q1";
}

export function getTodos(): TodoItem[] {
  const raw = readCollection(STORAGE_KEYS.todos, isTodo);
  // Backfill fields for legacy items written before sync / quadrants existed.
  return sortTodos(
    raw.map((t) => ({
      ...t,
      updatedAt: t.updatedAt ?? t.createdAt,
      quadrant: normalizeQuadrant(t.quadrant),
    })),
  );
}

export function setTodos(todos: TodoItem[]) {
  writeCollection(STORAGE_KEYS.todos, sortTodos(todos));
}

/** Upsert todo rows (including soft-delete tombstones) to Supabase. */
async function upsertRemoteTodos(
  rows: Array<TodoItem & { deleted?: boolean }>,
  settings: Mind365Settings,
): Promise<boolean> {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config || rows.length === 0) return false;
  const payload = rows.map((t) => ({
    id: t.id,
    user_id: config.userId,
    text: t.text,
    done: t.done,
    sort_order: t.order,
    completed_at: t.completedAt ?? null,
    due_date: t.dueDate ?? null,
    quadrant: t.quadrant ?? "q1",
    deleted: t.deleted ?? false,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  }));
  const { error } = await client.from("todos").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

/** Fetch all todo rows (including tombstones) for the current user. */
async function fetchRemoteTodos(
  settings: Mind365Settings,
): Promise<Array<{ item: TodoItem; deleted: boolean }>> {
  const client = createMind365SupabaseClient(settings);
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!client || !config) return [];
  const { data, error } = await client.from("todos").select("*").eq("user_id", config.userId);
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data
    .map((row: Record<string, unknown>) => {
      const id = typeof row.id === "string" ? row.id : "";
      const text = typeof row.text === "string" ? row.text : "";
      if (!id) return null;
      const createdAt = typeof row.created_at === "string" ? row.created_at : new Date().toISOString();
      const item: TodoItem = {
        id,
        text,
        done: Boolean(row.done),
        order: typeof row.sort_order === "number" ? row.sort_order : 0,
        createdAt,
        updatedAt: typeof row.updated_at === "string" ? row.updated_at : createdAt,
        completedAt: typeof row.completed_at === "string" ? row.completed_at : undefined,
        dueDate: typeof row.due_date === "string" && row.due_date ? row.due_date.slice(0, 10) : undefined,
        quadrant: normalizeQuadrant(row.quadrant),
      };
      return { item, deleted: Boolean(row.deleted) };
    })
    .filter((r): r is { item: TodoItem; deleted: boolean } => r !== null);
}

/** Fire-and-forget remote push for a single mutation. */
function pushTodoRemote(item: TodoItem, deleted = false) {
  if (deleted) {
    const tombstones = readMap<TodoItem>("todo_deleted");
    tombstones[item.id] = item;
    accountStorage.setItem("todo_deleted", JSON.stringify(tombstones));
  }
  void refreshTodos();
}

/**
 * Pull remote todos and reconcile with local using last-write-wins (by
 * updatedAt) plus soft-delete tombstones, so checks/edits/deletes from one
 * device propagate to others.
 */
export async function refreshTodos(): Promise<TodoItem[]> {
  const active = captureStorageScope();
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getActiveSyncConfig(settings, getAuthUserId());
  if (!config) return getTodos();
  const ts = (s: string) => Date.parse(s) || 0;
  try {
    const remote = await fetchRemoteTodos(settings);
    if (!active()) return [];
    const local = getTodos();
    const tombstones = readMap<TodoItem>("todo_deleted");
    const remoteMap = new Map<string, { item: TodoItem; deleted: boolean }>();
    for (const r of remote) remoteMap.set(r.item.id, r);
    const localMap = new Map<string, TodoItem>();
    for (const t of local) localMap.set(t.id, t);

    const allIds = new Set<string>([...remoteMap.keys(), ...localMap.keys()]);
    const resolved: TodoItem[] = [];
    const toUpload: TodoItem[] = [];

    for (const id of allIds) {
      if (tombstones[id]) continue;
      const r = remoteMap.get(id);
      const l = localMap.get(id);
      if (r && l) {
        if (ts(r.item.updatedAt) >= ts(l.updatedAt)) {
          // remote wins
          if (!r.deleted) resolved.push(r.item);
        } else {
          // local wins — keep and re-assert to remote
          resolved.push(l);
          toUpload.push(l);
        }
      } else if (r) {
        if (!r.deleted) resolved.push(r.item);
      } else if (l) {
        // brand-new local item → upload
        resolved.push(l);
        toUpload.push(l);
      }
    }

    setTodos(resolved);
    const payload = [...toUpload, ...Object.values(tombstones).map(item => ({ ...item, deleted: true }))];
    if (payload.length > 0) {
      await upsertRemoteTodos(payload, settings);
    }
    if (!active()) return [];
    accountStorage.setItem("todo_sync_status", "待办已同步。");
    return getTodos();
  } catch {
    if (!active()) return [];
    accountStorage.setItem("todo_sync_status", "待办同步未完成，离线修改及删除已保留，等待重试。");
    return getTodos();
  }
}

export function addTodo(text: string, dueDate?: string, quadrant: TodoQuadrant = "q1"): TodoItem[] {
  const trimmed = text.trim();
  if (!trimmed) return getTodos();
  const existing = getTodos();
  const minOrder = existing.length ? Math.min(...existing.map((t) => t.order)) : 0;
  const now = new Date().toISOString();
  const todo: TodoItem = {
    id: createId(),
    text: trimmed,
    done: false,
    order: minOrder - 1, // new items go to the top
    quadrant: normalizeQuadrant(quadrant),
    createdAt: now,
    updatedAt: now,
    dueDate: dueDate || undefined,
  };
  setTodos([todo, ...existing]);
  pushTodoRemote(todo);
  return getTodos();
}

/** Move a todo to a different Eisenhower quadrant. */
export function setTodoQuadrant(id: string, quadrant: TodoQuadrant): TodoItem[] {
  const now = new Date().toISOString();
  let changed: TodoItem | null = null;
  const updated = getTodos().map((t) => {
    if (t.id !== id) return t;
    changed = { ...t, quadrant: normalizeQuadrant(quadrant), updatedAt: now };
    return changed;
  });
  setTodos(updated);
  if (changed) pushTodoRemote(changed);
  return getTodos();
}

/** Set or clear a todo's due date (pass undefined/"" to clear). */
export function setTodoDueDate(id: string, dueDate?: string): TodoItem[] {
  const now = new Date().toISOString();
  let changed: TodoItem | null = null;
  const updated = getTodos().map((t) => {
    if (t.id !== id) return t;
    changed = { ...t, dueDate: dueDate || undefined, updatedAt: now };
    return changed;
  });
  setTodos(updated);
  if (changed) pushTodoRemote(changed);
  return getTodos();
}

export function toggleTodo(id: string): TodoItem[] {
  const now = new Date().toISOString();
  let changed: TodoItem | null = null;
  const updated = getTodos().map((t) => {
    if (t.id !== id) return t;
    changed = { ...t, done: !t.done, completedAt: !t.done ? now : undefined, updatedAt: now };
    return changed;
  });
  setTodos(updated);
  if (changed) pushTodoRemote(changed);
  return getTodos();
}

export function updateTodoText(id: string, text: string): TodoItem[] {
  const trimmed = text.trim();
  if (!trimmed) return deleteTodo(id);
  const now = new Date().toISOString();
  let changed: TodoItem | null = null;
  const updated = getTodos().map((t) => {
    if (t.id !== id) return t;
    changed = { ...t, text: trimmed, updatedAt: now };
    return changed;
  });
  setTodos(updated);
  if (changed) pushTodoRemote(changed);
  return getTodos();
}

export function deleteTodo(id: string): TodoItem[] {
  const target = getTodos().find((t) => t.id === id);
  accountStorage.transaction(() => {
    if (target) {
      const tombstones = readMap<TodoItem>("todo_deleted");
      tombstones[id] = { ...target, updatedAt: new Date().toISOString() };
      accountStorage.setItem("todo_deleted", JSON.stringify(tombstones));
    }
    setTodos(getTodos().filter((t) => t.id !== id));
  });
  void refreshTodos();
  return getTodos();
}

export function clearCompletedTodos(): TodoItem[] {
  const now = new Date().toISOString();
  const done = getTodos().filter((t) => t.done);
  accountStorage.transaction(() => {
    const tombstones = readMap<TodoItem>("todo_deleted");
    for (const t of done) tombstones[t.id] = { ...t, updatedAt: now };
    accountStorage.setItem("todo_deleted", JSON.stringify(tombstones));
    setTodos(getTodos().filter((t) => !t.done));
  });
  void refreshTodos();
  return getTodos();
}

export function getReviewReports(): ReviewReport[] { return readCollection(STORAGE_KEYS.reviewReports, isReviewReport); }
export function setReviewReports(reports: ReviewReport[]) { writeCollection(STORAGE_KEYS.reviewReports, reports); }

export function getTimeEntries(): TimeEntry[] {
  if (typeof window === "undefined") return [];
  const raw = accountStorage.getItem(STORAGE_KEYS.timeEntries);
  if (!raw) return [];
  try {
    return normalizeTimeEntries(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

export function setTimeEntries(entries: TimeEntry[]) {
  writeCollection(STORAGE_KEYS.timeEntries, normalizeTimeEntries(entries));
}

export async function saveTimeEntry(entry: Omit<TimeEntry, "id" | "createdAt">): Promise<{ entries: TimeEntry[]; synced: boolean }> {
  const normalized: TimeEntry = {
    ...entry,
    id: createId(),
    createdAt: new Date().toISOString(),
    hours: Number.isFinite(entry.hours) ? Math.max(0, entry.hours) : 0,
    note: entry.note?.trim() || undefined,
  };
  const updated = normalizeTimeEntries([normalized, ...getTimeEntries()]);
  setTimeEntries(updated);
  try {
    const synced = await withTimeout(upsertRemoteTimeEntries([normalized], getSettingsForSync()), 8000, false);
    return { entries: updated, synced: !!synced };
  } catch { return { entries: updated, synced: false }; }
}

export async function saveReviewReport(report: ReviewReport): Promise<ReviewReport[]> {
  const reports = getReviewReports();
  const existsIdx = reports.findIndex((r) => r.rangeStart === report.rangeStart && r.period === report.period);
  const updated = existsIdx >= 0
    ? reports.map((r, i) => (i === existsIdx ? report : r))
    : [report, ...reports];
  setReviewReports(updated);
  try { await upsertRemoteReviewReports([report], getSettingsForSync()); } catch {}
  return updated;
}

export async function deleteReviewReport(id: string): Promise<ReviewReport[]> {
  const reports = getReviewReports().filter((r) => r.id !== id);
  setReviewReports(reports);
  addDeletedId("reviewReports", id);
  try {
    await markRemoteDeleted("review_reports", [id], getSettingsForSync());
  } catch {}
  return reports;
}

export function getMind365BackupData(): Mind365BackupData {
  return {
    version: 3,
    scope: getStorageScope(),
    exportedAt: new Date().toISOString(),
    todos: getTodos(),
    extras: Object.fromEntries(BACKUP_EXTRA_KEYS.map(key => [key, JSON.parse(accountStorage.getItem(key) ?? "null")])),
    daily_logs: getDailyLogs(),
    notes: getNotes(),
    quotes: getQuotes(),
    settings: { ...DEFAULT_SETTINGS, weeklyStudyTarget: getSettings().weeklyStudyTarget, weeklyReadingTarget: getSettings().weeklyReadingTarget },
    review_reports: getReviewReports(),
    time_entries: getTimeEntries(),
    life_path: getLifePathBackupData(),
  };
}

function triggerDownload(content: string, mime: string, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadMind365Backup(filename = "mind365-backup.json") {
  const data = await embedBackupImages(getMind365BackupData());
  triggerDownload(JSON.stringify(data, null, 2), "application/json", filename);
}

async function embedBackupImages<T>(data: T): Promise<T> {
  const images = new Map<string, string>();
  const visit = async (value: unknown): Promise<unknown> => {
    if (Array.isArray(value)) return Promise.all(value.map(visit));
    if (!isRecord(value)) return value;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === "images" && isStringArray(child)) {
        result[key] = await Promise.all(child.map(async url => {
          if (url.startsWith("data:")) return url;
          if (images.has(url)) return images.get(url)!;
          const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
          if (!response.ok) throw new Error("图片下载失败，完整备份未生成。请联网后重试。");
          const blob = await response.blob();
          if (!blob.type.startsWith("image/")) throw new Error("备份图片格式无效。");
          const encoded = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("图片备份失败。"));
            reader.readAsDataURL(blob);
          });
          images.set(url, encoded);
          return encoded;
        }));
      } else result[key] = await visit(child);
    }
    return result;
  };
  return await visit(data) as T;
}

/**
 * 把全部数据渲染成人类可读的 Markdown 并下载。
 * 适合归档、打印、或导入到 Obsidian/Notion 等笔记工具——
 * 注意 Markdown 是单向导出（不可再导入回 App，回灌请用 JSON）。
 */
export function buildMind365Markdown(): string {
  const data = getMind365BackupData();
  const out: string[] = [];
  const today = new Date().toISOString().slice(0, 10);

  out.push(`# Mind365 数据导出`, "", `> 导出于 ${today}`, "");

  // 日记（按日期倒序，normalizeDailyLogs 已排好）
  out.push(`## 日记 · ${data.daily_logs.length} 篇`, "");
  for (const log of data.daily_logs) {
    out.push(`### ${log.date}`, "");
    const meta = [`情绪 ${log.mood}/10`];
    if (log.studyHours) meta.push(`学习 ${log.studyHours}h`);
    if (log.reading?.trim()) meta.push(`阅读 ${log.reading.trim()}`);
    out.push(`*${meta.join(" · ")}*`, "");
    if (log.thoughts?.trim()) out.push(log.thoughts.trim(), "");
    if (log.tags.length) out.push(log.tags.map((t) => `#${t}`).join(" "), "");
    for (const img of log.images ?? []) out.push(`![](${img})`);
    if (log.images?.length) out.push("");
    out.push("---", "");
  }

  // 金句
  out.push(`## 金句 · ${data.quotes.length} 条`, "");
  for (const q of data.quotes) {
    out.push(`> ${q.text.trim()}`, "");
    const src = [q.author, q.book ? `《${q.book}》` : ""].filter(Boolean).join(" · ");
    if (src) out.push(`— ${src}`, "");
    if (q.tags.length) out.push(q.tags.map((t) => `#${t}`).join(" "), "");
    out.push("");
  }

  // 阅读笔记
  out.push(`## 阅读笔记 · ${data.notes.length} 篇`, "");
  for (const n of data.notes) {
    out.push(`### ${n.title || "无题"}`, "");
    if (n.content?.trim()) out.push(n.content.trim(), "");
    if (n.tags.length) out.push(n.tags.map((t) => `#${t}`).join(" "), "");
    out.push("");
  }

  // 复盘报告
  out.push(`## 复盘报告 · ${data.review_reports.length} 份`, "");
  for (const r of data.review_reports) {
    out.push(`### ${r.title}（${r.rangeStart} ~ ${r.rangeEnd}）`, "");
    if (r.notes?.trim()) out.push(r.notes.trim(), "");
    out.push("");
  }

  return out.join("\n");
}

export function downloadMind365Markdown(filename = "mind365-export.md") {
  triggerDownload(buildMind365Markdown(), "text/markdown;charset=utf-8", filename);
}

const BACKUP_EXTRA_KEYS = ["reviews", "mind365_custom_themes", "mind365_hidden_themes", JOURNAL_DRAFTS_KEY] as const;

export async function downloadGuestBackup() {
  const doc = getGuestDocument();
  const read = (key: string, fallback: unknown) => JSON.parse(doc[key] ?? JSON.stringify(fallback));
  const data = await embedBackupImages({
    version: 3, scope: "guest", exportedAt: new Date().toISOString(),
    daily_logs: read("daily_logs", []), quotes: read("quotes", []), notes: read("notes", []),
    review_reports: read("review_reports", []), time_entries: read("time_entries", []), todos: read("todos", []),
    settings: { ...DEFAULT_SETTINGS, weeklyStudyTarget: read("settings", {}).weeklyStudyTarget ?? 10, weeklyReadingTarget: read("settings", {}).weeklyReadingTarget ?? 7 },
    life_path: { directions: read("mind365_life_directions", []), goals: read("mind365_life_goals", []), mentor_plans: read("mind365_mentor_plans", {}), week_plans: read("mind365_week_plans", {}) },
    extras: Object.fromEntries(BACKUP_EXTRA_KEYS.map(k => [k, read(k, null)])),
  });
  triggerDownload(JSON.stringify(data, null, 2), "application/json", "mind365-guest-backup.json");
}

function mergeById<T extends { id: string }>(local: T[], incoming: T[]): T[] {
  return [...new Map([...local, ...incoming].map(v => [v.id, v])).values()];
}

export function importMind365Backup(raw: string): BackupImportResult {
  if (typeof window === "undefined") throw new Error("Import is only available in browser.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("备份不是有效的 JSON 文件。"); }
  if (!isRecord(parsed) || !Array.isArray(parsed.daily_logs) || !Array.isArray(parsed.quotes) || !Array.isArray(parsed.notes)) {
    throw new Error("备份格式无效，当前数据未更改。");
  }
  if (parsed.version !== undefined && (![1, 2, 3].includes(parsed.version as number))) throw new Error("不支持此备份版本。");

  // Portable imports receive fresh IDs, including Life Path references. Never
  // reuse another account's remote primary keys or connection credentials.
  if (parsed.scope !== getStorageScope()) {
    const ids = new Map<string, string>();
    const collect = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (isRecord(value)) {
        if (typeof value.id === "string") ids.set(value.id, ids.get(value.id) ?? createId());
        Object.values(value).forEach(collect);
      }
    };
    collect(parsed);
    const remap = (value: unknown, field = ""): unknown => {
      if (typeof value === "string") return ["id", "goalId", "directionId"].includes(field) ? ids.get(value) ?? value : value;
      if (Array.isArray(value)) return value.map(v => remap(v, field));
      if (isRecord(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [ids.get(k) ?? k, remap(v, k)]));
      return value;
    };
    parsed = remap(parsed);
  }
  const data = parsed as Record<string, unknown>;
  const checked = <T,>(key: string, parse: (v: unknown) => T[]): T[] => {
    if (data[key] === undefined) return [];
    if (!Array.isArray(data[key])) throw new Error(`备份字段 ${key} 无效。`);
    const items = parse(data[key]);
    if (items.length !== data[key].length) throw new Error(`备份字段 ${key} 含有损坏记录。`);
    return items;
  };
  const dailyLogs = checked("daily_logs", normalizeDailyLogs);
  const quotes = checked("quotes", normalizeQuotes);
  const notes = checked("notes", v => normalizeCollection(v, isNote));
  const reports = checked("review_reports", v => normalizeCollection(v, isReviewReport));
  const times = checked("time_entries", normalizeTimeEntries);
  const todos = checked("todos", v => normalizeCollection(v, isTodo)).map(t => ({ ...t, quadrant: normalizeQuadrant(t.quadrant), updatedAt: t.updatedAt ?? t.createdAt }));
  const life = data.life_path;
  if (life !== undefined) {
    if (!isRecord(life) || !Array.isArray(life.directions) || !Array.isArray(life.goals) ||
        !isRecord(life.mentor_plans) || !isRecord(life.week_plans) ||
        !life.directions.every(d => isRecord(d) && typeof d.id === "string" && typeof d.name === "string" && isStringArray(d.positiveActions) && isStringArray(d.negativeActions)) ||
        !life.goals.every(g => isRecord(g) && typeof g.id === "string" && typeof g.title === "string" && typeof g.targetValue === "number" && typeof g.currentValue === "number") ||
        !Object.values(life.week_plans).every(p => isRecord(p) && typeof p.weekKey === "string" && Array.isArray(p.tasks)) ||
        !Object.values(life.mentor_plans).every(p => isRecord(p) && typeof p.goalId === "string")) throw new Error("人生主线备份格式无效。");
  }
  const extras = data.extras === undefined ? {} : data.extras;
  if (!isRecord(extras)) throw new Error("扩展备份格式无效。");
  for (const key of BACKUP_EXTRA_KEYS) {
    const value = extras[key];
    if (value == null) continue;
    if (key === JOURNAL_DRAFTS_KEY && (!isRecord(value) || !Object.entries(value).every(([date, d]) => /^\d{4}-\d{2}-\d{2}$/.test(date) && isJournalDraft(d)))) throw new Error("草稿备份格式无效。");
    if (key.includes("themes") && !isStringArray(value)) throw new Error("主题备份格式无效。");
    if (key === "reviews" && (!isRecord(value) || !Object.values(value).every(bucket => isRecord(bucket) && Object.values(bucket).every(v => typeof v === "string")))) throw new Error("复盘备份格式无效。");
  }

  let lifeResult = { directions: 0, goals: 0, mentorPlans: 0, weekPlans: 0 };
  accountStorage.transaction(() => {
    for (const log of dailyLogs) {
      // Restore a deleted diary as a new record; its old tombstone stays valid.
      if (getDeletedIds("dailyLogs").has(log.id)) log.id = createId();
      queueDiary(log, getDailyLogs().find(l => l.id === log.id) ?? null);
    }
    setDailyLogs(mergeById(getDailyLogs(), dailyLogs));
    for (const [kind, items] of [["quotes", quotes], ["notes", notes], ["reviewReports", reports]] as const) {
      for (const item of items) if (getDeletedIds(kind).has(item.id)) item.id = createId();
    }
    setQuotes(mergeById(getQuotes(), quotes));
    setNotes(mergeById(getNotes(), notes));
    setReviewReports(mergeById(getReviewReports(), reports));
    setTimeEntries(mergeById(getTimeEntries(), times));
    for (const todo of todos) {
      if (readMap<TodoItem>("todo_deleted")[todo.id]) todo.id = createId();
      todo.updatedAt = new Date().toISOString();
    }
    setTodos(mergeById(getTodos(), todos));
    if (life !== undefined) {
      const incoming = life as unknown as LifePathBackupData;
      const current = getLifePathBackupData();
      lifeResult = importLifePathBackupData({
        directions: mergeById(current.directions, incoming.directions),
        goals: mergeById(current.goals, incoming.goals),
        mentor_plans: { ...current.mentor_plans, ...incoming.mentor_plans },
        week_plans: { ...current.week_plans, ...incoming.week_plans },
      }, false);
    }
    const importedSettings = normalizeMind365Settings(data.settings);
    writeSettings({ ...getSettings(), weeklyStudyTarget: importedSettings.weeklyStudyTarget, weeklyReadingTarget: importedSettings.weeklyReadingTarget });
    for (const key of BACKUP_EXTRA_KEYS) {
      const value = extras[key];
      if (value == null) continue;
      const current = JSON.parse(accountStorage.getItem(key) ?? (key.includes("themes") ? "[]" : "{}"));
      const merged = Array.isArray(value) ? [...new Set([...current, ...value])] : { ...current, ...value };
      accountStorage.setItem(key, JSON.stringify(merged));
    }
  });
  // Only start network work after the entire local transaction committed.
  const settings = getSettingsForSync();
  void refreshDailyLogs();
  void refreshTodos();
  void upsertRemoteQuotes(quotes, settings).catch(() => undefined);
  void upsertRemoteNotes(notes, settings).catch(() => undefined);
  void upsertRemoteReviewReports(reports, settings).catch(() => undefined);
  void upsertRemoteTimeEntries(times, settings).catch(() => undefined);
  void refreshLifePathState();
  return { dailyLogs: dailyLogs.length, notes: notes.length, quotes: quotes.length, reviewReports: reports.length, timeEntries: times.length, todos: todos.length, ...lifeResult };
}
