"use client";

import { BookOpen, BrainCircuit, CalendarRange, CheckCircle2, Loader2, Save, Smile, Sparkles } from "lucide-react";
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
import { buildChartSeries, buildReadingChartSeries, computeSummary, getCurrentYearLogs, getCurrentYearQuotes } from "@/lib/analytics";
import { formatDate, getYearRange, toISODate } from "@/lib/date";
import { saveReviewReport } from "@/lib/storage";
import { useQuotesStore, useSyncedDailyLogs } from "@/lib/storage-store";
import type { ReviewReport } from "@/types";

export default function YearlyReviewPage() {
  const { logs: allLogs, isSyncing } = useSyncedDailyLogs();
  const allQuotes = useQuotesStore();
  const yearLogs = getCurrentYearLogs(allLogs);
  const yearQuotes = getCurrentYearQuotes(allQuotes);
  const metrics = computeSummary(yearLogs, yearQuotes);
  const moodSeries = buildChartSeries(yearLogs, (log) => log.mood);
  const studySeries = buildChartSeries(yearLogs, (log) => log.studyHours);
  const readingSeries = buildReadingChartSeries(yearLogs, yearQuotes);
  const range = getYearRange();

  const [notes, setNotes] = useState("");
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSaveReport = async () => {
    setIsSavingReport(true);
    const year = range.start.getFullYear();
    const report: ReviewReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      period: "year",
      rangeStart: toISODate(range.start),
      rangeEnd: toISODate(range.end),
      title: `${year} 年度复盘`,
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
        description="把一年里的心境、学习和阅读轨迹放在一起，看到真正的长期变化。"
        eyebrow="年度复盘"
        icon={CalendarRange}
        rightSlot={
          <div className="rounded-xl px-4 py-2 text-sm" style={{ background: "var(--m-base-light)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-out)" }}>
            {formatDate(toISODate(range.start))} - {formatDate(toISODate(range.end))}
          </div>
        }
        title="年度复盘"
      />

      {isSyncing ? (
        <Panel className="flex items-center gap-3 p-7" style={{ color: "var(--m-ink2)" }}>
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">正在同步数据…</span>
        </Panel>
      ) : yearLogs.length === 0 ? (
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
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>年度快照</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  今年共记录 {metrics.entries} 条日记，平均情绪 {metrics.averageMood}/10，学习
                  {metrics.totalStudyHours.toFixed(1)} 小时，阅读 {metrics.totalReadingHours.toFixed(1)} 小时。
                </p>
              </div>
              <Illustration alt="yearly reflection illustration" className="mx-auto max-w-[230px]" src="/illustrations/among-nature.svg" />
            </Panel>
          </StaggerItem>

          <StaggerItem index={1}>
            <AiReflectionPanel emptyMessage="当前无法生成年度 AI 复盘。" logs={yearLogs} period="year" range={range} summary={metrics} title="年度 AI 复盘" />
          </StaggerItem>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StaggerItem index={2}><SummaryCard icon={Smile} label="平均情绪" value={`${metrics.averageMood}/10`} /></StaggerItem>
            <StaggerItem index={3}><SummaryCard icon={BrainCircuit} label="学习总时长" value={`${metrics.totalStudyHours.toFixed(1)} h`} /></StaggerItem>
            <StaggerItem index={4}><SummaryCard icon={BookOpen} label="阅读总时长" tone="accent" value={`${metrics.totalReadingHours.toFixed(1)} h`} /></StaggerItem>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StaggerItem index={5}><LineChartCard data={moodSeries.data} datasetLabel="情绪" description="查看年度情绪变化趋势" labels={moodSeries.labels} title="年度情绪趋势" /></StaggerItem>
            <StaggerItem index={6}><BarChartCard data={studySeries.data} datasetLabel="学习" description="查看年度学习投入变化" labels={studySeries.labels} title="年度学习时长" /></StaggerItem>
          </div>

          <StaggerItem index={7}>
            <LineChartCard data={readingSeries.data} datasetLabel="阅读" description="查看年度阅读节奏" labels={readingSeries.labels} title="年度阅读时长" />
          </StaggerItem>

          {/* 保存复盘 */}
          <StaggerItem index={8}>
            <Panel className="space-y-4 p-6">
              <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>保存年度复盘</h3>
              <p className="text-sm" style={{ color: "var(--m-ink3)" }}>写下这一年的感悟或总结（选填），然后归档到复盘档案。</p>
              <Textarea
                className="min-h-28"
                disabled={saved}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="这一年最重要的变化是……明年最想做到的是……"
                value={notes}
              />
              {saved ? (
                <div className="flex items-center gap-3">
                  <p className="flex items-center gap-2 text-sm" style={{ color: "var(--m-success)" }}>
                    <CheckCircle2 size={16} /> 已保存到复盘档案
                  </p>
                  <Link className="text-sm transition-colors" href="/review-history" style={{ color: "var(--m-accent)" }}>
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
