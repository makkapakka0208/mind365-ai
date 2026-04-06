import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Textarea({ className, style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-xl px-3 py-2 text-sm",
        "transition-all duration-300 ease-out",
        "focus:outline-none",
        className,
      )}
      style={{
        background: "var(--m-base)",
        border: "1px solid var(--m-rule)",
        boxShadow: "var(--m-shadow-in)",
        color: "var(--m-ink)",
        fontFamily: "'Noto Serif SC', serif",
        ...style,
      }}
      {...props}
    />
  );
}
