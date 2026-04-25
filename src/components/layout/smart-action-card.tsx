"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { getNextAction } from "@/lib/home-insights";
import { useDailyLogsStore, useQuotesStore } from "@/lib/storage-store";

const TONE_STYLES: Record<"warm" | "alert" | "info", { bg: string; ring: string; ink: string; cta: string }> = {
  warm: {
    bg: "rgba(255,236,202,0.55)",
    ring: "rgba(212,164,42,0.25)",
    ink: "#7A5F00",
    cta: "#A77A00",
  },
  alert: {
    bg: "rgba(220,90,60,0.08)",
    ring: "rgba(220,90,60,0.25)",
    ink: "#9B3B2A",
    cta: "#C0392B",
  },
  info: {
    bg: "var(--m-base)",
    ring: "var(--m-rule)",
    ink: "var(--m-ink)",
    cta: "var(--m-accent)",
  },
};

export function SmartActionCard() {
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();
  const action = useMemo(() => getNextAction(logs, quotes), [logs, quotes]);
  const tone = TONE_STYLES[action.tone];

  return (
    <Link
      className="group mt-auto block rounded-[20px] p-4 transition-all duration-300 hover:-translate-y-0.5"
      href={action.ctaHref}
      style={{
        background: tone.bg,
        border: `1px solid ${tone.ring}`,
        boxShadow: "var(--m-shadow-in)",
      }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--m-ink3)" }}>
        下一步
      </p>
      <p className="mt-2 text-sm leading-6" style={{ color: tone.ink }}>
        {action.message}
      </p>
      <span
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold transition-transform group-hover:translate-x-0.5"
        style={{ color: tone.cta }}
      >
        {action.ctaLabel.replace(/\s*→\s*$/, "")}
        <ArrowRight size={12} />
      </span>
    </Link>
  );
}
