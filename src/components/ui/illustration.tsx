import Image from "next/image";

import { cn } from "@/lib/cn";

interface IllustrationProps {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  width?: number;
  height?: number;
}

export function Illustration({
  src,
  alt,
  className,
  imageClassName,
  width = 420,
  height = 320,
}: IllustrationProps) {
  return (
    <div className={cn("relative", className)}>
      <div
        className="pointer-events-none absolute inset-3 rounded-[28px]"
        style={{
          background: "linear-gradient(180deg, rgba(255,249,241,0.92), rgba(244,231,212,0.82))",
          boxShadow: "0 24px 40px rgba(180,150,110,0.14), inset 0 1px 0 rgba(255,255,255,0.7)",
        }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(180,150,110,0.18), transparent 72%)" }}
      />
      <Image
        alt={alt}
        className={cn("relative h-auto w-full rounded-[24px] p-5 drop-shadow-[0_18px_28px_rgba(110,78,51,0.12)]", imageClassName)}
        height={height}
        src={src}
        width={width}
      />
    </div>
  );
}

