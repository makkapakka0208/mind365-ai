import {
  createDefaultSupabaseUserId,
  createMind365SupabaseClient,
  DEFAULT_SETTINGS,
  getSupabaseConfig,
  normalizeMind365Settings,
} from "@/lib/supabase";
import { getAuthSupabaseClient } from "@/lib/auth";
import {
  getLifePathBackupData,
  importLifePathBackupData,
  type LifePathBackupData,
} from "@/lib/life-path-storage";
import { DailyLog, Mind365Settings, Note, Quote, ReviewReport, TimeEntry } from "@/types";

export const STORAGE_KEYS = {
  dailyLogs: "daily_logs",
  quotes: "quotes",
  notes: "notes",
  settings: "settings",
  reviewReports: "review_reports",
  timeEntries: "time_entries",
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
  review_reports: ReviewReport[];
  time_entries: TimeEntry[];
  life_path: LifePathBackupData;
}

export interface BackupImportResult {
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
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

let refreshPromise: Promise<DailyLog[]> | null = null;
let refreshSignature = "";

function dispatchStorageChange() {
  if (typeof window === "undefined") return;
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
  const raw = window.localStorage.getItem(key);
  if (!raw) return [];
  try {
    return normalizeCollection(JSON.parse(raw) as unknown, guard);
  } catch {
    return [];
  }
}

function readDailyLogs(): DailyLog[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.dailyLogs);
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
    window.localStorage.setItem(key, JSON.stringify(data));
    dispatchStorageChange();
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
  const raw = window.localStorage.getItem(STORAGE_KEYS.settings);
  if (raw === null) return { ...DEFAULT_SETTINGS };
  try { return JSON.parse(raw) as unknown; } catch { return { ...DEFAULT_SETTINGS }; }
}

function writeSettings(settings: Mind365Settings) {
  if (typeof window === "undefined") return settings;
  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
  dispatchStorageChange();
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
    createdAt: log.createdAt, date: log.date, mood: log.mood,
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

function mergeDailyLogs(localLogs: DailyLog[], remoteLogs: DailyLog[]): DailyLog[] {
  const merged = new Map<string, DailyLog>();
  for (const log of remoteLogs) merged.set(log.id, log);
  for (const log of localLogs) merged.set(log.id, log);
  return normalizeDailyLogs([...merged.values()]);
}

function areDailyLogsEqual(left: DailyLog[], right: DailyLog[]): boolean {
  return JSON.stringify(normalizeDailyLogs(left)) === JSON.stringify(normalizeDailyLogs(right));
}

async function fetchRemoteDailyLogs(settings: Mind365Settings): Promise<DailyLog[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config) return [];
  const { data, error } = await client.from("diaries").select("id, user_id, content, ai_analysis, created_at").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = Array.isArray(data) ? (data as SupabaseDiaryRow[]) : [];
  return normalizeDailyLogs(rows.map(parseDiaryRow).filter((log): log is DailyLog => log !== null));
}

async function fetchRemoteQuotes(settings: Mind365Settings): Promise<Quote[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config) return [];
  const { data, error } = await client.from("quotes").select("*").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalizeQuotes(
    Array.isArray(data)
      ? data.map((item) => ({
          ...(isRecord(item) ? item : {}),
          createdAt:
            isRecord(item) && typeof item.created_at === "string"
              ? item.created_at
              : new Date().toISOString(),
        }))
      : [],
  );
}

async function fetchRemoteNotes(settings: Mind365Settings): Promise<Note[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config) return [];
  const { data, error } = await client.from("notes").select("*").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return normalizeCollection(data, isNote);
}

async function fetchRemoteTimeEntries(settings: Mind365Settings): Promise<TimeEntry[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
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

async function fetchRemoteReviewReports(settings: Mind365Settings): Promise<ReviewReport[]> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config) return [];
  const { data, error } = await client.from("review_reports").select("*").eq("user_id", config.userId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!Array.isArray(data)) return [];
  return data
    .map((row: Record<string, unknown>) => {
      try {
        const content = typeof row.content === "string" ? JSON.parse(row.content) : row.content;
        const candidate = { ...(isRecord(content) ? content : {}), id: row.id, createdAt: typeof row.created_at === "string" ? row.created_at : new Date().toISOString() };
        return isReviewReport(candidate) ? candidate : null;
      } catch { return null; }
    })
    .filter((r): r is ReviewReport => r !== null);
}

