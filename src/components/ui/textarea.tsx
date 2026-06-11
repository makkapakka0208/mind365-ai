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
          "linear-gradient(180deg, var(--m-paper-hi), var(--m-paper-lo))",
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
