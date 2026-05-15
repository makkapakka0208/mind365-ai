"use client";

import { ImagePlus, Loader2, X } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import { compressAndUpload, deleteImageFromStorage } from "@/lib/image-storage";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

async function processFiles(
  files: FileList | File[],
  maxImages: number,
  current: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ next: string[]; errors: string[] }> {
  const remaining = maxImages - current.length;
  if (remaining <= 0) return { next: current, errors: [] };
  const accepted = Array.from(files)
    .filter((f) => f.type.startsWith("image/"))
    .slice(0, remaining);
  const errors: string[] = [];
  const uploaded: string[] = [];
  for (let i = 0; i < accepted.length; i++) {
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

export function ImageUploader({ images, onChange, maxImages = 9 }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    setErrorMsg("");
    setProgress("准备上传...");
    try {
      const { next, errors } = await processFiles(files, maxImages, images, (done, total) => {
        setProgress(`正在上传 ${done + 1}/${total}...`);
      });
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
    const removed = images[index];
    onChange(images.filter((_, i) => i !== index));
    // Clean up from storage in background (best-effort)
    void deleteImageFromStorage(removed);
  };

  const canAdd = images.length < maxImages;

  return (
    <div className="grid gap-4">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((src, i) => (
            <div
              className="group relative aspect-[4/3] overflow-hidden rounded-[20px] p-1 transition duration-300 hover:-translate-y-1"
              key={i}
              style={{
                background: "rgba(255,253,248,0.88)",
                border: "1px solid rgba(139,94,60,0.10)",
                boxShadow: "0 14px 30px rgba(122,79,43,0.10)",
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
                style={{ background: "rgba(71,49,35,0.62)" }}
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
            borderColor: isDragging ? "rgba(214,154,84,0.62)" : "rgba(139,94,60,0.18)",
            background: isDragging
              ? "rgba(255,244,226,0.78)"
              : "linear-gradient(135deg, rgba(255,253,248,0.74), rgba(247,236,218,0.46))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 14px 30px rgba(122,79,43,0.06)",
          }}
        >
          <span
            className="grid h-12 w-12 place-items-center rounded-[18px]"
            style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
          >
            {isProcessing ? <Loader2 size={21} className="animate-spin" /> : <ImagePlus size={21} />}
          </span>
          <p className="text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
            {isProcessing ? progress : `点击或拖拽图片到这里（最多 ${maxImages} 张，自动压缩上传）`}
          </p>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs" style={{ color: "#C0392B" }}>
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
