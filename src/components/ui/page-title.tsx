import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface PageTitleProps {
  title: string;
  description?: string;
  rightSlot?: ReactNode;
  eyebrow?: string;
  icon?: LucideIcon;
  align?: "left" | "center";
}

export function PageTitle({
  title,
  description,
  rightSlot,
  eyebrow,
  icon: Icon,
  align = "left",
}: PageTitleProps) {
  const centered = align === "center";

  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-5",
        centered ? "items-center text-center" : "sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className={cn("space-y-2", centered && "max-w-3xl")}>
        {eyebrow ? (
          <p className="text-xs font-medium tracking-[0.16em]" style={{ color: "var(--m-ink3)" }}>
            {eyebrow}
          </p>
        ) : null}

        <div className={cn("flex items-center gap-3", centered && "justify-center")}>
          {Icon ? (
            <span
              className="rounded-xl p-2"
              style={{
                background: "var(--m-base-light)",
                border: "1px solid var(--m-rule)",
                boxShadow: "var(--m-shadow-out)",
                color: "var(--m-accent)",
              }}
            >
              <Icon size={18} />
            </span>
          ) : null}
          <h2
            className="text-2xl font-semibold tracking-tight sm:text-3xl"
            style={{ color: "var(--m-ink)" }}
          >
            {title}
          </h2>
        </div>

        {description ? (
          <p className="text-sm leading-7 sm:text-[15px]" style={{ color: "var(--m-ink2)" }}>
            {description}
          </p>
        ) : null}
      </div>

      {rightSlot ? (
        <div className="text-sm" style={{ color: "var(--m-ink2)" }}>
          {rightSlot}
        </div>
      ) : null}
    </div>
  );
}
