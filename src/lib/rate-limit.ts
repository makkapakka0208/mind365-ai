const STORAGE_KEY = "ai_rate_limits";

type RateLimitStore = Record<string, Record<string, number>>;

function read(): RateLimitStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as RateLimitStore;
  } catch {
    return {};
  }
}

function write(store: RateLimitStore): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getUsageCount(feature: string, periodKey: string): number {
  return read()[feature]?.[periodKey] ?? 0;
}

export function incrementUsage(feature: string, periodKey: string): number {
  const store = read();
  if (!store[feature]) store[feature] = {};
  const next = (store[feature][periodKey] ?? 0) + 1;
  store[feature][periodKey] = next;
  write(store);
  return next;
}

export function isAllowed(feature: string, periodKey: string, limit: number): boolean {
  return getUsageCount(feature, periodKey) < limit;
}

export function getRemainingCount(feature: string, periodKey: string, limit: number): number {
  return Math.max(0, limit - getUsageCount(feature, periodKey));
}
