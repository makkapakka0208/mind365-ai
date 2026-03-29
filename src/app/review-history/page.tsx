"use client";

import { motion } from "framer-motion";
import { Archive, BookOpen, BrainCircuit, CalendarDays, Smile, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date";
import { deleteReviewReport } from "@/lib/storage";
import { useReviewReportsStore } from "@/lib/storage-store";
import type { ReviewReport } from "@/types";

const PERIOD_LABEL: Record<ReviewReport["period"], string> = {
  week: "周度",
  month: "月度",
  year: "年度",
};

const PERIOD_COLOR: Record<ReviewReport["period"], string> = {
  week: "bg-indigo-500/20 text-indigo-200 border-indigo-400/30",
  month: "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
  year: "bg-pink-500/20 text-pink-200 border-pink-400/30",
};

function groupByYear(reports: ReviewReport[]): Record<string, ReviewReport[]> {
  return reports.reduce<Record<string, ReviewReport[]>>((acc, r) => {
    const year = r.rangeStart.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(r);
    return acc;
  }, {});
}

export default function ReviewHistoryPage() {
  const reports = useReviewReportsStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const onDelete = async (id: string) => {
    if (!window.confirm("确认删除这条复盘记录？")) return;
    setDeletingId(id);
    await deleteReviewReport(id);
    setDeletingId(null);
  };

  const grouped = groupByYear(reports);
  const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="这里保存了你手动归档的每一次周、月、年度复盘快照。"
        eyebrow="复盘档案"
        icon={Archive}
        title="复盘档案"
      />

      {reports.length === 0 ? (
        <EmptyState
          description="还没有保存过复盘记录。去周度、月度或年度复盘页，点击「保存复盘」按钮归档。"
          icon={Archive}
          illustrationAlt="archive illustration"
          illustrationSrc="/illustrations/relaxed-reading.svg"
          title="暂无复盘档案"
        />
      ) : (
        <div className="space-y-8">
          {years.map((year, yi) => (
            <StaggerItem index={yi} key={year}>
              <div className="space-y-3">
                <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
                  {year} 年
                </h2>
                <div className="grid gap-3">
                  {grouped[year].map((report, ri) => (
                    <motion.div
                      animate={{ opacity: 1, y: 0 }}
                      initial={{ opacity: 0, y: 6 }}
                      key={report.id}
                      transition={{ delay: ri * 0.04, duration: 0.25, ease: "easeOut" }}
                    >
                      <Panel className="p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${PERIOD_COLOR[report.period]}`}>
                                {PERIOD_LABEL[report.period]}复盘
                              </span>
                              <span className="text-base font-semibold text-slate-100">{report.title}</span>
                            </div>

                            <p className="flex items-center gap-1.5 text-xs text-slate-400">
                              <CalendarDays size={12} />
                              {formatDate(report.rangeStart)} — {formatDate(report.rangeEnd)}
                            </p>

                            <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-300">
                              <span className="flex items-center gap-1.5">
                                <Smile size={14} className="text-indigo-300" />
                                平均情绪 {report.metrics.averageMood}/10
                              </span>
                              <span className="flex items-center gap-1.5">
                                <BrainCircuit size={14} className="text-cyan-300" />
                                学习 {report.metrics.totalStudyHours.toFixed(1)} h
                              </span>
                              <span className="flex items-center gap-1.5">
                                <BookOpen size={14} className="text-pink-300" />
                                阅读 {report.metrics.totalReadingHours.toFixed(1)} h
                              </span>
                              <span className="text-slate-400">共 {report.metrics.entries} 条日记</span>
                            </div>

                            {report.notes ? (
                              <p className="mt-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm leading-7 text-slate-200 whitespace-pre-wrap">
                                {report.notes}
                              </p>
                            ) : null}
                          </div>

                          <Button
                            disabled={deletingId === report.id}
                            onClick={() => onDelete(report.id)}
                            variant="ghost"
                            size="sm"
                          >
                            <Trash2 size={15} className="text-rose-400" />
                          </Button>
                        </div>
                      </Panel>
                    </motion.div>
                  ))}
                </div>
              </div>
            </StaggerItem>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 text-sm text-slate-400">
        <Link className="hover:text-slate-200 transition-colors" href="/weekly-review">→ 去做周度复盘</Link>
        <Link className="hover:text-slate-200 transition-colors" href="/monthly-review">→ 去做月度复盘</Link>
        <Link className="hover:text-slate-200 transition-colors" href="/yearly-review">→ 去做年度复盘</Link>
      </div>
    </PageTransition>
  );
}
