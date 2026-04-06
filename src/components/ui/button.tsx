import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary: "",
  secondary: "",
  ghost: "",
  accent: "",
};

const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "var(--m-accent)",
    color: "#fffaf3",
    boxShadow: "var(--m-shadow-out)",
  },
  secondary: {
    background: "#7e6046",
    color: "#fffaf3",
    boxShadow: "var(--m-shadow-out)",
  },
  ghost: {
    background: "var(--m-base-light)",
    color: "var(--m-ink2)",
    border: "1px solid var(--m-rule)",
    boxShadow: "var(--m-shadow-out)",
  },
  accent: {
    background: "var(--m-success)",
    color: "#fff",
    boxShadow: "var(--m-shadow-out)",
  },
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
  style,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl md:rounded-full font-semibold",
        "transition-all duration-300 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "hover:-translate-y-0.5 active:translate-y-0.5",
        variants[variant],
        sizes[size],
        className,
      )}
      style={{
        ...variantStyles[variant],
        fontFamily: "'Noto Serif SC', serif",
        ...style,
      }}
      type={type}
      {...props}
    />
  );
}
