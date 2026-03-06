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
        className,
      )}
      {...props}
    />
  );
}

