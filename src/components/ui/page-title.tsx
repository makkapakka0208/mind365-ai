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
        {eyebrow ? <p className="text-xs font-medium tracking-[0.16em] text-slate-400">{eyebrow}</p> : null}

        <div className={cn("flex items-center gap-3", centered && "justify-center")}>
          {Icon ? (
            <span className="rounded-xl border border-white/15 bg-white/10 p-2 text-indigo-200 shadow-lg shadow-indigo-950/25">
              <Icon size={18} />
            </span>
          ) : null}
          <h2 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">{title}</h2>
        </div>

        {description ? <p className="text-sm leading-7 text-slate-300 sm:text-[15px]">{description}</p> : null}
      </div>

      {rightSlot ? <div className="text-sm text-slate-300">{rightSlot}</div> : null}
    </div>
  );
}

