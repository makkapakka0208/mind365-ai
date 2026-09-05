"use client";

import { getAuthSupabaseClient } from "@/lib/auth";
import { getActiveSyncConfig } from "@/lib/supabase";
import { getSettings } from "@/lib/storage";
import { captureStorageScope } from "@/lib/account-storage";

const BUCKET_NAME = "diary-images";

/** Check if a string is a base64 data URL */
export function isBase64DataUrl(str: string): boolean {
  return str.startsWith("data:");
}

/** Convert a base64 data URL to a Blob for upload */
function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

/** Get the Supabase client (auth-aware singleton) */
function getStorageClient() {
  try {
    return getAuthSupabaseClient();
  } catch {
    return null;
  }
}

/**
 * Get user ID for the storage path. Storage RLS requires the top-level
 * folder to equal auth.uid(), so we read it from the **live session**
 * right before upload（同步缓存可能尚未水合，会拿到过期/缺失的 ID，
 * 导致路径与 auth.uid() 不一致而被 RLS 拒绝）。
 */
async function getStorageUserId(): Promise<string | null> {
  const client = getStorageClient();
  if (client) {
    try {
      const { data } = await client.auth.getSession();
      const uid = data.session?.user?.id;
      if (uid) return uid;
    } catch {
      // fall through to manual config
    }
  }
  // 手动自建 Supabase（设置页显式开启）才允许用 settings 里的 ID
  const config = getActiveSyncConfig(getSettings(), null);
  return config?.userId ?? null;
}

/**
 * Upload a compressed image Blob to Supabase Storage.
 * Returns the public URL of the uploaded image.
 * Throws on failure — caller must handle the error.
 */
export async function uploadImageToStorage(file: Blob, filename?: string): Promise<string> {
  const active = captureStorageScope();
  const client = getStorageClient();
  if (!client) throw new Error("Supabase 未配置，无法上传图片。请检查环境变量配置。");

  const userId = await getStorageUserId();
  if (!active()) throw new Error("账号已切换，请重新选择图片。");
  if (!userId) throw new Error("请先登录，再上传图片（图片需要存入你自己的云端空间）。");

  const ext = file.type === "image/png" ? "png" : "jpg";
  const name = filename || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `${userId}/${name}`;

  // 文件名含时间戳+随机串不会冲突；upsert 会触发 storage 的
  // 先查后写流程，对 RLS 的要求更高，没必要用。
  const { error } = await client.storage
    .from(BUCKET_NAME)
    .upload(path, file, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    console.error("[image-storage] Upload failed:", error.message);
    if (/row-level security|violates|policy/i.test(error.message)) {
      throw new Error("图片上传被拒绝：当前登录状态无效或已过期，请退出后重新登录再试。");
    }
    throw new Error(`图片上传失败: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET_NAME)
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * Upload a base64 data URL to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadBase64ToStorage(dataUrl: string): Promise<string> {
  const blob = dataUrlToBlob(dataUrl);
  return uploadImageToStorage(blob);
}

/**
 * Compress a File to JPEG, then upload to Supabase Storage.
 * Returns the public URL.
 * Does NOT fall back to base64 — throws on failure so the user sees the actual error.
 */
export async function compressAndUpload(file: File): Promise<string> {
  const active = captureStorageScope();
  const MAX_DIMENSION = 1600;
  const JPEG_QUALITY = 0.78;

  const blob = await new Promise<Blob>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("图片解码失败"));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            const scale = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("浏览器不支持图片压缩")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("图片压缩失败"))),
            "image/jpeg",
            JPEG_QUALITY,
          );
        } catch (e) {
          reject(e instanceof Error ? e : new Error("图片处理失败"));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

  if (!active()) throw new Error("账号已切换，请重新选择图片。");
  return await uploadImageToStorage(blob);
}

/**
 * Migrate base64 images in a DailyLog's images array to Supabase Storage URLs.
 * Returns the updated array. Non-blocking — returns originals for any that fail.
 */
export async function migrateBase64Images(images: string[]): Promise<{ urls: string[]; changed: boolean }> {
  if (!images || images.length === 0) return { urls: images, changed: false };

  const client = getStorageClient();
  if (!client) return { urls: images, changed: false };

  let changed = false;
  const results = await Promise.all(
    images.map(async (img) => {
      if (!isBase64DataUrl(img)) return img; // already a URL
      try {
        const url = await uploadBase64ToStorage(img);
        changed = true;
        return url;
      } catch {
        return img; // keep original on failure
      }
    }),
  );

  return { urls: results, changed };
}

/**
 * Delete an image from Supabase Storage by its public URL.
 */
export async function deleteImageFromStorage(publicUrl: string): Promise<void> {
  if (isBase64DataUrl(publicUrl)) return;

  const client = getStorageClient();
  if (!client) return;

  try {
    const url = new URL(publicUrl);
    const pathPrefix = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const idx = url.pathname.indexOf(pathPrefix);
    if (idx === -1) return;
    const filePath = url.pathname.slice(idx + pathPrefix.length);
    await client.storage.from(BUCKET_NAME).remove([filePath]);
  } catch {
    // ignore deletion errors
  }
}
