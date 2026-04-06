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
        description="把长期记录变成可读的趋势图，理解自己的节奏和变化。"
        eyebrow="数据看板"
        icon={ChartColumnBig}
        title="数据看板"
      />

      {sorted.length === 0 ? (
        <EmptyState
          description="还没有可分析的数据。先连续记录几天，图表就会开始出现。"
          icon={Sparkles}
          illustrationAlt="ideas illustration"
          illustrationSrc="/illustrations/ideas.svg"
          title="暂无分析数据"
        />
      ) : (
        <>
          <StaggerItem index={0}>
            <Panel className="grid items-center gap-4 p-5 lg:grid-cols-[1.25fr_1fr]" interactive>
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>成长快照</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  你已累计记录 {metrics.entries} 条日记，平均情绪 {metrics.averageMood}/10，总学习
                  {metrics.totalStudyHours.toFixed(1)} 小时，总阅读 {metrics.totalReadingHours.toFixed(1)} 小时。
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
              <SummaryCard hint="累计写下的日记数量" label="记录条数" value={`${metrics.entries}`} />
            </StaggerItem>
            <StaggerItem index={2}>
              <SummaryCard icon={Smile} label="平均情绪" value={`${metrics.averageMood}/10`} />
            </StaggerItem>
            <StaggerItem index={3}>
              <SummaryCard icon={BrainCircuit} label="学习总时长" value={`${metrics.totalStudyHours.toFixed(1)} h`} />
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
                description="长期情绪趋势"
                labels={moodSeries.labels}
                title="情绪趋势"
              />
            </StaggerItem>
            <StaggerItem index={6}>
              <BarChartCard
                data={studySeries.data}
                datasetLabel="学习"
                description="学习时长变化"
                labels={studySeries.labels}
                title="学习时长"
              />
            </StaggerItem>
          </div>

          <StaggerItem index={7}>
            <LineChartCard
              data={readingSeries.data}
              datasetLabel="阅读"
              description="阅读习惯趋势"
              labels={readingSeries.labels}
              title="阅读趋势"
            />
          </StaggerItem>
        </>
      )}
    </PageTransition>
  );
}
