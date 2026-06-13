"use client";

import Link from "next/link";
import { useMemo } from "react";

import { getNextAction } from "@/lib/home-insights";
import { getSettings } from "@/lib/storage";
import { useDailyLogsStore, useQuotesStore, useTimeEntriesStore } from "@/lib/storage-store";

// Tone variants — each maps to a pill background + eyebrow label + CTA color
// so the card changes look based on getNextAction's `tone` field (warm / alert / info).
// 色调以低饱和的方式叠在主题卡面上（color-mix），亮色/暗色都成立——
// 不再写死亮色渐变，避免深色下整块发亮。
const TONE_VARIANTS = {
  warm: {
    bg: "linear-gradient(135deg, color-mix(in oklab, var(--v5-amber), var(--v5-card) 80%), var(--v5-card))",
    eyebrow: "下一步",
    cta: "var(--v5-accent)",
  },
  alert: {
    bg: "linear-gradient(135deg, color-mix(in oklab, var(--v5-rose), var(--v5-card) 78%), var(--v5-card))",
    eyebrow: "需要关注",
    cta: "var(--m-danger)",
  },
  info: {
    bg: "linear-gradient(135deg, color-mix(in oklab, var(--v5-accent), var(--v5-card) 82%), var(--v5-card))",
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
  const { weeklyStudyTarget, weeklyReadingTarget } = useMemo(() => getSettings(), []);
  const action = useMemo(() => getNextAction(logs, quotes, timeEntries, new Date(), weeklyStudyTarget, weeklyReadingTarget), [logs, quotes, timeEntries, weeklyStudyTarget, weeklyReadingTarget]);
  const variant = TONE_VARIANTS[action.tone];

  return (
    <Link
      className="group block rounded-2xl p-4 transition-all"
      href={action.ctaHref}
      style={{
        background: variant.bg,
        color: "var(--v5-ink)",
        border: "1px solid var(--v5-rule)",
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
