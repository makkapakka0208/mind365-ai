"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AIInsightSection } from "@/components/year-review/ai-insight-section";
import { GoalReviewCard } from "@/components/year-review/goal-review-card";
import { HighlightSection } from "@/components/year-review/highlight-section";
import { StatsGrid } from "@/components/year-review/stats-grid";
import { TrendChart } from "@/components/year-review/trend-chart";
import { YearSummaryCard } from "@/components/year-review/year-summary-card";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { useDailyLogsStore } from "@/lib/storage-store";
import { computeYearStats, generateYearSummary } from "@/lib/year-review";
import { YEAR_REVIEW_MOCK, adaptFromDailyLogs } from "@/lib/year-review-mock";
import type { YearReviewData, YearSummaryAI } from "@/types/year-review";

export default function YearReviewPage() {
  const allLogs = useDailyLogsStore();
  const [useMock, setUseMock] = useState(false);
  const [ai, setAi] = useState<YearSummaryAI | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  // Build the active data model (live or mock).
  const data: YearReviewData = useMemo(() => {
    if (useMock) return YEAR_REVIEW_MOCK;
    const live = adaptFromDailyLogs(allLogs, currentYear);
    // If the live year has nothing, fall back to mock so the page is never empty.
    return live.records.length === 0 ? YEAR_REVIEW_MOCK : live;
  }, [allLogs, currentYear, useMock]);

  const stats = useMemo(() => computeYearStats(data), [data]);

  // Single AI call per (year, record count) pair. Re-fires when user toggles mock.
  useEffect(() => {
    let cancelled = false;
    setIsAiLoading(true);
    setAi(null);
    generateYearSummary(data)
      .then((result) => {
        if (!cancelled) setAi(result);
      })
      .finally(() => {
        if (!cancelled) setIsAiLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const regenerate = () => {
    setIsAiLoading(true);
    setAi(null);
    generateYearSummary(data)
      .then((result) => setAi(result))
      .finally(() => setIsAiLoading(false));
  };

  const isShowingMock = data === YEAR_REVIEW_MOCK;

  return (
    <PageTransition className="space-y-6">
      {/* Dev toggle: mock vs live. Harmless in prod. */}
      <div className="flex items-center justify-end gap-3 text-xs" style={{ color: "var(--m-ink3)" }}>
        {isShowingMock ? (
          <span
            className="rounded-full px-2.5 py-0.5"
            style={{ background: "rgba(220,146,100,0.15)", color: "#B4584A" }}
          >
            示例数据
          </span>
        ) : null}
        <button
          className="rounded-full border px-3 py-1 transition hover:bg-[rgba(139,94,60,0.06)]"
          onClick={() => setUseMock((v) => !v)}
          style={{ borderColor: "var(--m-rule)" }}
          type="button"
        >
          {useMock ? "使用我的数据" : "查看示例"}
        </button>
      </div>

      {/* 1. Cover */}
      <StaggerItem index={0}>
        <YearSummaryCard summary={ai?.summary} year={data.year} />
      </StaggerItem>

      {/* 2. Stats overview */}
      <StaggerItem index={1}>
        <StatsGrid stats={stats} />
      </StaggerItem>

      {/* 3. Trend chart */}
      <StaggerItem index={2}>
        <TrendChart trend={stats.trend} />
      </StaggerItem>

      {/* 4. Goal review */}
      <StaggerItem index={3}>
        <GoalReviewCard goals={data.goals} />
      </StaggerItem>

      {/* 5. Highlights & low points */}
      <StaggerItem index={4}>
        <HighlightSection bestDays={stats.bestDays} worstDays={stats.worstDays} />
      </StaggerItem>

      {/* 6 + 7. AI insights + next year suggestions */}
      <StaggerItem index={5}>
        <div className="flex items-center justify-between gap-3">
          <h2
            className="text-lg font-semibold"
            style={{
              color: "var(--m-ink)",
              fontFamily: '"Noto Serif SC", serif',
              letterSpacing: "0.03em",
            }}
          >
            AI 年度解读
          </h2>
          <button
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition hover:-translate-y-0.5"
            disabled={isAiLoading}
            onClick={regenerate}
            style={{
              borderColor: "rgba(139,94,60,0.25)",
              color: "var(--m-ink2)",
              opacity: isAiLoading ? 0.6 : 1,
            }}
            type="button"
          >
            <RefreshCw className={isAiLoading ? "animate-spin" : ""} size={12} />
            重新生成
          </button>
        </div>
      </StaggerItem>

      <StaggerItem index={6}>
        <AIInsightSection ai={ai} isLoading={isAiLoading} />
      </StaggerItem>
    </PageTransition>
  );
}
