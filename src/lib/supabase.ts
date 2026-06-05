import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Mind365Settings } from "@/types";

export const DEFAULT_SETTINGS: Mind365Settings = {
  enableSupabaseSync: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseUserId: "",
  weeklyStudyTarget: 10,
  weeklyReadingTarget: 7,
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let cachedClient: SupabaseClient | null = null;
let cachedSignature = "";

function createUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value.trim());
}

export function createDefaultSupabaseUserId(): string {
  return createUuid();
}

export function normalizeMind365Settings(value: unknown): Mind365Settings {
  if (typeof value !== "object" || value === null) {
    return { ...DEFAULT_SETTINGS };
  }

  const record = value as Record<string, unknown>;
  const supabaseUserId = asString(record.supabaseUserId);

  const weeklyStudyTarget = typeof record.weeklyStudyTarget === "number" && record.weeklyStudyTarget > 0
    ? record.weeklyStudyTarget : DEFAULT_SETTINGS.weeklyStudyTarget;
  const weeklyReadingTarget = typeof record.weeklyReadingTarget === "number" && record.weeklyReadingTarget > 0
    ? record.weeklyReadingTarget : DEFAULT_SETTINGS.weeklyReadingTarget;

  return {
    enableSupabaseSync: Boolean(record.enableSupabaseSync),
    supabaseUrl: asString(record.supabaseUrl),
    supabaseAnonKey: asString(record.supabaseAnonKey),
    supabaseUserId: isUuid(supabaseUserId) ? supabaseUserId : "",
    weeklyStudyTarget,
    weeklyReadingTarget,
  };
}

export interface SupabaseConfig {
  anonKey: string;
  url: string;
  userId: string;
}

export function getSupabaseConfig(settings: Mind365Settings): SupabaseConfig | null {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  const url = settings.supabaseUrl || envUrl;
  const anonKey = settings.supabaseAnonKey || envAnonKey;

  // 当环境变量提供了 URL 和 Key 时，自动启用同步（用户无需手动开启）
  const hasEnvConfig = !!(envUrl && envAnonKey);
  const syncEnabled = settings.enableSupabaseSync || hasEnvConfig;

  if (!syncEnabled || !url || !anonKey) {
    return null;
  }

  // userId 优先使用 settings 里的，没有则自动生成并持久化
  let userId = settings.supabaseUserId;
  if (!isUuid(userId)) {
    userId = createDefaultSupabaseUserId();
  }

  return { anonKey, url, userId };
}

/**
 * Returns the auth-aware Supabase client if available (imported lazily to
 * avoid circular deps at module-eval time), falling back to the legacy
 * anon client when no auth module is loaded yet.
 */
export function createMind365SupabaseClient(settings: Mind365Settings): SupabaseClient | null {
  // Try the auth-aware singleton first
  try {
    // Dynamic require so this file can still be imported from server contexts
    // where auth.tsx (a "use client" module) isn't available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getAuthSupabaseClient } = require("@/lib/auth") as {
      getAuthSupabaseClient: () => SupabaseClient;
    };
    return getAuthSupabaseClient();
  } catch {
    // auth module not available — fall through to legacy client
  }

  const config = getSupabaseConfig(settings);

  if (!config) {
    return null;
  }

  const signature = `${config.url}::${config.anonKey}`;

  if (cachedClient && cachedSignature === signature) {
    return cachedClient;
  }

  cachedSignature = signature;
  cachedClient = createClient(config.url, config.anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedClient;
}
