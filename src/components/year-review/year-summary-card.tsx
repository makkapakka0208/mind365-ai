"use client";

import { Sparkles } from "lucide-react";

import { Illustration } from "@/components/ui/illustration";
import { Panel } from "@/components/ui/panel";

interface YearSummaryCardProps {
  year: number;
  /** Optional one-paragraph AI (or fallback) summary. */
  summary?: string;
}

/**
 * The cover / hero card that opens the Year Review page.
 * Intentionally silent about numbers — those live in StatsGrid.
 */
export function YearSummaryCard({ year, summary }: YearSummaryCardProps) {
  return (
    <Panel
      className="relative grid items-center gap-6 overflow-hidden p-6 md:grid-cols-[1.4fr_1fr] md:p-8"
      style={{
        background:
          "linear-gradient(180deg, #FCF6E8 0%, #F2E4CC 100%)",
        borderColor: "rgba(139,94,60,0.18)",
      }}
    >
      {/* 装饰：右上角的印章 */}
      <span
        aria-hidden
        className="absolute right-6 top-6 hidden rounded-sm px-2 py-1 text-[11px] tracking-[0.3em] md:block"
        style={{
          background: "rgba(180, 88, 70, 0.85)",
          color: "#fffaf3",
          transform: "rotate(3deg)",
          fontFamily: '"Noto Serif SC", serif',
        }}
      >
        ANNUAL
      </span>

      <div>
        <div
          className="mb-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] tracking-[0.2em]"
          style={{
            background: "rgba(139,94,60,0.08)",
            color: "rgba(124,90,58,0.85)",
            fontFamily: '"Noto Serif SC", serif',
          }}
        >
          <Sparkles size={12} />
          YEAR REVIEW
        </div>
        <h1
          className="text-4xl font-medium md:text-5xl"
          style={{
            color: "var(--m-ink)",
            fontFamily: '"Noto Serif SC", serif',
            letterSpacing: "0.04em",
          }}
        >
          {year} · 年度回看
        </h1>
        <p
          className="mt-4 max-w-xl text-[15px] leading-8"
          style={{
            color: "var(--m-ink2)",
            fontFamily: '"Noto Serif SC", serif',
          }}
        >
          {summary ??
            "把这一年的心境、投入与偏移放在一页纸上，再看一眼——不是为了打分，而是为了明年走得更稳。"}
        </p>
      </div>

      <div className="flex justify-center">
        <Illustration
          alt="year review illustration"
          className="max-w-[240px]"
          src="/illustrations/among-nature.svg"
        />
      </div>
    </Panel>
  );
}