async function upsertRemoteDailyLogs(logs: DailyLog[], settings: Mind365Settings): Promise<boolean> {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config || logs.length === 0) return false;
  const payload = logs.map((log) => ({ ai_analysis: null, content: serializeDailyLog(log), created_at: log.createdAt, id: log.id, user_id: config.userId }));
  const { error } = await client.from("diaries").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

async function upsertRemoteQuotes(quotes: Quote[], settings: Mind365Settings) {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config || quotes.length === 0) return false;
  const payload = quotes.map((q) => ({
    id: q.id,
    user_id: config.userId,
    created_at: q.createdAt,
    text: q.text,
    author: q.author,
    book: q.book,
    tags: q.tags,
  }));
  const { error } = await client.from("quotes").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

async function upsertRemoteNotes(notes: Note[], settings: Mind365Settings) {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
  if (!client || !config || notes.length === 0) return false;
  const payload = notes.map((n) => ({ id: n.id, user_id: config.userId, title: n.title, content: n.content, tags: n.tags }));
  const { error } = await client.from("notes").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return true;
}

async function upsertRemoteTimeEntries(entries: TimeEntry[], settings: Mind365Settings) {
  const client = createMind365SupabaseClient(settings);
  const config = getSupabaseConfig(settings);
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
  const config = getSupabaseConfig(settings);
  if (!client || !config || reports.length === 0) return false;
  const payload = reports.map((r) => ({
    id: r.id, user_id: config.userId, created_at: r.createdAt,
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
 * Try to get the authenticated user's ID from the Supabase auth session.
 * Returns null if not authenticated or not in a browser context.
 *
 * The auth client caches the session in memory; we mirror that cache here
 * and refresh it in the background so every sync call gets the latest ID.
 */
let _cachedAuthUserId: string | null = null;

function getAuthUserId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const client = getAuthSupabaseClient();
    // Kick off a background refresh — the result is used on the *next* call
    client.auth.getSession().then(({ data: { session } }) => {
      _cachedAuthUserId = session?.user?.id ?? null;
    });
    return _cachedAuthUserId;
  } catch {
    return null;
  }
}

/**
 * Eagerly initialize the auth user ID cache.
 * Called once at module load in browser contexts so that the first
 * sync operation already has the correct user ID.
 */
if (typeof window !== "undefined") {
  try {
    const client = getAuthSupabaseClient();
    client.auth.getSession().then(({ data: { session } }) => {
      _cachedAuthUserId = session?.user?.id ?? null;
    });
    // Also listen for future auth changes
    client.auth.onAuthStateChange((_event, session) => {
      _cachedAuthUserId = session?.user?.id ?? null;
    });
  } catch {
    // Auth module not available yet — will be populated on first getAuthUserId() call
  }
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

export async function refreshDailyLogs(options?: { force?: boolean }): Promise<DailyLog[]> {
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getSupabaseConfig(settings);
  if (!config) return readDailyLogs();
  const signature = `${config.url}::${config.userId}`;
  if (!options?.force && refreshPromise && refreshSignature === signature) return refreshPromise;
  refreshSignature = signature;
  refreshPromise = (async () => {
    const localLogs = readDailyLogs();
    try {
      const remoteLogs = await fetchRemoteDailyLogs(settings);
      const mergedLogs = mergeDailyLogs(localLogs, remoteLogs);
      if (!areDailyLogsEqual(localLogs, mergedLogs)) writeCollection(STORAGE_KEYS.dailyLogs, mergedLogs);
      if (!areDailyLogsEqual(remoteLogs, mergedLogs)) await upsertRemoteDailyLogs(mergedLogs, settings);
      return mergedLogs;
    } catch { return localLogs; }
    finally { refreshPromise = null; }
  })();
  return refreshPromise;
}

export async function refreshQuotes(): Promise<Quote[]> {
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getSupabaseConfig(settings);
  if (!config) return getQuotes();
  const local = getQuotes();
  try {
    const remote = await fetchRemoteQuotes(settings);
    const merged = new Map<string, Quote>();
    for (const q of remote) merged.set(q.id, q);
    for (const q of local) merged.set(q.id, q);
    const mergedArr = [...merged.values()];
    setQuotes(mergedArr);
    const remoteIds = new Set(remote.map((q) => q.id));
    const toUpload = mergedArr.filter((q) => !remoteIds.has(q.id));
    if (toUpload.length > 0) await upsertRemoteQuotes(toUpload, settings);
    return mergedArr;
  } catch { return local; }
}

export async function refreshNotes(): Promise<Note[]> {
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getSupabaseConfig(settings);
  if (!config) return getNotes();
  const local = getNotes();
  try {
    const remote = await fetchRemoteNotes(settings);
    const merged = new Map<string, Note>();
    for (const n of remote) merged.set(n.id, n);
    for (const n of local) merged.set(n.id, n);
    const mergedArr = [...merged.values()];
    setNotes(mergedArr);
    const remoteIds = new Set(remote.map((n) => n.id));
    const toUpload = mergedArr.filter((n) => !remoteIds.has(n.id));
    if (toUpload.length > 0) await upsertRemoteNotes(toUpload, settings);
    return mergedArr;
  } catch { return local; }
}

export async function refreshReviewReports(): Promise<ReviewReport[]> {
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getSupabaseConfig(settings);
  if (!config) return getReviewReports();
  const local = getReviewReports();
  try {
    const remote = await fetchRemoteReviewReports(settings);
    const merged = new Map<string, ReviewReport>();
    for (const r of remote) merged.set(r.id, r);
    for (const r of local) merged.set(r.id, r);
    const mergedArr = [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setReviewReports(mergedArr);
    const remoteIds = new Set(remote.map((r) => r.id));
    const toUpload = mergedArr.filter((r) => !remoteIds.has(r.id));
    if (toUpload.length > 0) await upsertRemoteReviewReports(toUpload, settings);
    return mergedArr;
  } catch { return local; }
}

export async function refreshTimeEntries(): Promise<TimeEntry[]> {
  if (typeof window === "undefined") return [];
  const settings = getSettingsForSync();
  const config = getSupabaseConfig(settings);
  if (!config) return getTimeEntries();
  const local = getTimeEntries();
  try {
    const remote = await fetchRemoteTimeEntries(settings);
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
  const logs = getDailyLogs();
  const normalized: DailyLog = { ...log, id: log.id || createId(), createdAt: log.createdAt || new Date().toISOString() };
  const updated = normalizeDailyLogs([normalized, ...logs]);
  setDailyLogs(updated);
  try {
    const synced = await withTimeout(upsertRemoteDailyLogs([normalized], getSettingsForSync()), 8000, false);
    return { logs: updated, synced };
  } catch { return { logs: updated, synced: false }; }
}

export async function updateDailyLog(nextLog: DailyLog): Promise<DailyLogMutationResult> {
  const logs = getDailyLogs();
  const updatedLog: DailyLog = { ...nextLog, id: nextLog.id || createId(), createdAt: nextLog.createdAt || new Date().toISOString() };
  const updated = normalizeDailyLogs(logs.map((log) => (log.id === updatedLog.id ? updatedLog : log)));
  setDailyLogs(updated);
  try {
    const synced = await withTimeout(upsertRemoteDailyLogs([updatedLog], getSettingsForSync()), 8000, false);
    return { logs: updated, synced };
  } catch { return { logs: updated, synced: false }; }
}

export async function deleteDailyLog(id: string): Promise<DailyLogMutationResult> {
  const logs = getDailyLogs().filter((log) => log.id !== id);
  setDailyLogs(logs);
  try {
    const settings = getSettingsForSync();
    const config = getSupabaseConfig(settings);
    const client = createMind365SupabaseClient(settings);
    if (config && client) {
      const deleteOp = client.from("diaries").delete().eq("id", id).eq("user_id", config.userId);
      await withTimeout(Promise.resolve(deleteOp), 8000, undefined as unknown as Awaited<typeof deleteOp>);
    }
    return { logs, synced: true };
  } catch { return { logs, synced: false }; }
}

export function getQuotes(): Quote[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.quotes);
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

export function getNotes(): Note[] { return readCollection(STORAGE_KEYS.notes, isNote); }
export function setNotes(notes: Note[]) { writeCollection(STORAGE_KEYS.notes, notes); }

export async function saveNote(note: Note): Promise<Note[]> {
  const updated = [note, ...getNotes()];
  setNotes(updated);
  try { await upsertRemoteNotes([note], getSettingsForSync()); } catch {}
  return updated;
}

export function getReviewReports(): ReviewReport[] { return readCollection(STORAGE_KEYS.reviewReports, isReviewReport); }
export function setReviewReports(reports: ReviewReport[]) { writeCollection(STORAGE_KEYS.reviewReports, reports); }

export function getTimeEntries(): TimeEntry[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(STORAGE_KEYS.timeEntries);
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
  return reports;
}

export function getMind365BackupData(): Mind365BackupData {
  return {
    daily_logs: getDailyLogs(),
    notes: getNotes(),
    quotes: getQuotes(),
    settings: getSettings(),
    review_reports: getReviewReports(),
    time_entries: getTimeEntries(),
    life_path: getLifePathBackupData(),
  };
}

export function downloadMind365Backup(filename = "mind365-backup.json") {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(getMind365BackupData(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}

export function importMind365Backup(raw: string): BackupImportResult {
  if (typeof window === "undefined") throw new Error("Import is only available in browser.");
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch { throw new Error("Invalid JSON file."); }
  if (!isRecord(parsed)) throw new Error("Invalid backup format.");

  const dailyLogs = normalizeDailyLogs(parsed.daily_logs);
  const quotes = normalizeQuotes(parsed.quotes);
  const notes = normalizeCollection(parsed.notes, isNote);
  const settings = normalizeMind365Settings(parsed.settings);
  const reviewReports = normalizeCollection(parsed.review_reports, isReviewReport);
  const timeEntries = normalizeTimeEntries(parsed.time_entries);
  const lifePath = Object.prototype.hasOwnProperty.call(parsed, "life_path")
    ? importLifePathBackupData(parsed.life_path)
    : { directions: 0, goals: 0, mentorPlans: 0, weekPlans: 0 };

  window.localStorage.setItem(STORAGE_KEYS.dailyLogs, JSON.stringify(dailyLogs));
  window.localStorage.setItem(STORAGE_KEYS.quotes, JSON.stringify(quotes));
  window.localStorage.setItem(STORAGE_KEYS.notes, JSON.stringify(notes));
  window.localStorage.setItem(STORAGE_KEYS.reviewReports, JSON.stringify(reviewReports));
  window.localStorage.setItem(STORAGE_KEYS.timeEntries, JSON.stringify(timeEntries));
  window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({ ...settings, supabaseUserId: settings.supabaseUserId || createDefaultSupabaseUserId() }));

  dispatchStorageChange();
  const syncSettings = getSettingsForSync();
  void upsertRemoteDailyLogs(dailyLogs, syncSettings).catch(() => undefined);
  void upsertRemoteQuotes(quotes, syncSettings).catch(() => undefined);
  void upsertRemoteNotes(notes, syncSettings).catch(() => undefined);
  void upsertRemoteReviewReports(reviewReports, syncSettings).catch(() => undefined);
  void upsertRemoteTimeEntries(timeEntries, syncSettings).catch(() => undefined);

  return {
    dailyLogs: dailyLogs.length,
    directions: lifePath.directions,
    goals: lifePath.goals,
    mentorPlans: lifePath.mentorPlans,
    notes: notes.length,
    quotes: quotes.length,
    reviewReports: reviewReports.length,
    timeEntries: timeEntries.length,
    weekPlans: lifePath.weekPlans,
  };
}
