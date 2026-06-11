import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side guard for the AI API routes.
 *
 * 鉴权：配置了 Supabase 时要求请求头携带有效的登录 token（防止部署后
 * 任何人白嫖 AI Key）；未配置 Supabase 时视为私有部署，放行。
 * 限流：单实例内存滑动窗口，按 用户ID/IP 限制调用频率。
 */

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

async function verifyToken(token: string, url: string, anonKey: string): Promise<string | null> {
  try {
    const client = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.auth.getUser(token);
    if (error) return null;
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns null when the request may proceed, otherwise a ready-to-return
 * error response.
 */
export async function guardApiRequest(request: NextRequest): Promise<NextResponse | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  let rateKey: string;

  if (supabaseUrl && supabaseAnonKey) {
    const authHeader = request.headers.get("authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    const userId = token ? await verifyToken(token, supabaseUrl, supabaseAnonKey) : null;
    if (!userId) {
      return NextResponse.json(
        { available: false, message: "请先登录后再使用 AI 功能。", reflection: null, data: null },
        { status: 401 },
      );
    }
    rateKey = `user:${userId}`;
  } else {
    // 私有部署（未配置 Supabase）：按 IP 限流即可
    rateKey = `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;
  }

  if (isRateLimited(rateKey)) {
    return NextResponse.json(
      { available: false, message: "请求过于频繁，请稍后再试。", reflection: null, data: null },
      { status: 429 },
    );
  }

  return null;
}
