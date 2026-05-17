"use client";

import Link from "next/link";
import { useMemo } from "react";

import { getNextAction } from "@/lib/home-insights";
import { useDailyLogsStore, useQuotesStore, useTimeEntriesStore } from "@/lib/storage-store";

// v5 "Calm-style Smart Action" — soft cream-yellow gradient pill at sidebar bottom.
export function SmartActionCard() {
  const logs = useDailyLogsStore();
  const quotes = useQuotesStore();
  const timeEntries = useTimeEntriesStore();
  const action = useMemo(() => getNextAction(logs, quotes, timeEntries), [logs, quotes, timeEntries]);

  return (
    <Link
      className="group block rounded-2xl p-4 transition-all"
      href={action.ctaHref}
      style={{
        background: "linear-gradient(135deg, #f7e7c8 0%, #ead4ad 100%)",
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
        下一步
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
          color: "var(--v5-accent)",
        }}
      >
        {action.ctaLabel.replace(/\s*→\s*$/, "")}
        <span style={{ fontSize: 14 }}>→</span>
      </div>
    </Link>
  );
}
