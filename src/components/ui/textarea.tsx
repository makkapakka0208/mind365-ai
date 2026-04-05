import type { TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-32 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm text-slate-100 backdrop-blur-sm",
        "placeholder:text-slate-400",
        "transition-all duration-300 ease-out",
        "focus:border-indigo-300/70 focus:outline-none focus:ring-2 focus:ring-indigo-400/30",
        "max-md:border-[var(--m-rule)] max-md:bg-[var(--m-base)] max-md:text-[var(--m-ink)] max-md:shadow-[inset_2px_2px_6px_rgba(180,150,110,.45),inset_-2px_-2px_5px_rgba(255,250,240,.9)] max-md:backdrop-blur-none max-md:placeholder:text-[var(--m-ink3)] max-md:focus:border-[var(--m-accent)] max-md:focus:ring-[rgba(139,94,60,.18)]",
        className,
      )}
      {...props}
    />
  );
}

