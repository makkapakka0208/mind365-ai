import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Panel({ className, interactive = false, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-white/10 shadow-xl backdrop-blur-md",
        "transition-all duration-300 ease-out",
        interactive &&
          "transform-gpu hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-900/35",
        "max-md:border-[var(--m-rule)] max-md:bg-[var(--m-base-light)] max-md:text-[var(--m-ink)] max-md:shadow-[4px_4px_10px_rgba(180,150,110,.45),-2px_-2px_6px_rgba(255,250,240,.9)] max-md:backdrop-blur-none",
        className,
      )}
      {...props}
    />
  );
}

