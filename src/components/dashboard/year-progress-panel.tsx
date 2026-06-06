"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { TimePendulum } from "@/components/dashboard/time-pendulum";
import { Panel } from "@/components/ui/panel";

const SERIF = '"Noto Serif SC", "Songti SC", serif';

function useYearProgress() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 5, 0);
    const ms = tomorrow.getTime() - Date.now();
    const t = setTimeout(() => setNow(new Date()), Math.max(1000, ms));
    return () => clearTimeout(t);
  }, [now]);
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const nextStart = new Date(year + 1, 0, 1);
  const DAY = 86400000;
  const daysInYear = Math.round((nextStart.getTime() - start.getTime()) / DAY);
  const daysPassed = Math.max(0, Math.min(daysInYear, Math.floor((now.getTime() - start.getTime()) / DAY) + 1));
  const daysRemaining = Math.max(0, daysInYear - daysPassed);
  const pct = Math.round((daysPassed / daysInYear) * 100);
  return { year, daysPassed, daysRemaining, pct };
}

/**
 * 时间摆 · year progress card with vintage pendulum clock.
 * Used on both /timeline and the desktop Home overview.
 */
export function YearProgressPanel({ summaryHref }: { summaryHref?: string }) {
  const { year, daysPassed, daysRemaining, pct } = useYearProgress();

  return (
    <Panel className="p-6 md:p-7">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
            TIME · 时间摆
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="text-[2.6rem] font-semibold leading-none tracking-[-0.04em]"
              style={{ color: "var(--m-ink)", fontFamily: SERIF }}
            >
              {year}
            </span>
            <span className="text-sm" style={{ color: "var(--m-ink3)" }}>
              年已过去
            </span>
          </div>
        </div>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
          style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
        >
          <CalendarDays size={18} />
        </span>
      </div>

      {/* Stats + pendulum */}
      <div className="mt-5 flex items-end gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-6">
            <div>
              <span
                className="block text-[2.2rem] font-semibold leading-none tracking-[-0.04em]"
                style={{ color: "var(--m-accent)", fontFamily: SERIF }}
              >
                {daysPassed}
              </span>
              <span className="mt-1 block text-xs" style={{ color: "var(--m-ink3)" }}>
                天已过
              </span>
            </div>
            <div className="h-9 w-px" style={{ background: "var(--m-rule)" }} />
            <div>
              <span
                className="block text-[2.2rem] font-light leading-none tracking-[-0.04em]"
                style={{ color: "var(--m-ink)", fontFamily: SERIF }}
              >
                {daysRemaining}
              </span>
              <span className="mt-1 block text-xs" style={{ color: "var(--m-ink3)" }}>
                天未至
              </span>
            </div>
          </div>

          {/* Subtitle */}
          <p className="mt-4 text-sm italic" style={{ color: "var(--m-ink2)", fontFamily: SERIF }}>
            已陪你走过 {daysPassed} 天，还有 {daysRemaining} 个明天等着你写下来。
          </p>

          {/* Progress line */}
          <div className="mt-4">
            <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: "rgba(139,94,60,0.1)" }}>
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, var(--m-accent), rgba(165,106,67,0.6))",
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>1 月</span>
              <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>已走完 {pct}%</span>
              <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>12 月</span>
            </div>
          </div>

          {summaryHref ? (
            <Link href={summaryHref} className="mt-4 inline-flex items-center gap-1 text-sm" style={{ color: "var(--m-accent)" }}>
              翻开 {year} 年度总结 →
            </Link>
          ) : null}
        </div>

        {/* Vintage clock + pendulum */}
        <div className="hidden w-32 shrink-0 sm:block">
          <TimePendulum />
        </div>
      </div>
    </Panel>
  );
}
