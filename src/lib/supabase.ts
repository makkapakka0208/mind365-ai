import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Mind365Settings } from "@/types";

export const DEFAULT_SETTINGS: Mind365Settings = {
  enableSupabaseSync: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  supabaseUserId: "",
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

  return {
    enableSupabaseSync: Boolean(record.enableSupabaseSync),
    supabaseUrl: asString(record.supabaseUrl),
    supabaseAnonKey: asString(record.supabaseAnonKey),
    supabaseUserId: isUuid(supabaseUserId) ? supabaseUserId : "",
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
  const envUserId = process.env.NEXT_PUBLIC_MIND365_USER_ID?.trim() ?? "";

  const url = settings.supabaseUrl || envUrl;
  const anonKey = settings.supabaseAnonKey || envAnonKey;
  const rawUserId = settings.supabaseUserId || envUserId;
  const userId = isUuid(rawUserId) ? rawUserId : "";
  const syncEnabled = settings.enableSupabaseSync || Boolean(envUrl && envAnonKey);

  if (!syncEnabled || !url || !anonKey || !userId) {
    return null;
  }

  return { anonKey, url, userId };
}

export function createMind365SupabaseClient(settings: Mind365Settings): SupabaseClient | null {
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

