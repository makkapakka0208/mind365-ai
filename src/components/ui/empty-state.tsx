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
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: "var(--m-base)",
            border: "1px solid var(--m-rule)",
            boxShadow: "var(--m-shadow-out)",
            color: "var(--m-accent)",
          }}
        >
          <Icon size={22} />
        </div>
      ) : null}

      <h3 className="text-lg font-semibold" style={{ color: "var(--m-ink)" }}>{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7" style={{ color: "var(--m-ink2)" }}>{description}</p>
    </Panel>
  );
}
