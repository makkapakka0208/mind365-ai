"use client";

import { CalendarDays, CheckCircle2, ChevronDown, ChevronUp, Paperclip } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { MonthCalendarThumb } from "@/components/daily-log/month-calendar-thumb";
import { DiaryBookModalPortal } from "@/components/dashboard/featured-book-preview";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/components/ui/image-uploader";
import { Input } from "@/components/ui/input";
import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Textarea } from "@/components/ui/textarea";
import { sortLogsByDate } from "@/lib/analytics";
import { formatDate, getTodayISODate } from "@/lib/date";
import { isBase64DataUrl, migrateBase64Images } from "@/lib/image-storage";
import { calculateAlignmentScore, detectActions } from "@/lib/life-path";
import { loadDirections } from "@/lib/life-path-storage";
import { saveDailyLog, updateDailyLog } from "@/lib/storage";
import { useDailyLogsStore, useTimeEntriesStore } from "@/lib/storage-store";
import { useImageMigration } from "@/lib/use-image-migration";
import type { DailyLog } from "@/types";
import type { AlignmentResult, LifeDirection } from "@/types/life-path";

// ── Score helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 65) return "#4a9b6f";
  if (score >= 40) return "#c4813a";
  return "#c0392b";
}

function scoreBg(score: number): string {
  if (score >= 65) return "rgba(74,155,111,0.10)";
  if (score >= 40) return "rgba(196,129,58,0.10)";
  return "rgba(192,57,43,0.08)";
}

function computeAlignment(
  content: string,
  directions: LifeDirection[],
): AlignmentResult | null {
  if (!directions.length || !content.trim()) return null;
  const detectedActions = detectActions(content, directions);
  return calculateAlignmentScore(
    { id: "temp", date: "", content, detectedActions },
    directions,
  );
}

