import type { LucideIcon } from "lucide-react";

import { Illustration } from "@/components/ui/illustration";
import { Panel } from "@/components/ui/panel";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  illustrationSrc?: string;
  illustrationAlt?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  illustrationSrc,
  illustrationAlt = "empty state illustration",
}: EmptyStateProps) {
  return (
    <Panel className="overflow-hidden p-8 text-center">
      {illustrationSrc ? (
        <Illustration
          alt={illustrationAlt}
          className="mx-auto mb-4 max-w-xs"
          imageClassName="drop-shadow-xl"
          src={illustrationSrc}
        />
      ) : null}

      {Icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-gradient-to-r from-indigo-500/30 via-purple-500/25 to-pink-500/30 text-indigo-100 max-md:border-[var(--m-rule)] max-md:bg-[var(--m-base)] max-md:text-[var(--m-accent)] max-md:shadow-[4px_4px_10px_rgba(180,150,110,.45),-2px_-2px_6px_rgba(255,250,240,.9)]">
          <Icon size={22} />
        </div>
      ) : null}

      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-300">{description}</p>
    </Panel>
  );
}

