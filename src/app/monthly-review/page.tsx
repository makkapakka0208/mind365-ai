"use client";

import { BookOpen, BrainCircuit, CalendarDays, CheckCircle2, Loader2, Save, Smile, Sparkles } from "lucide-react";
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
import { buildChartSeries, buildReadingChartSeries, computeSummary, getCurrentMonthLogs, getCurrentMonthQuotes } from "@/lib/analytics";
import { formatDate, getMonthRange, toISODate } from "@/lib/date";
import { saveReviewReport } from "@/lib/storage";
import { useQuotesStore, useSyncedDailyLogs } from "@/lib/storage-store";
import type { ReviewReport } from "@/types";

export default function MonthlyReviewPage() {
  const { logs: allLogs, isSyncing } = useSyncedDailyLogs();
  const allQuotes = useQuotesStore();
  const monthLogs = getCurrentMonthLogs(allLogs);
  const monthQuotes = getCurrentMonthQuotes(allQuotes);
  const metrics = computeSummary(monthLogs, monthQuotes);
  const moodSeries = buildChartSeries(monthLogs, (log) => log.mood);
  const studySeries = buildChartSeries(monthLogs, (log) => log.studyHours);
  const readingSeries = buildReadingChartSeries(monthLogs, monthQuotes);
  const range = getMonthRange();

  const [notes, setNotes] = useState("");
  const [isSavingReport, setIsSavingReport] = useState(false);
  const [saved, setSaved] = useState(false);

  const onSaveReport = async () => {
    setIsSavingReport(true);
    const start = range.start;
    const title = `${start.getFullYear()} 年 ${start.getMonth() + 1} 月复盘`;
    const report: ReviewReport = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      period: "month",
      rangeStart: toISODate(range.start),
      rangeEnd: toISODate(range.end),
      title,
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
        description="汇总整个月的情绪、习惯和想法，看到更完整的成长路径。"
        eyebrow="月度复盘"
        icon={CalendarDays}
        rightSlot={
          <div className="rounded-xl px-4 py-2 text-sm" style={{ background: "var(--m-base-light)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-out)" }}>
            {formatDate(toISODate(range.start))} - {formatDate(toISODate(range.end))}
          </div>
        }
        title="月度复盘"
      />

      {isSyncing ? (
        <Panel className="flex items-center gap-3 p-7" style={{ color: "var(--m-ink2)" }}>
          <Loader2 className="animate-spin" size={18} />
          <span className="text-sm">正在同步数据…</span>
        </Panel>
      ) : monthLogs.length === 0 ? (
        <EmptyState
          description="本月还没有足够的数据。先写几条日记，再回来做月度复盘。"
          icon={Sparkles}
          illustrationAlt="nature illustration"
          illustrationSrc="/illustrations/among-nature.svg"
          title="暂无本月数据"
        />
      ) : (
        <>
          <StaggerItem index={0}>
            <Panel className="grid items-center gap-4 p-5 lg:grid-cols-[1.3fr_1fr]" interactive>
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>本月快照</h3>
                <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  本月共记录 {metrics.entries} 条日记，平均情绪 {metrics.averageMood}/10，学习
                  {metrics.totalStudyHours.toFixed(1)} 小时，阅读 {metrics.totalReadingHours.toFixed(1)} 小时。
                </p>
              </div>
              <Illustration alt="monthly reflection illustration" className="mx-auto max-w-[230px]" src="/illustrations/reading-time.svg" />
            </Panel>
          </StaggerItem>

          <StaggerItem index={1}>
            <AiReflectionPanel emptyMessage="当前无法生成月度 AI 复盘。" logs={monthLogs} period="month" range={range} summary={metrics} title="本月 AI 复盘" />
          </StaggerItem>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <StaggerItem index={2}><SummaryCard icon={Smile} label="平均情绪" value={`${metrics.averageMood}/10`} /></StaggerItem>
            <StaggerItem index={3}><SummaryCard icon={BrainCircuit} label="学习总时长" value={`${metrics.totalStudyHours.toFixed(1)} h`} /></StaggerItem>
            <StaggerItem index={4}><SummaryCard icon={BookOpen} label="阅读总时长" tone="accent" value={`${metrics.totalReadingHours.toFixed(1)} h`} /></StaggerItem>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <StaggerItem index={5}><LineChartCard data={moodSeries.data} datasetLabel="情绪" description="查看本月情绪变化" labels={moodSeries.labels} title="本月情绪趋势" /></StaggerItem>
            <StaggerItem index={6}><BarChartCard data={studySeries.data} datasetLabel="学习" description="查看本月每天的学习投入" labels={studySeries.labels} title="本月学习时长" /></StaggerItem>
          </div>

          <StaggerItem index={7}>
            <LineChartCard data={readingSeries.data} datasetLabel="阅读" description="查看本月阅读连续性" labels={readingSeries.labels} title="本月阅读时长" />
          </StaggerItem>

          {/* 保存复盘 */}
          <StaggerItem index={8}>
            <Panel className="space-y-4 p-6">
              <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>保存本月复盘</h3>
              <p className="text-sm" style={{ color: "var(--m-ink3)" }}>写下这个月的感悟或总结（选填），然后归档到复盘档案。</p>
              <Textarea
                className="min-h-28"
                disabled={saved}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="这个月最满意的事是……下个月的重点是……"
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
