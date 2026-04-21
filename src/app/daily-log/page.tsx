"use client";

import { CalendarDays, CheckCircle2, NotebookPen, Pencil, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

import { MonthCalendarThumb } from "@/components/daily-log/month-calendar-thumb";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Illustration } from "@/components/ui/illustration";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";
import { sortLogsByDate } from "@/lib/analytics";
import { formatDate, getTodayISODate } from "@/lib/date";
import { calculateAlignmentScoreWeighted, fuseActions } from "@/lib/life-path";
import { detectActionsByRules } from "@/lib/life-path-rules";
import { saveDailyLog, updateDailyLog } from "@/lib/storage";
import { useDailyLogsStore } from "@/lib/storage-store";
import type { DailyLog } from "@/types";
import type { FusedAction } from "@/types/life-path";

// ── Alignment result card ─────────────────────────────────────────────────────

function AlignmentCard({
  score,
  positiveDelta,
  negativeDelta,
  contributions,
}: {
  score: number;
  positiveDelta: number;
  negativeDelta: number;
  contributions: FusedAction[];
}) {
  const color = score >= 60 ? "#4A9B6F" : score >= 40 ? "#D4A42A" : "#C0392B";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;

  return (
    <div
      className="flex flex-wrap items-center gap-4 rounded-xl p-4"
      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)" }}
    >
      <svg height={68} viewBox="0 0 68 68" width={68} className="shrink-0">
        <circle cx="34" cy="34" fill="none" r={r} stroke="var(--m-rule)" strokeWidth="7" />
        <circle
          cx="34" cy="34" fill="none" r={r}
          stroke={color}
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
          strokeWidth="7"
          style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
        />
        <text dominantBaseline="middle" fill={color} fontFamily="inherit" fontSize="13" fontWeight="700" textAnchor="middle" x="34" y="34">
          {score}
        </text>
      </svg>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3 text-xs" style={{ color: "var(--m-ink3)" }}>
          <span>今日对齐分</span>
          <span style={{ color: "#4A9B6F" }}>
            <TrendingUp className="mr-0.5 inline" size={11} />+{positiveDelta.toFixed(0)}
          </span>
          <span style={{ color: "#C0392B" }}>
            <TrendingDown className="mr-0.5 inline" size={11} />−{negativeDelta.toFixed(0)}
          </span>
        </div>

        {contributions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {contributions.map((a) => (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                key={a.type}
                style={{
                  background: a.category === "positive" ? "rgba(74,155,111,0.1)" : "rgba(192,57,43,0.1)",
                  color: a.category === "positive" ? "#4A9B6F" : "#C0392B",
                }}
              >
                {a.type}{a.duration !== undefined ? ` ${a.duration}h` : ""}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
            未检测到已知行为，在「人生主线」中配置人生方向后分数会更准确。
          </p>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DailyLogPage() {
  const todayIso = getTodayISODate();
  const [viewingDate, setViewingDate] = useState(todayIso);
  const [editMode, setEditMode] = useState(true);

  const [mood, setMood] = useState(7);
  const [thoughts, setThoughts] = useState("");
  const [studyHours, setStudyHours] = useState(0);
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [alignment, setAlignment] = useState<{
    score: number;
    positiveDelta: number;
    negativeDelta: number;
    contributions: FusedAction[];
  } | null>(null);

  const allLogs = useDailyLogsStore();
  const logs = sortLogsByDate(allLogs, "desc");
  const recentLogs = logs.slice(0, 4);

  const existingLog = useMemo(
    () => allLogs.find((l) => l.date === viewingDate) ?? null,
    [allLogs, viewingDate],
  );

  const isToday = viewingDate === todayIso;
  const isFuture = viewingDate > todayIso;

  // Mode: today-edit | past-view | past-empty | edit (existing past entering edit mode)
  const mode: "edit" | "view" | "empty" | "future" = isFuture
    ? "future"
    : isToday
      ? "edit"
      : existingLog
        ? editMode
          ? "edit"
          : "view"
        : "empty";

  // Repopulate form when switching date; reset edit flag.
  useEffect(() => {
    setMessage("");
    setAlignment(null);
    if (existingLog) {
      setMood(existingLog.mood);
      setThoughts(existingLog.thoughts);
      setStudyHours(existingLog.studyHours);
      setTags(existingLog.tags.join(", "));
      setImages(existingLog.images ?? []);
    } else {
      setMood(7);
      setThoughts("");
      setStudyHours(0);
      setTags("");
      setImages([]);
    }
    setEditMode(viewingDate === todayIso);
  }, [viewingDate, existingLog]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isFuture) return;
    setIsSaving(true);
    setMessage("");
    setAlignment(null);

    const parsedTags = tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const baseFields = {
      date: viewingDate,
      mood,
      thoughts: thoughts.trim(),
      reading: existingLog?.reading ?? "",
      studyHours: Number.isFinite(studyHours) ? Math.max(0, studyHours) : 0,
      tags: parsedTags,
      images,
    };

    let result;
    if (existingLog) {
      result = await updateDailyLog({
        ...existingLog,
        ...baseFields,
      });
    } else {
      const entry: DailyLog = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...baseFields,
      };
      result = await saveDailyLog(entry);
    }

    if (thoughts.trim()) {
      const rules = detectActionsByRules(thoughts.trim());
      const fused = fuseActions(rules, []);
      setAlignment(calculateAlignmentScoreWeighted(fused));
    }

    setMessage(result.synced ? "已保存，并同步到云端。" : "已保存到本地缓存，云端同步稍后重试。");
    setIsSaving(false);

    // After saving a past date, drop back to view mode.
    if (!isToday) setEditMode(false);
  };

  const pageTitle = isToday
    ? "写日记"
    : isFuture
      ? "未来的日子"
      : existingLog
        ? formatDate(viewingDate)
        : `补写 ${formatDate(viewingDate)}`;

  const pageDesc = isToday
    ? "用最短的路径记录今天的心境、思考和学习投入。"
    : isFuture
      ? "还没到那一天，让生活自己翻开它。"
      : existingLog
        ? (editMode ? "正在编辑这一天的日记。" : "翻看过去写下的字句。")
        : "这一天你还没写日记，现在补上也不迟。";

  return (
    <PageTransition className="space-y-6">
      <PageTitle
        description={pageDesc}
        eyebrow="心境随笔"
        icon={NotebookPen}
        title={pageTitle}
      />

      {/* 月历缩略图 */}
      <StaggerItem index={0}>
        <MonthCalendarThumb logs={allLogs} onPick={setViewingDate} viewingDate={viewingDate} />
      </StaggerItem>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <StaggerItem index={1}>
          <Panel className="p-5 sm:p-6 lg:p-7" interactive>
            {mode === "future" ? (
              <div className="py-16 text-center text-sm leading-7" style={{ color: "var(--m-ink3)" }}>
                未来的日子还没有到来。
                <br />
                回到 <button className="underline" onClick={() => setViewingDate(todayIso)} style={{ color: "var(--m-accent)" }} type="button">今天</button> 继续书写吧。
              </div>
            ) : mode === "empty" ? (
              <div className="flex flex-col items-center justify-center gap-4 py-14 text-center">
                <CalendarDays size={36} style={{ color: "var(--m-ink3)" }} />
                <p className="text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
                  这一天你没有写日记。
                  <br />
                  若还记得那天发生了什么，也可以现在补上。
                </p>
                <Button onClick={() => setEditMode(true)} size="lg" type="button" variant="primary">
                  补写这一天
                </Button>
              </div>
            ) : mode === "view" && existingLog ? (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm" style={{ color: "var(--m-ink3)" }}>
                    {formatDate(existingLog.date)} · 情绪 {existingLog.mood}/10 · 学习 {existingLog.studyHours.toFixed(1)} 小时
                  </div>
                  <Button onClick={() => setEditMode(true)} size="sm" type="button" variant="ghost">
                    <Pencil className="mr-1.5 inline" size={14} />
                    编辑
                  </Button>
                </div>
                <div
                  className="whitespace-pre-wrap rounded-xl p-4 text-[15px] leading-8"
                  style={{
                    background: "var(--m-base)",
                    border: "1px solid var(--m-rule)",
                    color: "var(--m-ink)",
                    fontFamily: '"Ma Shan Zheng", "STKaiti", "KaiTi", serif',
                  }}
                >
                  {existingLog.thoughts || "（这一天只留下了一段安静的空白）"}
                </div>
                {existingLog.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {existingLog.tags.map((tag) => (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs"
                        key={tag}
                        style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-ink2)" }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}
                {existingLog.images && existingLog.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {existingLog.images.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" className="aspect-square w-full rounded-lg object-cover" key={i} src={src} />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <form className="grid gap-5" onSubmit={onSubmit}>
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    日期
                    <div
                      className="rounded-lg px-3 py-2 text-sm"
                      style={{
                        background: "var(--m-base)",
                        border: "1px solid var(--m-rule)",
                        color: "var(--m-ink2)",
                      }}
                    >
                      {formatDate(viewingDate)}
                    </div>
                  </div>

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

                <div className="grid gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                  插入图片
                  <ImageUploader images={images} onChange={setImages} />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled={isSaving} size="lg" type="submit" variant="primary">
                    {isSaving ? "保存中..." : existingLog ? "更新" : "保存"}
                  </Button>
                  {!isToday && existingLog ? (
                    <button
                      className="text-sm"
                      onClick={() => setEditMode(false)}
                      style={{ color: "var(--m-ink3)" }}
                      type="button"
                    >
                      取消
                    </button>
                  ) : null}
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

                {alignment && (
                  <AlignmentCard
                    contributions={alignment.contributions}
                    negativeDelta={alignment.negativeDelta}
                    positiveDelta={alignment.positiveDelta}
                    score={alignment.score}
                  />
                )}
              </form>
            )}
          </Panel>
        </StaggerItem>

        <StaggerItem index={2} className="h-full">
          <div className="flex h-full flex-col gap-6">
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

            <Panel className="p-6" interactive>
              <div className="flex items-center gap-2">
                <span className="text-base">💡</span>
                <h4 className="text-sm font-semibold tracking-wide" style={{ color: "var(--m-ink)" }}>
                  记录的意义
                </h4>
              </div>
              <p className="mt-3 text-[13.5px] leading-relaxed" style={{ color: "var(--m-ink2)" }}>
                "无论多么微小的情绪或进步，只要被写下来，就是抵抗遗忘的锚点。不要有压力，只写一两句也很好。"
              </p>
            </Panel>
          </div>
        </StaggerItem>
      </div>

      <StaggerItem index={3}>
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
                  <button
                    className="block h-full w-full text-left"
                    onClick={() => setViewingDate(log.date)}
                    type="button"
                  >
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
                  </button>
                </StaggerItem>
              ))}
            </div>
          )}
        </Panel>
      </StaggerItem>
    </PageTransition>
  );
}
