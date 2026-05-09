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

function getOrCreateAuthClient(): SupabaseClient | null {
  if (authClient) return authClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !anonKey) return null;

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
export function getAuthSupabaseClient(): SupabaseClient | null {
  return getOrCreateAuthClient();
}

// ── React Auth Context ─────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState(false);

  useEffect(() => {
    const client = getOrCreateAuthClient();

    if (!client) {
      setConfigError(true);
      setLoading(false);
      return;
    }

    client.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = getOrCreateAuthClient();
    if (!client) return { error: "服务配置错误，请联系管理员" };
    const { error } = await client.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = getOrCreateAuthClient();
    if (!client) return { error: "服务配置错误，请联系管理员", needsEmailConfirmation: false };
    const { data, error } = await client.auth.signUp({ email, password });
    const needsEmailConfirmation = !error && data.user != null && data.session == null;
    return { error: error?.message ?? null, needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    const client = getOrCreateAuthClient();
    if (!client) return;
    await client.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, configError, signIn, signUp, signOut }}>
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
