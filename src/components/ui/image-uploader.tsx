"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import { compressAndUpload } from "@/lib/image-storage";
import { captureStorageScope } from "@/lib/account-storage";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
  /** 紧凑模式：一行小缩略图 + 细长添加条 */
  compact?: boolean;
}

async function processFiles(
  files: FileList | File[],
  maxImages: number,
  current: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ next: string[]; errors: string[] }> {
  const active = captureStorageScope();
  const remaining = maxImages - current.length;
  if (remaining <= 0) return { next: current, errors: [] };
  const accepted = Array.from(files)
    .filter((f) => f.type.startsWith("image/"))
    .slice(0, remaining);
  const errors: string[] = [];
  const uploaded: string[] = [];
  for (let i = 0; i < accepted.length; i++) {
    if (!active()) break;
    onProgress?.(i, accepted.length);
    try {
      uploaded.push(await compressAndUpload(accepted[i]));
    } catch (e) {
      errors.push(`${accepted[i].name}: ${e instanceof Error ? e.message : "处理失败"}`);
    }
  }
  onProgress?.(accepted.length, accepted.length);
  return { next: [...current, ...uploaded], errors };
}

export function ImageUploader({ images, onChange, maxImages = 9, compact = false }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFiles = async (files: FileList | File[]) => {
    const active = captureStorageScope();
    setIsProcessing(true);
    setErrorMsg("");
    setProgress("准备上传...");
    try {
      const { next, errors } = await processFiles(files, maxImages, images, (done, total) => {
        setProgress(`正在上传 ${done + 1}/${total}...`);
      });
      if (!active()) return;
      onChange(next);
      if (errors.length > 0) setErrorMsg(errors.join("；"));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "图片处理失败");
    } finally {
      setIsProcessing(false);
      setProgress("");
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
    // Draft edits must not delete assets still referenced by the saved diary.
  };

  const canAdd = images.length < maxImages;

  // 紧凑模式：一行小缩略图 + 一条细长的添加条（心境随笔页底部使用）
  if (compact) {
    return (
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {images.map((src, i) => (
            <div
              className="group relative h-16 w-16 overflow-hidden rounded-[12px]"
              key={i}
              style={{ border: "1px solid var(--v5-rule)", boxShadow: "var(--v5-sh-1)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`日记图片 ${i + 1}`} className="h-full w-full object-cover" src={src} />
              <button
                aria-label="删除图片"
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => removeImage(i)}
                style={{ background: "rgba(0,0,0,0.55)" }}
                type="button"
              >
                <X color="white" size={11} />
              </button>
            </div>
          ))}

          {canAdd && (
            <div
              className="flex h-16 min-w-[220px] flex-1 cursor-pointer items-center gap-3 rounded-[12px] border border-dashed px-4 transition-colors hover:bg-[rgba(var(--v5-accent-rgb),0.05)]"
              onClick={() => inputRef.current?.click()}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
              style={{
                borderColor: isDragging ? "var(--v5-accent)" : "var(--v5-rule-strong)",
                background: isDragging ? "rgba(var(--v5-accent-rgb),0.08)" : "transparent",
              }}
            >
              {isProcessing ? (
                <Loader2 size={17} className="shrink-0 animate-spin" style={{ color: "var(--v5-accent)" }} />
              ) : (
                <ImagePlus size={17} className="shrink-0" style={{ color: "var(--v5-accent)" }} />
              )}
              <span style={{ fontFamily: "var(--v5-serif)", fontSize: 14.5, color: "var(--v5-ink3)" }}>
                {isProcessing ? progress : images.length ? `再加几张 · 还能加 ${maxImages - images.length} 张` : `添加照片 · 点击或拖进来，最多 ${maxImages} 张`}
              </span>
            </div>
          )}
        </div>

        {errorMsg && (
          <p className="text-xs" style={{ color: "var(--m-danger)" }}>
            {errorMsg}
          </p>
        )}

        <input
          accept="image/*"
          className="hidden"
          multiple
          onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }}
          ref={inputRef}
          type="file"
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <div
              className="group relative aspect-[4/3] overflow-hidden rounded-[20px] p-1 transition duration-300 hover:-translate-y-1"
              key={i}
              style={{
                background: "var(--m-paper-hi)",
                border: "1px solid var(--v5-rule)",
                boxShadow: "0 14px 30px rgba(var(--v5-shadow-rgb),0.10)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`日记图片 ${i + 1}`}
                className="h-full w-full rounded-[16px] object-cover transition duration-500 group-hover:scale-105"
                src={src}
              />
              <button
                aria-label="删除图片"
                className="absolute right-2 top-2 rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => removeImage(i)}
                style={{ background: "rgba(0,0,0,0.55)" }}
                type="button"
              >
                <X color="white" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {canAdd && (
        <div
          className="flex min-h-[154px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[24px] border border-dashed px-5 py-7 text-center transition duration-300 hover:-translate-y-0.5"
          onClick={() => inputRef.current?.click()}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          style={{
            borderColor: isDragging ? "var(--v5-accent)" : "var(--v5-rule-strong)",
            background: isDragging ? "var(--m-paper-lo)" : "var(--m-paper-soft)",
            boxShadow: "var(--m-shadow-in)",
          }}
        >
          <span
            className="grid h-12 w-12 place-items-center rounded-[18px]"
            style={{ background: "rgba(var(--v5-accent-rgb),0.08)", color: "var(--m-accent)" }}
          >
            {isProcessing ? <Loader2 size={21} className="animate-spin" /> : <ImagePlus size={21} />}
          </span>
          <p className="text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
            {isProcessing ? progress : `点击或拖拽图片到这里（最多 ${maxImages} 张，自动压缩上传）`}
          </p>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs" style={{ color: "var(--m-danger)" }}>
          {errorMsg}
        </p>
      )}

      <input
        accept="image/*"
        className="hidden"
        multiple
        onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ""; }}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
