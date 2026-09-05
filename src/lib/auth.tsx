"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { setStorageUser } from "@/lib/account-storage";

// ── Auth-aware Supabase singleton ──────────────────────────────────────────

/** Fired on window whenever the signed-in user id changes (login/logout). */
export const AUTH_CHANGE_EVENT = "mind365:auth-changed";

let authClient: SupabaseClient | null = null;
let cachedAuthUserId: string | null = null;

function getOrCreateAuthClient(): SupabaseClient {
  if (authClient) return authClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  authClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
    },
  });

  // Keep a synchronously-readable user id for non-React callers (storage sync).
  const updateCachedUserId = (userId: string | null) => {
    const changed = cachedAuthUserId !== userId;
    cachedAuthUserId = userId;
    setStorageUser(userId);
    // 登录/登出后通知存储层重新同步（初始同步可能发生在会话恢复之前）
    if (changed && typeof window !== "undefined") {
      // Supabase auth callbacks run under a lock; start sync after it releases.
      window.setTimeout(() => window.dispatchEvent(new Event(AUTH_CHANGE_EVENT)), 0);
    }
  };
  authClient.auth.onAuthStateChange((_event, session) => {
    updateCachedUserId(session?.user?.id ?? null);
  });

  return authClient;
}

/**
 * Synchronous snapshot of the signed-in user's id (null when logged out or
 * the session hasn't hydrated yet). Safe to call from non-React modules.
 */
export function getCachedAuthUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    getOrCreateAuthClient();
  } catch {
    return null;
  }
  return cachedAuthUserId;
}

/**
 * Returns the auth-aware Supabase client singleton.
 * Can be called from non-React contexts (e.g. storage.ts).
 */
export function getAuthSupabaseClient(): SupabaseClient {
  return getOrCreateAuthClient();
}

// ── React Auth Context ─────────────────────────────────────────────────────

interface AuthContextValue {
  authConfigured: boolean;
  localMode: boolean;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function hasSupabaseAuthConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return Boolean(url && anonKey);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const authConfigured = hasSupabaseAuthConfig();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(authConfigured);

  useEffect(() => {
    if (!authConfigured) return;

    const client = getOrCreateAuthClient();

    // INITIAL_SESSION and subsequent changes use the same ordered event stream.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setStorageUser(session?.user?.id ?? null);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [authConfigured]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!authConfigured) {
      return { error: "当前未配置 Supabase 登录，已使用本地模式。" };
    }
    const client = getOrCreateAuthClient();
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, [authConfigured]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!authConfigured) {
      return { error: "当前未配置 Supabase 登录，已使用本地模式。" };
    }
    const client = getOrCreateAuthClient();
    const { error } = await client.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, [authConfigured]);

  const signOut = useCallback(async () => {
    if (!authConfigured) return;
    const client = getOrCreateAuthClient();
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }, [authConfigured]);

  return (
    <AuthContext.Provider
      key={user?.id ?? "guest"}
      value={{
        authConfigured,
        localMode: !authConfigured,
        user,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
