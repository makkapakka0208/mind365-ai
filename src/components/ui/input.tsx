import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-slate-100 backdrop-blur-sm",
        "placeholder:text-slate-400",
        "transition-all duration-300 ease-out",
        "focus:border-indigo-300/70 focus:outline-none focus:ring-2 focus:ring-indigo-400/30",
        className,
      )}
      {...props}
    />
  );
}

