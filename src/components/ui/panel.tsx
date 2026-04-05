import type { HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  inset?: boolean;
}

export function Panel({ className, interactive = false, inset = false, ...props }: PanelProps) {
  return (
    <div
      className={cn(
        "rounded-2xl transition-all duration-300 ease-out",
        interactive && "transform-gpu hover:-translate-y-1 hover:scale-[1.02]",
        className,
      )}
      style={{
        background: inset ? "var(--m-base)" : "var(--m-base-light)",
        border: "1px solid var(--m-rule)",
        boxShadow: inset ? "var(--m-shadow-in)" : "var(--m-shadow-out)",
        color: "var(--m-ink)",
      }}
      {...props}
    />
  );
}
