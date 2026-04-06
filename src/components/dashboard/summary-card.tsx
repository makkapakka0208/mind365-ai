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
  const [mainValue, unit = ""] = value.split(" ");

  return (
    <Panel className={cn("h-full p-5 md:p-6", className)} interactive>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.12em]" style={{ color: "var(--m-ink3)" }}>{label}</p>
          <p className="mt-3 flex items-end gap-1 tracking-tight">
            <span className="text-4xl font-semibold" style={{ color: "var(--m-ink)" }}>{mainValue}</span>
            {unit ? <span className="pb-1 text-sm font-medium" style={{ color: "var(--m-ink3)" }}>{unit}</span> : null}
          </p>
          {hint ? <p className="mt-2 text-sm" style={{ color: "var(--m-ink2)" }}>{hint}</p> : null}
        </div>

        <span
          className="rounded-2xl md:rounded-[18px] p-2.5"
          style={{
            background: "var(--m-base)",
            border: "1px solid var(--m-rule)",
            boxShadow: "var(--m-shadow-out)",
            color: "var(--m-accent)",
          }}
        >
          <Icon size={18} />
        </span>
      </div>
    </Panel>
  );
}