const MOODS = [
  { emoji: "😔", label: "很低落", value: 2 },
  { emoji: "😐", label: "平静", value: 4 },
  { emoji: "🙂", label: "还可以", value: 6 },
  { emoji: "😊", label: "开心", value: 8 },
  { emoji: "😄", label: "很好", value: 10 },
] as const;

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getTagList(value: string) {
  return value
    .split(/[,\s，、]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function RecentEntryButton({
  active,
  log,
  onClick,
  alignmentScore,
}: {
  active: boolean;
  log: DailyLog;
  onClick: () => void;
  alignmentScore?: number;
}) {
  const preview = log.thoughts.trim().replace(/\s+/g, " ").slice(0, 82);

  return (
    <button
      className="group w-full rounded-[18px] px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5"
      onClick={onClick}
      style={{
        background: active ? "rgba(156, 98, 58, 0.16)" : "rgba(255, 251, 244, 0.56)",
        border: `1px solid ${active ? "rgba(156, 98, 58, 0.28)" : "rgba(130, 89, 57, 0.10)"}`,
        boxShadow: active ? "0 14px 26px rgba(110, 72, 43, 0.10)" : "none",
      }}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs tracking-[0.14em]" style={{ color: "var(--v5-ink3)" }}>
          {log.date.slice(5).replace("-", "/")}
        </span>
        <div className="flex items-center gap-2">
          {alignmentScore !== undefined && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
              style={{ background: scoreBg(alignmentScore), color: scoreColor(alignmentScore) }}
            >
              {alignmentScore}
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs italic" style={{ color: "var(--v5-ink2)" }}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: "#99643f" }} />
            mood {log.mood}/10
          </span>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-sm leading-7" style={{ color: "var(--v5-ink2)" }}>
        {preview || "这一页还留着安静的空白。"}
      </p>
      {log.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {log.tags.slice(0, 3).map((tag) => (
            <span className="text-xs italic" key={tag} style={{ color: "var(--v5-accent)" }}>
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}

export default function DailyLogPage() {
  return (
    <Suspense>
      <DailyLogInner />
    </Suspense>
  );
}

function DailyLogInner() {
  const todayIso = getTodayISODate();
  const searchParams = useSearchParams();
  const initialDate = searchParams.get("date") || todayIso;
  const allLogs = useDailyLogsStore();
  const timeEntries = useTimeEntriesStore();
  const logs = sortLogsByDate(allLogs, "desc");
  const recentLogs = logs.slice(0, 4);

  const [viewingDate, setViewingDate] = useState(initialDate);
  const [diaryModalId, setDiaryModalId] = useState<string | null>(null);
  const [mood, setMood] = useState(6);
  const [thoughts, setThoughts] = useState("");
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [alignmentResult, setAlignmentResult] = useState<AlignmentResult | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [directions, setDirections] = useState<LifeDirection[]>([]);

  useEffect(() => {
    setDirections(loadDirections());
  }, []);

  useImageMigration();

  const existingLog = useMemo(
    () => allLogs.find((log) => log.date === viewingDate) ?? null,
    [allLogs, viewingDate],
  );
  const isFuture = viewingDate > todayIso;
  const tagList = useMemo(() => getTagList(tags), [tags]);
  const activeMood = MOODS.reduce((nearest, item) => (
    Math.abs(item.value - mood) < Math.abs(nearest.value - mood) ? item : nearest
  ), MOODS[0]);

  useEffect(() => {
    setMessage("");
    setAlignmentResult(null);
    setShowBreakdown(false);
    if (existingLog) {
      setMood(existingLog.mood);
      setThoughts(existingLog.thoughts);
      setTags(existingLog.tags.join(" "));
      setImages(existingLog.images ?? []);
      return;
    }

    setMood(6);
    setThoughts("");
    setTags("");
    setImages([]);
  }, [existingLog, viewingDate]);

  useEffect(() => {
    if (!existingLog) return;
    const hasBase64 = existingLog.images?.some(isBase64DataUrl);
    if (!hasBase64) return;

    let cancelled = false;
    (async () => {
      const { urls, changed } = await migrateBase64Images(existingLog.images ?? []);
      if (cancelled || !changed) return;
      await updateDailyLog({ ...existingLog, images: urls });
      setImages(urls);
    })();
    return () => {
      cancelled = true;
    };
  }, [existingLog]);

  const onSubmit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isFuture || isSaving) return;

    setIsSaving(true);
    setMessage("");

    try {
      const baseFields = {
        date: viewingDate,
        images,
        mood,
        reading: existingLog?.reading ?? "",
        studyHours: existingLog?.studyHours ?? 0,
        tags: tagList,
        thoughts: thoughts.trim(),
      };

      const result = existingLog
        ? await updateDailyLog({ ...existingLog, ...baseFields })
        : await saveDailyLog({
            id: createId(),
            createdAt: new Date().toISOString(),
            ...baseFields,
          });

      setMessage(result.synced ? "已保存，并同步到 Supabase。" : "已保存到本地缓存。");
      const freshDirs = loadDirections();
      setDirections(freshDirs);
      setAlignmentResult(computeAlignment(thoughts.trim(), freshDirs));
      setShowBreakdown(false);
    } catch (error) {
      setMessage(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsSaving(false);
    }
  }, [existingLog, images, isFuture, isSaving, mood, tagList, thoughts, viewingDate]);

  return (
    <>
      <PageTransition className="daily-log-v5 mx-auto max-w-[1460px] space-y-6 pb-8">
        <div
          className="pointer-events-none fixed right-5 top-5 z-10 hidden rounded-full px-4 py-1.5 text-xs font-bold tracking-[0.18em] text-white md:block"
          style={{ background: "var(--v5-ink)", boxShadow: "0 10px 24px rgba(33, 22, 17, 0.18)" }}
        >
          JOURNAL · v5
        </div>

        <section className="daily-log-hero">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="v5-eyebrow">JOURNAL NOTEBOOK · 心境随笔</span>
                <span className="hidden h-px w-7 bg-[var(--v5-rule-strong)] sm:block" />
                <span className="daily-log-date">{formatDate(viewingDate)}</span>
              </div>
              <h1 className="daily-log-title">把今天的故事，轻轻留在这里吧</h1>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_540px]">
          <StaggerItem index={0}>
            <form className="daily-log-paper" id="journal-form" onSubmit={onSubmit}>
              <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="v5-eyebrow">WRITING SPACE</p>
                  <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-[-0.02em]" style={{ color: "var(--v5-ink)" }}>
                    {existingLog ? "继续整理这一页" : "写一页新的日记"}
                  </h2>
                </div>
                <Button
                  className="rounded-full px-7"
                  disabled={isSaving || isFuture}
                  size="lg"
                  type="submit"
                  variant="primary"
                >
                  <Paperclip className="mr-2" size={16} />
                  {isSaving ? "保存中..." : existingLog ? "写下来" : "保存日记"}
                </Button>
              </div>

              <section>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium" style={{ color: "var(--v5-ink)" }}>
                    今天的心情
                  </p>
                  <span className="text-sm italic" style={{ color: "var(--v5-ink3)" }}>
                    {activeMood.label} · mood {mood}/10
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {MOODS.map((item) => {
                    const selected = item.value === activeMood.value;
                    return (
                      <button
                        className="daily-log-mood"
                        key={item.value}
                        onClick={() => setMood(item.value)}
                        style={{
                          background: selected ? "#fff4df" : "rgba(255, 251, 244, 0.66)",
                          borderColor: selected ? "rgba(214, 154, 84, 0.58)" : "rgba(139, 94, 60, 0.10)",
                          boxShadow: selected
                            ? "0 18px 38px rgba(196, 133, 70, 0.18)"
                            : "0 10px 24px rgba(122, 79, 43, 0.05)",
                        }}
                        type="button"
                      >
                        <span className="block text-2xl">{item.emoji}</span>
                        <span className="mt-2 block text-sm" style={{ color: selected ? "var(--v5-accent)" : "var(--v5-ink3)" }}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mt-8">
                <Textarea
                  className="daily-log-textarea"
                  onChange={(event) => setThoughts(event.target.value)}
                  placeholder="今天发生了什么？从一个画面、一句话、一个念头开始就好..."
                  value={thoughts}
                />
                <div className="mt-3 space-y-2 text-xs" style={{ color: "var(--v5-ink3)" }}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>{thoughts.length} 字</span>
                    {message ? (
                      <div
                        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                        style={{ background: "rgba(74,155,111,0.08)", color: "var(--m-success)" }}
                      >
                        <CheckCircle2 size={13} />
                        <span>{message}</span>
                        {alignmentResult && directions.length > 0 && (
                          <>
                            <span className="opacity-30">·</span>
                            <span style={{ color: "var(--v5-ink3)" }}>对齐分</span>
                            <div
                              className="relative h-1.5 w-14 overflow-hidden rounded-full"
                              style={{ background: "rgba(0,0,0,0.08)" }}
                            >
                              <div
                                className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                                style={{
                                  width: `${alignmentResult.score}%`,
                                  background: scoreColor(alignmentResult.score),
                                }}
                              />
                            </div>
                            <span
                              className="font-semibold tabular-nums"
                              style={{ color: scoreColor(alignmentResult.score) }}
                            >
                              {alignmentResult.score}
                            </span>
                            <button
                              className="rounded-full p-0.5 transition hover:bg-black/5"
                              onClick={() => setShowBreakdown((prev: boolean) => !prev)}
                              title={showBreakdown ? "收起" : "查看方向明细"}
                              type="button"
                            >
                              {showBreakdown
                                ? <ChevronUp size={11} style={{ color: "var(--v5-ink3)" }} />
                                : <ChevronDown size={11} style={{ color: "var(--v5-ink3)" }} />}
                            </button>
                          </>
                        )}
                      </div>
                    ) : null}
                  </div>

                  {showBreakdown && alignmentResult && alignmentResult.breakdown.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-1">
                      {alignmentResult.breakdown.map((dir: import("@/types/life-path").DirectionBreakdown) => (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                          key={dir.directionId}
                          style={{
                            background: dir.delta > 0
                              ? "rgba(74,155,111,0.10)"
                              : dir.delta < 0
                                ? "rgba(192,57,43,0.08)"
                                : "rgba(0,0,0,0.05)",
                            color: dir.delta > 0
                              ? "#4a9b6f"
                              : dir.delta < 0
                                ? "#c0392b"
                                : "var(--v5-ink3)",
                          }}
                        >
                          {dir.directionName}
                          {dir.delta > 0 ? " ▲" : dir.delta < 0 ? " ▼" : " —"}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <section className="daily-log-soft-panel">
                  <label className="text-sm font-medium" style={{ color: "var(--v5-ink)" }}>
                    标签
                  </label>
                  <Input
                    className="mt-3"
                    onChange={(event) => setTags(event.target.value)}
                    placeholder="例如：#vibe #coding"
                    type="text"
                    value={tags}
                    style={{
                      background: "rgba(255,253,248,0.72)",
                      borderRadius: 16,
                      borderColor: "rgba(139,94,60,0.10)",
                    }}
                  />
                  {tagList.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tagList.map((tag) => (
                        <span className="text-xs italic" key={tag} style={{ color: "var(--v5-accent)" }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </section>

                <section className="daily-log-soft-panel">
                  <p className="mb-3 text-sm font-medium" style={{ color: "var(--v5-ink)" }}>
                    今天的画面
                  </p>
                  <ImageUploader images={images} onChange={setImages} />
                </section>
              </div>

              {isFuture ? (
                <p className="mt-5 rounded-[16px] px-4 py-3 text-sm" style={{ background: "rgba(192,57,43,0.06)", color: "#9b463d" }}>
                  未来的页面还没展开，先回到今天写下这一刻。
                </p>
              ) : null}
            </form>
          </StaggerItem>

          <StaggerItem index={1}>
            <aside className="space-y-5 xl:sticky xl:top-6">
              <div className="daily-log-side-card">
                <MonthCalendarThumb logs={allLogs} onPick={setViewingDate} viewingDate={viewingDate} />
              </div>

              <div className="daily-log-side-card daily-log-archive">
                <div className="mb-5 flex items-start justify-between">
                  <div>
                    <span className="v5-eyebrow" style={{ fontSize: 11 }}>
                      ARCHIVE
                    </span>
                    <h3 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em]" style={{ color: "var(--v5-ink)" }}>
                      最近写下的
                    </h3>
                  </div>
                  <CalendarDays size={18} style={{ color: "var(--v5-accent)" }} />
                </div>

                {recentLogs.length > 0 ? (
                  <div className="space-y-3">
                    {recentLogs.map((log) => {
                      const result = computeAlignment(log.thoughts, directions);
                      return (
                        <RecentEntryButton
                          active={log.date === viewingDate}
                          alignmentScore={result?.score}
                          key={log.id}
                          log={log}
                          onClick={() => setDiaryModalId(log.id)}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-[18px] px-4 py-8 text-center text-sm leading-7" style={{ color: "var(--v5-ink3)" }}>
                    还没有日记。第一篇会在这里安静出现。
                  </div>
                )}
              </div>
            </aside>
          </StaggerItem>
        </div>
      </PageTransition>

      <DiaryBookModalPortal
        entries={logs}
        entryId={diaryModalId}
        timeEntries={timeEntries}
        onClose={() => setDiaryModalId(null)}
        onEdit={(entry) => {
          setViewingDate(entry.date);
          setDiaryModalId(null);
          setTimeout(() => {
            document.getElementById("journal-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }}
      />
    </>
  );
}
