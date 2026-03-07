"use client";

import { BookOpen, BrainCircuit, CalendarClock, Smile, Sparkles } from "lucide-react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { AiReflectionPanel } from "@/components/review/ai-reflection-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import {
  buildChartSeries,
  computeSummary,
  getCurrentWeekLogs,
  parseReadingHours,
} from "@/lib/analytics";
import { formatDate, getWeekRange, toISODate } from "@/lib/date";
import { useDailyLogsStore } from "@/lib/storage-store";

export default function WeeklyReviewPage() {
  const weekLogs = getCurrentWeekLogs(useDailyLogsStore());
  const metrics = computeSummary(weekLogs);
  const moodSeries = buildChartSeries(weekLogs, (log) => log.mood);
  const studySeries = buildChartSeries(weekLogs, (log) => log.studyHours);
  const readingSeries = buildChartSeries(weekLogs, (log) => parseReadingHours(log.reading));
  const range = getWeekRange();

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把这一周的情绪、学习和阅读节奏放在一起看，复盘会更清晰。"
        eyebrow="周度复盘"
        icon={CalendarClock}
        rightSlot={
          <div className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm backdrop-blur-md">
            {formatDate(toISODate(range.start))} - {formatDate(toISODate(range.end))}
          </div>
        }
        title="周度复盘"
      />

      {weekLogs.length === 0 ? (
        <EmptyState
          description="本周还没有日记。先写一条记录，图表和 AI 复盘就会出现。"
          icon={Sparkles}
          illustrationAlt="reading illustration"
          illustrationSrc="/illustrations/reading-time.svg"
          title="暂无本周数据"
        />
      ) : (
        <>
          <StaggerItem index={0}>
            <Panel className="grid items-center gap-4 p-5 lg:grid-cols-[1.3fr_1fr]" interactive>
              <div>
                <h3 className="text-base font-semibold text-slate-100">本周快照</h3>
                <p className="mt-2 text-sm leading-7 text-slate-300">
                  你本周记录了 {metrics.entries} 天，平均情绪 {metrics.averageMood}/10，学习
                  {metrics.totalStudyHours.toFixed(1)} 小时，阅读 {metrics.totalReadingHours.toFixed(1)} 小时。
                </p>
              </div>
              <Illustration
                alt="weekly reflection illustration"
                className="mx-auto max-w-[230px]"
                src="/illustrations/relaxed-reading.svg"
              />
            </Panel>
          </StaggerItem>

          <StaggerItem index={1}>
            <AiReflectionPanel
              emptyMessage="当前无法生成本周 AI 复盘。"
              logs={weekLogs}
              period="week"
              range={range}
              summary={metrics}
              title="本周 AI 复盘"
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
                description="观察本周情绪起伏"
                labels={moodSeries.labels}
                title="本周情绪趋势"
              />
            </StaggerItem>
            <StaggerItem index={6}>
              <BarChartCard
                data={studySeries.data}
                datasetLabel="学习"
                description="查看每天的学习投入"
                labels={studySeries.labels}
                title="本周学习时长"
              />
            </StaggerItem>
          </div>

          <StaggerItem index={7}>
            <LineChartCard
              data={readingSeries.data}
              datasetLabel="阅读"
              description="查看本周阅读节奏"
              labels={readingSeries.labels}
              title="本周阅读时长"
            />
          </StaggerItem>
        </>
      )}
    </PageTransition>
  );
}

