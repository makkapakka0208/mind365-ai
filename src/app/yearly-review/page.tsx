"use client";

import { BookOpen, BrainCircuit, CalendarRange, Smile, Sparkles } from "lucide-react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { AiReflectionPanel } from "@/components/review/ai-reflection-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { buildChartSeries, computeSummary, getCurrentYearLogs, parseReadingHours } from "@/lib/analytics";
import { formatDate, getYearRange, toISODate } from "@/lib/date";
import { useDailyLogsStore } from "@/lib/storage-store";

export default function YearlyReviewPage() {
  const yearLogs = getCurrentYearLogs(useDailyLogsStore());
  const metrics = computeSummary(yearLogs);
  const moodSeries = buildChartSeries(yearLogs, (log) => log.mood);
  const studySeries = buildChartSeries(yearLogs, (log) => log.studyHours);
  const readingSeries = buildChartSeries(yearLogs, (log) => parseReadingHours(log.reading));
  const range = getYearRange();

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把一年里的心境、学习和阅读轨迹放在一起，看到真正的长期变化。"
        eyebrow="年度复盘"
        icon={CalendarRange}
        rightSlot={
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm backdrop-blur-md">
            {formatDate(toISODate(range.start))} - {formatDate(toISODate(range.end))}
          </div>
        }
        title="年度复盘"
      />

      {yearLogs.length === 0 ? (
        <EmptyState
          description="今年还没有足够的日记数据。持续记录一段时间后，这里会生成年度视角。"
          icon={Sparkles}
          illustrationAlt="nature illustration"
          illustrationSrc="/illustrations/among-nature.svg"
          title="暂无年度数据"
        />
      ) : (
        <>
          <StaggerItem index={0}>
            <Panel className="grid items-center gap-4 p-5 lg:grid-cols-[1.3fr_1fr]" interactive>
              <div>
                <h3 className="text-base font-semibold text-slate-100">年度快照</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  今年共记录 {metrics.entries} 条日记，平均情绪 {metrics.averageMood}/10，学习
                  {metrics.totalStudyHours.toFixed(1)} 小时，阅读 {metrics.totalReadingHours.toFixed(1)} 小时。
                </p>
              </div>
              <Illustration
                alt="yearly reflection illustration"
                className="mx-auto max-w-[230px]"
                src="/illustrations/among-nature.svg"
              />
            </Panel>
          </StaggerItem>

          <StaggerItem index={1}>
            <AiReflectionPanel
              emptyMessage="当前无法生成年度 AI 复盘。"
              logs={yearLogs}
              period="year"
              range={range}
              summary={metrics}
              title="年度 AI 复盘"
            />
          </StaggerItem>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StaggerItem index={2}>
              <SummaryCard icon={Smile} label="平均情绪" value={`${metrics.averageMood}/10`} />
            </StaggerItem>
            <StaggerItem index={3}>
              <SummaryCard
                icon={BrainCircuit}
                label="学习总时长"
                value={`${metrics.totalStudyHours.toFixed(1)} h`}
              />
            </StaggerItem>
            <StaggerItem index={4}>
              <SummaryCard
                icon={BookOpen}
                label="阅读总时长"
                tone="accent"
                value={`${metrics.totalReadingHours.toFixed(1)} h`}
              />
            </StaggerItem>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StaggerItem index={5}>
              <LineChartCard
                data={moodSeries.data}
                datasetLabel="情绪"
                description="查看年度情绪变化趋势"
                labels={moodSeries.labels}
                title="年度情绪趋势"
              />
            </StaggerItem>
            <StaggerItem index={6}>
              <BarChartCard
                data={studySeries.data}
                datasetLabel="学习"
                description="查看年度学习投入变化"
                labels={studySeries.labels}
                title="年度学习时长"
              />
            </StaggerItem>
          </div>

          <StaggerItem index={7}>
            <LineChartCard
              data={readingSeries.data}
              datasetLabel="阅读"
              description="查看年度阅读节奏"
              labels={readingSeries.labels}
              title="年度阅读时长"
            />
          </StaggerItem>
        </>
      )}
    </PageTransition>
  );
}

