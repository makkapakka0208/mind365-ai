"use client";

import { ImagePlus, X } from "lucide-react";
import { DragEvent, useRef, useState } from "react";

interface ImageUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function processFiles(files: FileList | File[], maxImages: number, current: string[]): Promise<string[]> {
  const remaining = maxImages - current.length;
  if (remaining <= 0) return current;
  const accepted = Array.from(files)
    .filter((f) => f.type.startsWith("image/"))
    .slice(0, remaining);
  const encoded = await Promise.all(accepted.map(fileToBase64));
  return [...current, ...encoded];
}

export function ImageUploader({ images, onChange, maxImages = 9 }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = async (files: FileList | File[]) => {
    const next = await processFiles(files, maxImages, images);
    onChange(next);
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
            点击或拖拽图片到这里（最多 {maxImages} 张）
          </p>
        </div>
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
