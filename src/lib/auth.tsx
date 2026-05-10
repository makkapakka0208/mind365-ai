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

// ── Auth-aware Supabase singleton ──────────────────────────────────────────

let authClient: SupabaseClient | null = null;

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

  return authClient;
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authConfigured) {
      setUser(null);
      setLoading(false);
      return;
    }

    const client = getOrCreateAuthClient();

    // Get initial session
    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
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
    await client.auth.signOut();
  }, [authConfigured]);

  return (
    <AuthContext.Provider
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
