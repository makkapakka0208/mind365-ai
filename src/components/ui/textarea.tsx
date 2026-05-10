import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Textarea({ className, style, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-[22px] px-4 py-3 text-sm",
        "transition-all duration-300 ease-out",
        "focus:outline-none focus:ring-4 focus:ring-[rgba(214,154,84,0.13)]",
        className,
      )}
      style={{
        background:
          "linear-gradient(180deg, rgba(255,253,248,0.90), rgba(250,243,231,0.82))",
        border: "1px solid rgba(139,94,60,0.11)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78), 0 12px 28px rgba(122,79,43,0.05)",
        color: "var(--m-ink)",
        fontFamily: "'Noto Serif SC', serif",
        ...style,
      }}
      {...props}
    />
  );
}
