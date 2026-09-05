// One atomic document per account; unowned legacy data remains in guest storage.
export const ACCOUNT_STORAGE_EVENT = "mind365:account-storage";
let scope = "guest";
let generation = 0;
let transaction: Record<string, string> | null = null;
const LEGACY_KEYS = [
  "daily_logs", "quotes", "notes", "settings", "review_reports", "time_entries", "todos",
  "reviews", "mind365_custom_themes", "mind365_hidden_themes",
  "mind365_life_directions", "mind365_life_goals", "mind365_mentor_plans", "mind365_week_plans",
  ...["directions", "goals", "mentor_plans", "week_plans"].map(k => `mind365_life_path_meta_${k}`),
  ...["daily-log", "note", "quote", "review-report"].map(k => `mind365-deleted-${k}-ids`),
];

export function getStorageScope() { return scope; }
export function captureStorageScope() {
  const captured = generation;
  return () => captured === generation;
}

export function setStorageUser(userId: string | null) {
  const next = userId ? `user:${userId}` : "guest";
  if (next === scope) return;
  scope = next;
  generation++;
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ACCOUNT_STORAGE_EVENT));
}

function readDocument(target = scope): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(`mind365:data:${target}`);
  if (raw !== null) {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        !Object.values(value).every(v => typeof v === "string")) {
      throw new Error("Local account data is invalid. Restore a backup before writing.");
    }
    return value as Record<string, string>;
  }
  if (target !== "guest") return {};
  const legacy: Record<string, string> = {};
  for (const key of LEGACY_KEYS) {
    const value = window.localStorage.getItem(key);
    if (value !== null) legacy[key] = value;
  }
  // Keep original keys untouched as a recovery copy.
  commit(legacy, target);
  return legacy;
}

function commit(data: Record<string, string>, target = scope) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`mind365:data:${target}`, JSON.stringify(data));
  window.dispatchEvent(new Event("mind365:storage"));
}

export const accountStorage = {
  getItem(key: string): string | null { return (transaction ?? readDocument())[key] ?? null; },
  setItem(key: string, value: string) {
    const data = transaction ?? readDocument();
    data[key] = value;
    if (!transaction) commit(data);
  },
  removeItem(key: string) {
    const data = transaction ?? readDocument();
    delete data[key];
    if (!transaction) commit(data);
  },
  transaction<T>(fn: () => T): T {
    if (transaction) return fn();
    transaction = readDocument();
    try {
      const result = fn();
      const data = transaction;
      transaction = null;
      commit(data);
      return result;
    } finally { transaction = null; }
  },
};

export function getGuestDocument() { return readDocument("guest"); }
