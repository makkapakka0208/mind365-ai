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
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-100">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-300">{hint}</p> : null}
        </div>

        <span className={`rounded-xl border border-white/15 p-2.5 shadow-lg shadow-indigo-900/20 ${iconClasses}`}>
          <Icon size={18} />
        </span>
      </div>
    </Panel>
  );
}
