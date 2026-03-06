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
      <div className="pointer-events-none absolute -inset-5 rounded-full bg-gradient-to-r from-indigo-500/20 via-purple-500/18 to-pink-500/20 blur-3xl" />
      <Image
        alt={alt}
        className={cn("relative h-auto w-full", imageClassName)}
        height={height}
        src={src}
        width={width}
      />
    </div>
  );
}

