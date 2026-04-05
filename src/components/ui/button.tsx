import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-900/40 hover:brightness-110",
  secondary:
    "bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-900/40 hover:brightness-110",
  ghost:
    "bg-white/10 text-slate-100 border border-white/15 hover:bg-white/15",
  accent:
    "bg-gradient-to-r from-emerald-400 to-green-500 text-white shadow-lg shadow-emerald-900/30 hover:brightness-110",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium",
        "transition-all duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "hover:-translate-y-0.5 hover:scale-[1.02]",
        variants[variant],
        sizes[size],
        "max-md:shadow-[4px_4px_10px_rgba(180,150,110,.45),-2px_-2px_6px_rgba(255,250,240,.9)] max-md:font-[Noto_Serif_SC,serif]",
        className,
      )}
      type={type}
      {...props}
    />
  );
}

