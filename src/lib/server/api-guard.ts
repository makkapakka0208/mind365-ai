import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side guard for the AI API routes.
 *
 * 鉴权：配置了 Supabase 时要求请求头携带有效的登录 token（防止部署后
 * 任何人白嫖 AI Key）；未配置 Supabase 时视为私有部署，放行。
 * 限流：单实例内存滑动窗口，按 用户ID/IP 限制调用频率。
 * 日记授权：用户是否允许 AI 读取日记正文，存在 Supabase 账号的 user_metadata
 * （ai_diary_access），由服务端从已验证的 token 读取——前端改不了、也漏不了。
 */

/** 账号元数据里的日记授权字段名（前端 src/lib/ai-consent.ts 写同一个字段）。 */
export const DIARY_CONSENT_KEY = "ai_diary_access";

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const requestLog = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (requestLog.get(key) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestLog.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
  // 防止 Map 无限增长
  if (requestLog.size > 10_000) {
    for (const [k, v] of requestLog) {
      if (v.every((t) => t <= cutoff)) requestLog.delete(k);
    }
  }
  return false;
}

async function verifyToken(
  token: string,
  url: string,
  anonKey: string,
): Promise<{ id: string; diaryConsent: boolean } | null> {
  try {
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, diaryConsent: data.user.user_metadata?.[DIARY_CONSENT_KEY] === true };
  } catch {
    return null;
  }
}

export type ApiAuthResult =
  | { error: NextResponse; diaryConsent: false }
  | { error: null; diaryConsent: boolean };

/**
 * 鉴权 + 限流，并返回用户是否授权 AI 读取日记正文。
 * error 非空时直接返回它；否则 diaryConsent 决定能否使用日记原文。
 */
export async function authorizeApiRequest(request: NextRequest): Promise<ApiAuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  let rateKey: string;
  let diaryConsent = false;

  if (supabaseUrl && supabaseAnonKey) {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const user = token ? await verifyToken(token, supabaseUrl, supabaseAnonKey) : null;
    if (!user) {
      return {
        error: NextResponse.json(
          { available: false, message: "请先登录后再使用 AI 功能。", reflection: null, data: null },
          { status: 401 },
        ),
        diaryConsent: false,
      };
    }
    rateKey = `user:${user.id}`;
    diaryConsent = user.diaryConsent;
  } else {
    // 私有部署（未配置 Supabase）：按 IP 限流即可；没有账号可存授权，视为不授权
    rateKey = `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;
  }

  if (isRateLimited(rateKey)) {
    return {
      error: NextResponse.json(
        { available: false, message: "请求过于频繁，请稍后再试。", reflection: null, data: null },
        { status: 429 },
      ),
      diaryConsent: false,
    };
  }

  return { error: null, diaryConsent };
}

/**
 * Returns null when the request may proceed, otherwise a ready-to-return
 * error response. 用于不涉及日记正文的接口。
 */
export async function guardApiRequest(request: NextRequest): Promise<NextResponse | null> {
  return (await authorizeApiRequest(request)).error;
}
