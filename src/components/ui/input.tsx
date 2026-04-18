import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Input({ className, style, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl px-3 text-sm",
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
