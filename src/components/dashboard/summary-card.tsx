import type { LucideIcon } from "lucide-react";
import { Heart } from "lucide-react";

import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";

interface SummaryCardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  tone?: "primary" | "accent";
  className?: string;
}

export function SummaryCard({
  label,
  value,
  hint,
  icon: Icon = Heart,
  tone = "primary",
  className,
}: SummaryCardProps) {
  const iconClasses =
    tone === "accent"
      ? "bg-gradient-to-r from-cyan-400/30 to-blue-500/30 text-cyan-100"
      : "bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 text-indigo-100";

  return (
    <Panel className={cn("h-full p-5", className)} interactive>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.12em] text-slate-400 max-md:text-[var(--m-ink3)]">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-100 max-md:text-[var(--m-ink)]">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-300 max-md:text-[var(--m-ink2)]">{hint}</p> : null}
        </div>

        <span className={`rounded-xl border border-white/15 p-2.5 shadow-lg shadow-indigo-900/20 max-md:border-[var(--m-rule)] max-md:bg-[var(--m-base)] max-md:text-[var(--m-accent)] max-md:shadow-[4px_4px_10px_rgba(180,150,110,.45),-2px_-2px_6px_rgba(255,250,240,.9)] ${iconClasses}`}>
          <Icon size={18} />
        </span>
      </div>
    </Panel>
  );
}

