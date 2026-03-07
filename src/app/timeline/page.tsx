"use client";

import { History, Sparkles } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { sortLogsByDate } from "@/lib/analytics";
import { formatDate } from "@/lib/date";
import { useDailyLogsStore } from "@/lib/storage-store";

export default function TimelinePage() {
  const entries = sortLogsByDate(useDailyLogsStore(), "desc");

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="按时间回看你的情绪、阅读和学习轨迹，复盘会更有上下文。"
        eyebrow="时光轨迹"
        icon={History}
        title="时光轨迹"
      />

      {entries.length === 0 ? (
        <EmptyState
          description="先写下第一条日记，这里就会开始生长出你的时间线。"
          icon={Sparkles}
          illustrationAlt="nature illustration"
          illustrationSrc="/illustrations/among-nature.svg"
          title="还没有时间线记录"
        />
      ) : (
        <div className="relative space-y-4">
          <div className="pointer-events-none absolute left-[17px] top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-indigo-300/40 via-purple-300/35 to-pink-300/40" />
          {entries.map((entry, index) => (
            <StaggerItem className="relative pl-10" index={index} key={entry.id}>
              <span className="absolute left-0 top-6 h-3.5 w-3.5 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 shadow shadow-purple-300/40" />

              <Link className="block" href={`/journal?id=${entry.id}`}>
                <Panel className="p-5" interactive>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-slate-400">{formatDate(entry.date)}</p>
                    <p className="rounded-full bg-gradient-to-r from-indigo-500/30 via-purple-500/30 to-pink-500/30 px-3 py-1 text-xs font-semibold text-indigo-100">
                      情绪 {entry.mood}/10
                    </p>
                  </div>

                  <p className="mt-4 text-sm leading-7 text-slate-200">
                    {entry.thoughts.length > 180
                      ? `${entry.thoughts.slice(0, 180)}...`
                      : entry.thoughts || "这一天还没有写下具体内容"}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-slate-100">阅读记录：</span>
                      {entry.reading || "-"}
                    </p>
                    <p>
                      <span className="font-medium text-slate-100">学习时长：</span>
                      {entry.studyHours} 小时
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {entry.tags.length === 0 ? (
                      <p className="text-xs text-slate-400">暂无标签</p>
                    ) : (
                      entry.tags.map((tag) => (
                        <span
                          className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs text-slate-300"
                          key={`${entry.id}-${tag}`}
                        >
                          #{tag}
                        </span>
                      ))
                    )}
                  </div>
                </Panel>
              </Link>
            </StaggerItem>
          ))}
        </div>
      )}
    </PageTransition>
  );
}

