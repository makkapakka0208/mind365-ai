"use client";

import { getAuthSupabaseClient } from "@/lib/auth";

/**
 * Base URL for the Next.js API routes.
 *
 * 在 Vercel 上（或 next dev）留空即可，走相对路径。
 * Capacitor 静态导出的 App 里没有 /api/* 路由，必须在构建时把
 * NEXT_PUBLIC_API_BASE_URL 设为已部署的站点地址（如 https://mind365.vercel.app），
 * 否则 AI 功能在 App 内全部失效。
 */
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

async function getAccessToken(): Promise<string | null> {
  try {
    const client = getAuthSupabaseClient();
    const { data } = await client.auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

/**
 * fetch wrapper for our own /api/* routes：
 * - 自动拼接 API base URL（Capacitor 打包必需）
 * - 自动附带 Supabase 登录 token（服务端用于鉴权）
 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const token = await getAccessToken();
  const headers = new Headers(init?.headers);
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return fetch(url, { ...init, headers });
}
