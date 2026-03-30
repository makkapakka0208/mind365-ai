"use client";

import { motion } from "framer-motion";
import { Archive, BookOpen, BrainCircuit, CalendarDays, ChevronDown, ChevronUp, Smile, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
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
  return reports.reduce<Record<string, ReviewReport[]>>((acc, report) => {
    const year = report.rangeStart.slice(0, 4);
    if (!acc[year]) acc[year] = [];
    acc[year].push(report);
    return acc;
  }, {});
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ReviewHistoryPage() {
  const reports = useReviewReportsStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const onDelete = async (id: string) => {
    if (!window.confirm("确认删除这条复盘记录？")) return;
    setDeletingId(id);
    await deleteReviewReport(id);
    setExpandedId((current) => (current === id ? null : current));
    setDeletingId(null);
  };

  const grouped = groupByYear(reports);
  const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="这里保存了你手动归档的每一次周/月/年度复盘，点击“查看详情”可展开完整内容。"
        eyebrow="复盘档案"
        icon={Archive}
        title="复盘档案"
      />

      {reports.length === 0 ? (
        <EmptyState
          description="还没有保存过复盘记录。去周度、月度或年度复盘页，点击“保存复盘”按钮归档。"
          icon={Archive}
          illustrationAlt="archive illustration"
          illustrationSrc="/illustrations/relaxed-reading.svg"
          title="暂无复盘档案"
        />
      ) : (
        <div className="space-y-8">
          {years.map((year, yearIndex) => (
            <StaggerItem index={yearIndex} key={year}>
              <div className="space-y-3">
                <h2 className="px-1 text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">{year} 年</h2>
                <div className="grid gap-3">
                  {grouped[year].map((report, reportIndex) => {
                    const isExpanded = expandedId === report.id;

                    return (
                      <motion.div
                        animate={{ opacity: 1, y: 0 }}
                        initial={{ opacity: 0, y: 6 }}
                        key={report.id}
                        transition={{ delay: reportIndex * 0.04, duration: 0.25, ease: "easeOut" }}
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
                                {formatDate(report.rangeStart)} - {formatDate(report.rangeEnd)}
                              </p>

                              <div className="mt-1 flex flex-wrap gap-4 text-sm text-slate-300">
                                <span className="flex items-center gap-1.5">
                                  <Smile className="text-indigo-300" size={14} />
                                  平均情绪 {report.metrics.averageMood}/10
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <BrainCircuit className="text-cyan-300" size={14} />
                                  学习 {report.metrics.totalStudyHours.toFixed(1)} h
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <BookOpen className="text-pink-300" size={14} />
                                  阅读 {report.metrics.totalReadingHours.toFixed(1)} h
                                </span>
                                <span className="text-slate-400">共 {report.metrics.entries} 条日记</span>
                              </div>

                              {isExpanded ? (
                                <div className="mt-2 space-y-2">
                                  <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                                    <p className="mb-2 text-xs uppercase tracking-[0.12em] text-slate-400">复盘详情</p>
                                    <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                                      {report.notes || "这条复盘还没有填写详细内容。"}
                                    </p>
                                  </div>
                                  <p className="text-xs text-slate-500">归档时间：{formatDateTime(report.createdAt)}</p>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              <Button
                                onClick={() => setExpandedId((current) => (current === report.id ? null : report.id))}
                                size="sm"
                                variant="secondary"
                              >
                                {isExpanded ? <ChevronUp className="mr-1.5" size={15} /> : <ChevronDown className="mr-1.5" size={15} />}
                                {isExpanded ? "收起详情" : "查看详情"}
                              </Button>

                              <Button
                                disabled={deletingId === report.id}
                                onClick={() => onDelete(report.id)}
                                size="sm"
                                variant="ghost"
                              >
                                <Trash2 className="text-rose-400" size={15} />
                              </Button>
                            </div>
                          </div>
                        </Panel>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </StaggerItem>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2 text-sm text-slate-400">
        <Link className="transition-colors hover:text-slate-200" href="/weekly-review">
          → 去做周度复盘
        </Link>
        <Link className="transition-colors hover:text-slate-200" href="/monthly-review">
          → 去做月度复盘
        </Link>
        <Link className="transition-colors hover:text-slate-200" href="/yearly-review">
          → 去做年度复盘
        </Link>
      </div>
    </PageTransition>
  );
}
