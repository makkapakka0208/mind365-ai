"use client";

import { BookOpen, BrainCircuit, CalendarDays, Smile, Sparkles } from "lucide-react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { buildChartSeries, computeSummary, getCurrentMonthLogs, parseReadingHours } from "@/lib/analytics";
import { formatDate, getMonthRange, toISODate } from "@/lib/date";
import { useDailyLogsStore } from "@/lib/storage-store";

export default function MonthlyReviewPage() {
  const monthLogs = getCurrentMonthLogs(useDailyLogsStore());
  const metrics = computeSummary(monthLogs);
  const moodSeries = buildChartSeries(monthLogs, (log) => log.mood);
  const studySeries = buildChartSeries(monthLogs, (log) => log.studyHours);
  const readingSeries = buildChartSeries(monthLogs, (log) => parseReadingHours(log.reading));
  const range = getMonthRange();

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="See your growth pattern from a wider monthly perspective."
        eyebrow="Monthly Review"
        icon={CalendarDays}
        rightSlot={
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 backdrop-blur-md">
            {formatDate(toISODate(range.start))} - {formatDate(toISODate(range.end))}
          </div>
        }
        title="Monthly Review"
      />

      {monthLogs.length === 0 ? (
        <EmptyState
          description="No month data yet. Start a few entries to unlock monthly insights."
          icon={Sparkles}
          illustrationAlt="nature illustration"
          illustrationSrc="/illustrations/among-nature.svg"
          title="No monthly data"
        />
      ) : (
        <>
          <StaggerItem index={0}>
            <Panel className="grid items-center gap-4 p-5 lg:grid-cols-[1.3fr_1fr]" interactive>
              <div>
                <h3 className="text-base font-semibold text-slate-100">Monthly Snapshot</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  This month you logged {metrics.entries} entries, average mood {metrics.averageMood}/10,
                  study {metrics.totalStudyHours.toFixed(1)}h, reading {metrics.totalReadingHours.toFixed(1)}h.
                </p>
              </div>
              <Illustration
                alt="monthly reflection illustration"
                className="mx-auto max-w-[230px]"
                src="/illustrations/reading-time.svg"
              />
            </Panel>
          </StaggerItem>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StaggerItem index={1}>
              <SummaryCard icon={Smile} label="Average Mood" value={`${metrics.averageMood}/10`} />
            </StaggerItem>
            <StaggerItem index={2}>
              <SummaryCard
                icon={BrainCircuit}
                label="Total Study"
                value={`${metrics.totalStudyHours.toFixed(1)} h`}
              />
            </StaggerItem>
            <StaggerItem index={3}>
              <SummaryCard
                icon={BookOpen}
                label="Total Reading"
                tone="accent"
                value={`${metrics.totalReadingHours.toFixed(1)} h`}
              />
            </StaggerItem>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StaggerItem index={4}>
              <LineChartCard
                data={moodSeries.data}
                datasetLabel="Mood"
                description="Mood trend across the month"
                labels={moodSeries.labels}
                title="Monthly Mood"
              />
            </StaggerItem>
            <StaggerItem index={5}>
              <BarChartCard
                data={studySeries.data}
                datasetLabel="Study"
                description="Study focus trend by day"
                labels={studySeries.labels}
                title="Monthly Study"
              />
            </StaggerItem>
          </div>

          <StaggerItem index={6}>
            <LineChartCard
              data={readingSeries.data}
              datasetLabel="Reading"
              description="Reading consistency this month"
              labels={readingSeries.labels}
              title="Monthly Reading"
            />
          </StaggerItem>
        </>
      )}
    </PageTransition>
  );
}

