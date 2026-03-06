"use client";

import { BookOpen, BrainCircuit, ChartColumnBig, Smile, Sparkles } from "lucide-react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { buildChartSeries, computeSummary, parseReadingHours, sortLogsByDate } from "@/lib/analytics";
import { useDailyLogsStore } from "@/lib/storage-store";

export default function AnalyticsPage() {
  const sorted = sortLogsByDate(useDailyLogsStore(), "asc");
  const metrics = computeSummary(sorted);
  const moodSeries = buildChartSeries(sorted, (log) => log.mood);
  const studySeries = buildChartSeries(sorted, (log) => log.studyHours);
  const readingSeries = buildChartSeries(sorted, (log) => parseReadingHours(log.reading));

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="Track your long-term behavior through clear and elegant growth signals."
        eyebrow="Data Dashboard"
        icon={ChartColumnBig}
        title="Data Dashboard"
      />

      {sorted.length === 0 ? (
        <EmptyState
          description="No analysis data yet. Log a few days to unlock visual growth insights."
          icon={Sparkles}
          illustrationAlt="ideas illustration"
          illustrationSrc="/illustrations/ideas.svg"
          title="No analytics data"
        />
      ) : (
        <>
          <StaggerItem index={0}>
            <Panel className="grid items-center gap-4 p-5 lg:grid-cols-[1.25fr_1fr]" interactive>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Growth Snapshot</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  You logged {metrics.entries} entries with average mood {metrics.averageMood}/10,
                  total study {metrics.totalStudyHours.toFixed(1)}h and reading {metrics.totalReadingHours.toFixed(1)}h.
                </p>
              </div>
              <Illustration
                alt="analytics inspiration illustration"
                className="mx-auto max-w-[230px]"
                src="/illustrations/among-nature.svg"
              />
            </Panel>
          </StaggerItem>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StaggerItem index={1}>
              <SummaryCard hint="Total logged entries" label="Entries" value={`${metrics.entries}`} />
            </StaggerItem>
            <StaggerItem index={2}>
              <SummaryCard icon={Smile} label="Average Mood" value={`${metrics.averageMood}/10`} />
            </StaggerItem>
            <StaggerItem index={3}>
              <SummaryCard icon={BrainCircuit} label="Study" value={`${metrics.totalStudyHours.toFixed(1)} h`} />
            </StaggerItem>
            <StaggerItem index={4}>
              <SummaryCard
                icon={BookOpen}
                label="Reading"
                tone="accent"
                value={`${metrics.totalReadingHours.toFixed(1)} h`}
              />
            </StaggerItem>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StaggerItem index={5}>
              <LineChartCard
                data={moodSeries.data}
                datasetLabel="Mood"
                description="Long-term mood trend"
                labels={moodSeries.labels}
                title="Mood Trend"
              />
            </StaggerItem>
            <StaggerItem index={6}>
              <BarChartCard
                data={studySeries.data}
                datasetLabel="Study"
                description="Study hours over time"
                labels={studySeries.labels}
                title="Study Hours"
              />
            </StaggerItem>
          </div>

          <StaggerItem index={7}>
            <LineChartCard
              data={readingSeries.data}
              datasetLabel="Reading"
              description="Reading habit trend"
              labels={readingSeries.labels}
              title="Reading Trend"
            />
          </StaggerItem>
        </>
      )}
    </PageTransition>
  );
}

