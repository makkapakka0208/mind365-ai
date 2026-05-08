"use client";

import { ImagePlus, X } from "lucide-react";
import { DragEvent, useRef, useState } from "react";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

const MAX_DIMENSION = 1600; // 最长边像素
const JPEG_QUALITY = 0.78;

/** 压缩图片：等比缩放到最长边 1600px，重编码为 JPEG ~78% 质量 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("读取图片失败"));
    reader.onload = () => {
      const img = new Image();
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
          if (!ctx) {
            reject(new Error("浏览器不支持图片压缩"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          // 统一输出为 JPEG，体积小且兼容性好
          resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
        } catch (e) {
          reject(e instanceof Error ? e : new Error("图片处理失败"));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function processFiles(files: FileList | File[], maxImages: number, current: string[]): Promise<{ next: string[]; errors: string[] }> {
  const remaining = maxImages - current.length;
  if (remaining <= 0) return { next: current, errors: [] };
  const accepted = Array.from(files)
    .filter((f) => f.type.startsWith("image/"))
    .slice(0, remaining);
  const errors: string[] = [];
  const encoded: string[] = [];
  for (const file of accepted) {
    try {
      encoded.push(await compressImage(file));
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "处理失败"}`);
    }
  }
  return { next: [...current, ...encoded], errors };
}

export function ImageUploader({ images, onChange, maxImages = 9 }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    setErrorMsg("");
    try {
      const { next, errors } = await processFiles(files, maxImages, images);
      onChange(next);
      if (errors.length > 0) setErrorMsg(errors.join("；"));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "图片处理失败");
    } finally {
      setIsProcessing(false);
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
  };

  const canAdd = images.length < maxImages;

  return (
    <div className="grid gap-3">
      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {images.map((src, i) => (
            <div className="group relative aspect-square overflow-hidden rounded-xl" key={i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt={`日记图片 ${i + 1}`}
                className="h-full w-full object-cover"
                src={src}
              />
              <button
                aria-label="删除图片"
                className="absolute right-1 top-1 rounded-full p-0.5 opacity-0 transition-opacity group-hover:opacity-100"
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
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-5 transition-colors"
          onClick={() => inputRef.current?.click()}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          style={{
            borderColor: isDragging ? "var(--m-accent)" : "var(--m-rule)",
            background: isDragging ? "color-mix(in srgb, var(--m-accent) 6%, transparent)" : "var(--m-base)",
          }}
        >
          <ImagePlus size={20} style={{ color: "var(--m-ink3)" }} />
          <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
            {isProcessing ? "正在压缩图片..." : `点击或拖拽图片到这里（最多 ${maxImages} 张，自动压缩）`}
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
