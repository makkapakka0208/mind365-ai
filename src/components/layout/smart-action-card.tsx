"use client";

import Link from "next/link";
import { useMemo } from "react";

import { getNextAction } from "@/lib/home-insights";
import { useDailyLogsStore, useQuotesStore, useTimeEntriesStore } from "@/lib/storage-store";

// Tone variants — each maps to a pill background + eyebrow label + CTA color
// so the card changes look based on getNextAction's `tone` field (warm / alert / info).
const TONE_VARIANTS = {
  warm: {
    bg: "linear-gradient(135deg, #f7e7c8 0%, #ead4ad 100%)",
    eyebrow: "下一步",
    cta: "var(--v5-accent)",
  },
  alert: {
    bg: "linear-gradient(135deg, #f4d4c6 0%, #e0a892 100%)",
    eyebrow: "需要关注",
    cta: "#a13a25",
  },
  info: {
    bg: "linear-gradient(135deg, #efe6d4 0%, #d9c9a8 100%)",
    eyebrow: "本周节点",
    cta: "var(--v5-accent)",
  },
} as const;

// v5 "Calm-style Smart Action" — soft gradient pill at sidebar bottom.
// Visuals shift by tone (warm / alert / info) so the cue changes meaningfully:
//   • alert  — long gap, missed several days
//   • info   — weekly/monthly review window
//   • warm   — gentle nudge: write today / keep streak / on-track default
export function SmartActionCard() {
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();
  const timeEntries = useTimeEntriesStore();
  const action = useMemo(() => getNextAction(logs, quotes, timeEntries), [logs, quotes, timeEntries]);
  const variant = TONE_VARIANTS[action.tone];

  return (
    <Link
      className="group block rounded-2xl p-4 transition-all"
      href={action.ctaHref}
      style={{
        background: variant.bg,
        color: "var(--v5-ink)",
        boxShadow: "var(--v5-sh-1)",
        transitionDuration: "var(--v5-dur)",
        transitionTimingFunction: "var(--v5-ease)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--v5-sh-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--v5-sh-1)";
      }}
    >
      <div
        className="mb-2"
        style={{
          fontFamily: "var(--v5-sans)",
          fontSize: 11,
          letterSpacing: "0.04em",
          color: "var(--v5-ink2)",
        }}
      >
        {variant.eyebrow}
      </div>
      <div
        style={{
          fontFamily: "var(--v5-serif)",
          fontSize: 14.5,
          fontWeight: 500,
          lineHeight: 1.55,
          color: "var(--v5-ink)",
        }}
      >
        {action.message}
      </div>
      <div
        className="mt-3 inline-flex items-center gap-1"
        style={{
          fontFamily: "var(--v5-sans)",
          fontSize: 12.5,
          fontWeight: 500,
          color: variant.cta,
        }}
      >
        {action.ctaLabel.replace(/\s*→\s*$/, "")}
        <span style={{ fontSize: 14 }}>→</span>
      </div>
    </Link>
  );
}
