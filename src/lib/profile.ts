"use client";

import { useSyncExternalStore } from "react";

import { ACCOUNT_STORAGE_EVENT, accountStorage } from "@/lib/account-storage";

/**
 * 个人资料（目前只有自定义头像）。
 * 存在当前账号的本地文档里（按账号隔离，游客也能用），头像裁成 256px 正方形 JPEG 的
 * data URL（约 20KB），不依赖云端存储，离线可用。
 */

export const PROFILE_KEY = "mind365_profile";

export interface Profile {
  avatar?: string;
}

const AVATAR_SIZE = 256;
const AVATAR_QUALITY = 0.86;

function readRaw(): string | null {
  try {
    return accountStorage.getItem(PROFILE_KEY);
  } catch {
    return null;
  }
}

function parse(raw: string | null): Profile {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    return value && typeof value === "object" ? (value as Profile) : {};
  } catch {
    return {};
  }
}

export function getProfile(): Profile {
  return parse(readRaw());
}

export function saveProfile(patch: Partial<Profile>) {
  const next: Profile = { ...getProfile(), ...patch };
  if (!next.avatar) delete next.avatar;
  accountStorage.setItem(PROFILE_KEY, JSON.stringify(next));
}

function subscribe(callback: () => void) {
  window.addEventListener("mind365:storage", callback);
  window.addEventListener(ACCOUNT_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("mind365:storage", callback);
    window.removeEventListener(ACCOUNT_STORAGE_EVENT, callback);
  };
}

/** 订阅原始字符串（快照稳定），再解析。 */
export function useProfile(): Profile {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return parse(raw);
}

/** 读图 → 居中裁成正方形 → 缩放到 256px → JPEG data URL。 */
export function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("请选择图片文件"));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片解码失败"));
    };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("浏览器不支持图片处理"));
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      resolve(canvas.toDataURL("image/jpeg", AVATAR_QUALITY));
    };
    img.src = url;
  });
}
