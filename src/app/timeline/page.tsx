"use client";

import { History, Sparkles } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { parseISODate } from "@/lib/date";
import { sortLogsByDate } from "@/lib/analytics";
import { useDailyLogsStore } from "@/lib/storage-store";

function getExcerpt(text: string, maxLength = 180) {
  const clean = text.trim().replace(/\s+/g, " ");

  if (!clean) {
    return "这一天还没有写下完整内容，先记住这一刻留下的空白。";
  }

  if (clean.length <= maxLength) {
    return clean;
  }

  return `${clean.slice(0, maxLength)}...`;
}

export default function TimelinePage() {
  const entries = sortLogsByDate(useDailyLogsStore(), "desc");

  return (
    <PageTransition className="space-y-6">
      <div className="w-full">
        <PageTitle
          description="从最近的一页一路往回翻，按时间顺序浏览所有日记。左侧看日期，右侧读内容，让变化和轨迹在一条纵向长页里自然展开。"
          eyebrow="时光轨迹"
          icon={History}
          title="浏览所有日记"
        />

        {entries.length === 0 ? (
          <EmptyState
            description="先写下第一条日记，这里就会开始生长出属于你的时间线。"
            icon={Sparkles}
            illustrationAlt="nature illustration"
            illustrationSrc="/illustrations/among-nature.svg"
            title="还没有时间线记录"
          />
        ) : (
          <Panel className="p-6 md:p-7">
            <div className="flex items-center justify-between border-b border-dashed pb-4" style={{ borderColor: "rgba(139,94,60,0.16)" }}>
              <div>
                <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  TIMELINE · ALL ENTRIES
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">时间轴</h3>
              </div>
              <Link href="/record">继续记录</Link>
            </div>

            <div className="mt-6 space-y-5">
              {entries.map((entry) => (
                <Link className="group block" href={`/journal?id=${entry.id}`} key={entry.id}>
                  <article
                    className="grid gap-5 rounded-[22px] border border-dashed bg-[rgba(255,248,238,0.74)] px-5 py-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[0_18px_28px_rgba(180,150,110,0.14)] md:grid-cols-[128px_minmax(0,1fr)] md:px-6"
                    style={{ borderColor: "rgba(139,94,60,0.16)" }}
                  >
                    <div className="relative md:pr-8">
                      <div className="absolute right-0 top-1 hidden h-[calc(100%-8px)] border-r border-dashed md:block" style={{ borderColor: "rgba(139,94,60,0.18)" }} />
                      <span className="absolute -right-[6px] top-2 hidden h-3 w-3 rounded-full bg-[var(--m-accent)] shadow-[0_0_0_4px_rgba(240,230,211,1)] md:block" />

                      <div className="text-xs tracking-[0.16em]" style={{ color: "var(--m-ink3)" }}>
                        {new Intl.DateTimeFormat("en-US", { month: "short" }).format(parseISODate(entry.date)).toUpperCase()}
                      </div>
                      <div className="mt-2 text-[2.2rem] font-semibold leading-none tracking-[-0.06em]" style={{ color: "var(--m-ink)" }}>
                        {new Intl.DateTimeFormat("zh-CN", { day: "2-digit" }).format(parseISODate(entry.date))}
                      </div>
                      <div className="mt-2 text-sm" style={{ color: "var(--m-ink2)" }}>
                        {new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(parseISODate(entry.date))}
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                          情绪 {entry.mood}/10 · 学习 {entry.studyHours.toFixed(1)}h
                        </div>
                        <span
                          className="rounded-full px-3 py-1 text-xs whitespace-nowrap"
                          style={{ background: "rgba(139,94,60,0.12)", color: "var(--m-accent)" }}
                        >
                          {entry.reading.trim() ? "有阅读记录" : "日常记录"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-8 md:text-[15px]" style={{ color: "var(--m-ink2)" }}>
                        {getExcerpt(entry.thoughts)}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {entry.reading.trim() ? (
                          <span className="rounded-full px-3 py-1 text-xs" style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-ink2)" }}>
                            {entry.reading.trim()}
                          </span>
                        ) : null}

                        {entry.tags.map((tag) => (
                          <span
                            className="rounded-full px-3 py-1 text-xs"
                            key={`${entry.id}-${tag}`}
                            style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-ink3)" }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </PageTransition>
  );
}
