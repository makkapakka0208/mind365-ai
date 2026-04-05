"use client";

import { BookOpen, BrainCircuit, CalendarClock, CheckCircle2, Loader2, Save, Smile, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import { LineChartCard } from "@/components/charts/line-chart-card";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { AiReflectionPanel } from "@/components/review/ai-reflection-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  buildChartSeries,
  computeSummary,
  getCurrentWeekLogs,
  parseReadingHours,
} from "@/lib/analytics";
import { formatDate, getWeekRange, toISODate } from "@/lib/date";
import { saveReviewReport } from "@/lib/storage";
import { useSyncedDailyLogs } from "@/lib/storage-store";
import type { ReviewReport } from "@/types";

function buildWeekTitle(range: { start: Date; end: Date }): string {
  const year = range.start.getFullYear();
  const startDate = toISODate(range.start);
  const month = range.start.getMonth() + 1;
  // 计算本年第几周
  const startOfYear = new Date(year, 0, 1);
  const weekNum = Math.ceil(((range.start.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `${year} 年第 ${weekNum} 周（${month}月${startDate.slice(8)} 起）`;
}

export default function WeeklyReviewPage() {
  const { logs: allLogs, isSyncing } = useSyncedDailyLogs();
  const weekLogs = getCurrentWeekLogs(allLogs);
  const metrics = computeSummary(weekLogs);
  const moodSeries = buildChartSeries(weekLogs, (log) => log.mood);
  const studySeries = buildChartSeries(weekLogs, (log) => log.studyHours);
  const readingSeries = buildChartSeries(weekLogs, (log) => parseReadingHours(log.reading));
  const range = getWeekRange();

  const [notes, setNotes] = useState("");
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSaveReport = async () => {
    setIsSavingReport(true);
    const report: ReviewReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      period: "week",
      rangeStart: toISODate(range.start),
      rangeEnd: toISODate(range.end),
      title: buildWeekTitle(range),
      metrics,
      notes: notes.trim(),
    };
    await saveReviewReport(report);
    setIsSavingReport(false);
    setSaved(true);
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="把这一周的情绪、学习和阅读节奏放在一起看，复盘会更清晰。"
        eyebrow="周度复盘"
        icon={CalendarClock}
        rightSlot={
          <div className="rounded-xl px-4 py-2 text-sm" style={{ background: "var(--m-base-light)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-out)" }}>
            {formatDate(toISODate(range.start))} - {formatDate(toISODate(range.end))}
          </div>
        }
        title="周度复盘"
      />

      {isSyncing ? (
        <Panel className="flex items-center gap-3 p-7" style={{ color: "var(--m-ink2)" }}>
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">正在同步数据…</span>
        </Panel>
      ) : weekLogs.length === 0 ? (
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
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>本周快照</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  你本周记录了 {metrics.entries} 天，平均情绪 {metrics.averageMood}/10，学习
                  {metrics.totalStudyHours.toFixed(1)} 小时，阅读 {metrics.totalReadingHours.toFixed(1)} 小时。
                </p>
              </div>
              <Illustration alt="weekly reflection illustration" className="mx-auto max-w-[230px]" src="/illustrations/relaxed-reading.svg" />
            </Panel>
          </StaggerItem>

          <StaggerItem index={1}>
            <AiReflectionPanel emptyMessage="当前无法生成本周 AI 复盘。" logs={weekLogs} period="week" range={range} summary={metrics} title="本周 AI 复盘" />
          </StaggerItem>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StaggerItem index={2}><SummaryCard icon={Smile} label="平均情绪" value={`${metrics.averageMood}/10`} /></StaggerItem>
            <StaggerItem index={3}><SummaryCard icon={BrainCircuit} label="学习总时长" value={`${metrics.totalStudyHours.toFixed(1)} h`} /></StaggerItem>
            <StaggerItem index={4}><SummaryCard icon={BookOpen} label="阅读总时长" tone="accent" value={`${metrics.totalReadingHours.toFixed(1)} h`} /></StaggerItem>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StaggerItem index={5}><LineChartCard data={moodSeries.data} datasetLabel="情绪" description="观察本周情绪起伏" labels={moodSeries.labels} title="本周情绪趋势" /></StaggerItem>
            <StaggerItem index={6}><BarChartCard data={studySeries.data} datasetLabel="学习" description="查看每天的学习投入" labels={studySeries.labels} title="本周学习时长" /></StaggerItem>
          </div>

          <StaggerItem index={7}>
            <LineChartCard data={readingSeries.data} datasetLabel="阅读" description="查看本周阅读节奏" labels={readingSeries.labels} title="本周阅读时长" />
          </StaggerItem>

          {/* 保存复盘 */}
          <StaggerItem index={8}>
            <Panel className="space-y-4 p-6">
              <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>保存本周复盘</h3>
              <p className="text-sm" style={{ color: "var(--m-ink3)" }}>写下这周的感悟或总结（选填），然后归档到复盘档案。</p>
              <Textarea
                className="min-h-28"
                disabled={saved}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="这周最大的收获是……下周想改变的是……"
                value={notes}
              />
              {saved ? (
                <div className="flex items-center gap-3">
                  <p className="flex items-center gap-2 text-sm" style={{ color: "var(--m-success)" }}>
                    <CheckCircle2 size={16} /> 已保存到复盘档案
                  </p>
                  <Link className="text-sm transition-colors" style={{ color: "var(--m-accent)" }} href="/review-history">
                    查看档案 →
                  </Link>
                </div>
              ) : (
                <Button disabled={isSavingReport} onClick={onSaveReport} variant="primary">
                  <Save className="mr-2" size={16} />
                  {isSavingReport ? "保存中…" : "保存复盘"}
                </Button>
              )}
            </Panel>
          </StaggerItem>
        </>
      )}
    </PageTransition>
  );
}
