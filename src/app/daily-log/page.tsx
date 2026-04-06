"use client";

import { CalendarDays, CheckCircle2, NotebookPen } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { sortLogsByDate } from "@/lib/analytics";
import { formatDate, getTodayISODate } from "@/lib/date";
import { saveDailyLog } from "@/lib/storage";
import { useDailyLogsStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";

export default function DailyLogPage() {
  const [date, setDate] = useState(getTodayISODate());
  const [mood, setMood] = useState(7);
  const [thoughts, setThoughts] = useState("");
  const [studyHours, setStudyHours] = useState(0);
  const [tags, setTags] = useState("");
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const logs = sortLogsByDate(useDailyLogsStore(), "desc");
  const recentLogs = logs.slice(0, 4);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setMessage("");

    const entry: DailyLog = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      date,
      mood,
      thoughts: thoughts.trim(),
      reading: "",
      studyHours: Number.isFinite(studyHours) ? Math.max(0, studyHours) : 0,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    const result = await saveDailyLog(entry);
    setThoughts("");
    setStudyHours(0);
    setTags("");
    setMessage(result.synced ? "已保存，并同步到云端。" : "已保存到本地缓存，云端同步稍后重试。");
    setIsSaving(false);
  };

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description="用最短的路径记录今天的心境、思考和学习投入。阅读积累现在统一记录到金句页。"
        eyebrow="写日记"
        icon={NotebookPen}
        title="写日记"
      />

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <StaggerItem index={0}>
          <Panel className="p-5 sm:p-6 lg:p-7" interactive>
            <form className="grid gap-5" onSubmit={onSubmit}>
              <div className="grid gap-5 lg:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                  日期
                  <Input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
                </label>

                <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                  学习时长
                  <Input
                    min={0}
                    onChange={(event) => setStudyHours(Number(event.target.value))}
                    step={0.5}
                    type="number"
                    value={studyHours}
                  />
                </label>
              </div>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                情绪分数 ({mood}/10)
                <input
                  className="h-2 w-full cursor-pointer appearance-none rounded-full"
                  max={10}
                  min={1}
                  onChange={(event) => setMood(Number(event.target.value))}
                  style={{
                    background: "var(--m-base)",
                    border: "1px solid var(--m-rule)",
                    accentColor: "var(--m-accent)",
                  }}
                  type="range"
                  value={mood}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                今日日记
                <Textarea
                  onChange={(event) => setThoughts(event.target.value)}
                  placeholder="写下今天最值得记住的一刻..."
                  value={thoughts}
                />
              </label>

              <label className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                标签（逗号分隔）
                <Input
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="专注, 成长, 平静"
                  type="text"
                  value={tags}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button disabled={isSaving} size="lg" type="submit" variant="primary">
                  {isSaving ? "保存中..." : "保存"}
                </Button>
                <Link className="text-sm" href="/library" style={{ color: "var(--m-accent)" }}>
                  去记录书籍摘抄
                </Link>
                {message ? (
                  <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--m-success)" }}>
                    <CheckCircle2 size={16} />
                    {message}
                  </span>
                ) : null}
              </div>
            </form>
          </Panel>
        </StaggerItem>

        <StaggerItem index={1} className="h-full">
          <div className="flex h-full flex-col gap-6">
            {/* 上方：原有的书写提示卡片 */}
            <Panel className="flex flex-1 flex-col overflow-hidden p-6" interactive>
              <div>
                <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
                  书写提示
                </h3>
                <p className="mt-3 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  1. 今天哪个瞬间最影响你的情绪？
                  <br />
                  2. 今天最值得感谢的一件小事是什么？
                  <br />
                  3. 明天最想守住的一个意图是什么？
                </p>
              </div>
              <div className="mt-auto flex justify-center pt-4">
                <Illustration
                  alt="journaling illustration"
                  className="max-w-[240px]"
                  src="/illustrations/personal-notebook2.svg"
                />
              </div>
            </Panel>

            {/* 下方：新增的灵感小卡片，属性和上方完全一致 */}
            <Panel className="p-6" interactive>
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <h4 className="text-sm font-semibold tracking-wide" style={{ color: "var(--m-ink)" }}>
                  记录的意义
                </h4>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--m-ink2)" }}>
                “无论多么微小的情绪或进步，只要被写下来，就是抵抗遗忘的锚点。不要有压力，只写一两句也很好。”
              </p>
            </Panel>
          </div>
        </StaggerItem>
      </div>

      <StaggerItem index={2}>
        <Panel className="p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold" style={{ color: "var(--m-ink)" }}>
              最近记录
            </h3>
            <span className="text-sm" style={{ color: "var(--m-ink3)" }}>
              最近 4 条
            </span>
          </div>

          {recentLogs.length === 0 ? (
            <EmptyState
              description="保存第一条日记后，这里会出现最近的记录卡片。"
              icon={CalendarDays}
              illustrationAlt="notebook illustration"
              illustrationSrc="/illustrations/personal-notebook.svg"
              title="还没有日记"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentLogs.map((log, index) => (
                <StaggerItem className="h-full" index={index} key={log.id}>
                  <Link className="block h-full" href={`/journal?id=${log.id}`}>
                    <div
                      className="h-full rounded-2xl p-4 transition-all duration-300 ease-out hover:-translate-y-1 hover:scale-[1.02]"
                      style={{
                        background: "var(--m-base)",
                        border: "1px solid var(--m-rule)",
                        boxShadow: "var(--m-shadow-out)",
                      }}
                    >
                      <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
                        {formatDate(log.date)}
                      </p>
                      <p className="mt-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                        情绪 {log.mood}/10
                      </p>
                      <p className="mt-1 text-sm" style={{ color: "var(--m-ink2)" }}>
                        学习 {log.studyHours.toFixed(1)} 小时
                      </p>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </div>
          )}
        </Panel>
      </StaggerItem>
    </PageTransition>
  );
}
