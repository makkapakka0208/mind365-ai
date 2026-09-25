"use client";

import type { User } from "@supabase/supabase-js";

import { getAuthSupabaseClient, useAuth } from "@/lib/auth";

/**
 * 日记授权：用户是否允许 AI 读取日记正文。默认不允许。
 * 存在 Supabase 账号的 user_metadata 里，跟着账号走、服务端可验证
 * （服务端读取见 src/lib/server/api-guard.ts，字段名需保持一致）。
 * 未授权时 AI 功能只能使用统计数据（心情分、时长、篇数），不发送日记原文。
 */
export const DIARY_CONSENT_KEY = "ai_diary_access";

export function readDiaryConsent(user: User | null | undefined): boolean {
  return user?.user_metadata?.[DIARY_CONSENT_KEY] === true;
}

/** React：当前账号是否已授权。账号元数据更新后自动刷新。 */
export function useDiaryConsent(): boolean {
  return readDiaryConsent(useAuth().user);
}

/** 非 React 调用方：发请求前确认是否可以附带日记原文。 */
export async function hasDiaryConsent(): Promise<boolean> {
  try {
    const { data } = await getAuthSupabaseClient().auth.getSession();
    return readDiaryConsent(data.session?.user);
  } catch {
    return false;
  }
}

export async function setDiaryConsent(allowed: boolean): Promise<void> {
  const { error } = await getAuthSupabaseClient().auth.updateUser({
    data: { [DIARY_CONSENT_KEY]: allowed },
  });
  if (error) throw new Error(error.message);
}
