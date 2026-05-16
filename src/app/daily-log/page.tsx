"use client";

import { BookOpen, CalendarDays, CheckCircle2, Feather, ImagePlus, NotebookPen } from "lucide-react";
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
import { saveDailyLog, updateDailyLog } from "@/lib/storage";
import { useDailyLogsStore, useTimeEntriesStore } from "@/lib/storage-store";
import { useImageMigration } from "@/lib/use-image-migration";
import type { DailyLog } from "@/types";

const MOODS = [
  { emoji: "😞", label: "很低落", value: 2 },
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
}: {
  active: boolean;
  log: DailyLog;
  onClick: () => void;
}) {
  const preview = log.thoughts.trim().replace(/\s+/g, " ").slice(0, 56);

  return (
    <button
      className="group w-full rounded-[22px] px-4 py-3 text-left transition duration-300 hover:-translate-y-0.5"
      onClick={onClick}
      style={{
        background: active ? "rgba(165,106,67,0.12)" : "rgba(255,250,242,0.62)",
        border: `1px solid ${active ? "rgba(165,106,67,0.28)" : "rgba(139,94,60,0.10)"}`,
        boxShadow: active ? "0 16px 30px rgba(122,79,43,0.10)" : "0 10px 24px rgba(122,79,43,0.05)",
      }}
      type="button"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs tracking-[0.16em]" style={{ color: "var(--m-ink3)" }}>
          {log.date.slice(5).replace("-", "/")}
        </span>
        <span className="text-xs" style={{ color: "var(--m-accent)" }}>
          {log.mood}/10
        </span>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
        {preview || "这一天留下了一页安静的空白。"}
      </p>
      {log.tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {log.tags.slice(0, 3).map((tag) => (
            <span
              className="rounded-full px-2 py-0.5 text-[11px]"
              key={tag}
              style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-ink3)" }}
            >
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
  const recentLogs = logs.slice(0, 5);

  const [viewingDate, setViewingDate] = useState(initialDate);
  const [diaryModalId, setDiaryModalId] = useState<string | null>(null);
  const [mood, setMood] = useState(6);
  const [thoughts, setThoughts] = useState("");
  const [tags, setTags] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Run background migration of base64 images to Supabase Storage
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

  // Background migration: convert base64 images to Supabase Storage URLs
  useEffect(() => {
    if (!existingLog) return;
    const hasBase64 = existingLog.images?.some(isBase64DataUrl);
    if (!hasBase64) return;

    let cancelled = false;
    (async () => {
      const { urls, changed } = await migrateBase64Images(existingLog.images ?? []);
      if (cancelled || !changed) return;
      // Update the log with new URLs
      await updateDailyLog({ ...existingLog, images: urls });
      setImages(urls);
    })();
    return () => { cancelled = true; };
  }, [existingLog]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
    } catch (error) {
      setMessage(`保存失败：${error instanceof Error ? error.message : "未知错误"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
    <PageTransition className="space-y-6">
      <section
        className="relative overflow-hidden rounded-[30px] px-5 py-6 sm:px-7 lg:px-9"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,251,244,0.96), rgba(245,234,216,0.84)), radial-gradient(circle at 18% 0%, rgba(255,235,190,0.34), transparent 32%)",
          border: "1px solid rgba(139,94,60,0.12)",
          boxShadow: "0 26px 60px rgba(122,79,43,0.12)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.45'/%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-medium tracking-[0.24em]" style={{ color: "var(--m-ink3)" }}>
              <Feather size={15} />
              JOURNAL NOTEBOOK
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl" style={{ color: "var(--m-ink)" }}>
              今晚，慢慢写下来
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
              这里不急着提交什么，只是给今天留一页纸。情绪、片段、画面，都可以轻轻放下。
            </p>
          </div>
          <div
            className="rounded-full px-4 py-2 text-sm"
            style={{ background: "rgba(255,250,242,0.72)", border: "1px solid rgba(139,94,60,0.12)", color: "var(--m-ink2)" }}
          >
            {formatDate(viewingDate)}
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <StaggerItem index={0}>
          <form
            className="relative overflow-hidden rounded-[32px] p-5 sm:p-7 lg:p-9"
            id="journal-form"
            onSubmit={onSubmit}
            style={{
              background:
                "linear-gradient(180deg, rgba(255,252,246,0.98), rgba(249,240,225,0.96)), linear-gradient(90deg, rgba(165,106,67,0.045) 1px, transparent 1px)",
              backgroundSize: "auto, 44px 44px",
              border: "1px solid rgba(139,94,60,0.12)",
              boxShadow: "0 30px 70px rgba(122,79,43,0.13)",
            }}
          >
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                  WRITING SPACE
                </p>
                <h2 className="mt-2 text-2xl font-semibold" style={{ color: "var(--m-ink)" }}>
                  {existingLog ? "继续整理这一页" : "写一页新的日记"}
                </h2>
              </div>
              <Button disabled={isSaving || isFuture} size="lg" type="submit" variant="primary">
                {isSaving ? "保存中..." : existingLog ? "更新日记" : "保存日记"}
              </Button>
            </div>

            <div className="space-y-8">
              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                    今天的心情
                  </p>
                  <span className="text-xs" style={{ color: "var(--m-ink3)" }}>
                    {activeMood.label} · {mood}/10
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {MOODS.map((item) => {
                    const selected = item.value === activeMood.value;
                    return (
                      <button
                        className="group rounded-[22px] px-3 py-4 text-center transition duration-300 hover:-translate-y-1"
                        key={item.value}
                        onClick={() => setMood(item.value)}
                        style={{
                          background: selected ? "rgba(255,244,226,0.96)" : "rgba(255,250,242,0.72)",
                          border: `1px solid ${selected ? "rgba(214,154,84,0.55)" : "rgba(139,94,60,0.10)"}`,
                          boxShadow: selected
                            ? "0 18px 34px rgba(214,154,84,0.18)"
                            : "0 10px 24px rgba(122,79,43,0.05)",
                        }}
                        type="button"
                      >
                        <span className="block text-2xl transition duration-300 group-hover:scale-110">{item.emoji}</span>
                        <span className="mt-2 block text-xs" style={{ color: selected ? "var(--m-accent)" : "var(--m-ink3)" }}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section>
                <Textarea
                  className="min-h-[460px] resize-y rounded-[28px] px-6 py-6 text-[16px] leading-9 sm:min-h-[560px] sm:px-8 sm:py-8"
                  onChange={(event) => setThoughts(event.target.value)}
                  placeholder="今天发生了什么？从一个画面、一句话、一个念头开始就好..."
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(255,253,248,0.92), rgba(250,243,231,0.82)), repeating-linear-gradient(180deg, transparent, transparent 35px, rgba(139,94,60,0.055) 36px)",
                    border: "1px solid rgba(139,94,60,0.10)",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.78)",
                    fontFamily: '"Noto Serif SC", "Songti SC", serif',
                  }}
                  value={thoughts}
                />
                <div className="mt-3 flex justify-end text-xs" style={{ color: "var(--m-ink3)" }}>
                  {thoughts.length} 字
                </div>
              </section>

              <section
                className="rounded-[26px] p-5"
                style={{ background: "rgba(255,250,242,0.62)", border: "1px solid rgba(139,94,60,0.10)" }}
              >
                <div className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                  <BookOpen size={16} />
                  标签
                </div>
                <Input
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="输入自定义标签，用空格或逗号分隔"
                  type="text"
                  value={tags}
                  style={{
                    background: "rgba(255,253,248,0.68)",
                    borderRadius: 22,
                    borderColor: "rgba(139,94,60,0.10)",
                    boxShadow: "0 8px 18px rgba(122,79,43,0.04)",
                    padding: "0.85rem 1rem",
                  }}
                />
                {tagList.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tagList.map((tag) => (
                      <span
                        className="rounded-full px-3 py-1.5 text-xs transition duration-300 hover:-translate-y-0.5"
                        key={tag}
                        style={{
                          background: "rgba(172,120,76,0.10)",
                          border: "1px solid rgba(139,94,60,0.10)",
                          color: "var(--m-accent)",
                        }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs leading-6" style={{ color: "var(--m-ink3)" }}>
                    例如：#成长 #阅读 #平静。这里会跟随你的输入生成标签。
                  </p>
                )}
              </section>

              <section
                className="rounded-[26px] p-5"
                style={{ background: "rgba(255,250,242,0.62)", border: "1px solid rgba(139,94,60,0.10)" }}
              >
                <div className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--m-ink)" }}>
                  <ImagePlus size={16} />
                  今天的画面
                </div>
                <ImageUploader images={images} onChange={setImages} />
              </section>

              {isFuture ? (
                <p className="rounded-[18px] px-4 py-3 text-sm" style={{ background: "rgba(192,57,43,0.06)", color: "#9b463d" }}>
                  未来的页面还没展开，先回到今天写下这一刻。
                </p>
              ) : null}

              {message ? (
                <p className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm" style={{ background: "rgba(74,155,111,0.08)", color: "var(--m-success)" }}>
                  <CheckCircle2 size={16} />
                  {message}
                </p>
              ) : null}
            </div>
          </form>
        </StaggerItem>

        <StaggerItem index={1}>
          <aside className="space-y-5 xl:sticky xl:top-6">
            <div
              className="rounded-[28px] p-4"
              style={{
                background: "rgba(255,250,242,0.72)",
                border: "1px solid rgba(139,94,60,0.12)",
                boxShadow: "0 18px 40px rgba(122,79,43,0.10)",
              }}
            >
              <MonthCalendarThumb logs={allLogs} onPick={setViewingDate} viewingDate={viewingDate} />
            </div>

            <div
              className="rounded-[28px] p-5"
              style={{
                background: "rgba(255,250,242,0.72)",
                border: "1px solid rgba(139,94,60,0.12)",
                boxShadow: "0 18px 40px rgba(122,79,43,0.08)",
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
                    ARCHIVE
                  </p>
                  <h3 className="mt-1 text-lg font-semibold" style={{ color: "var(--m-ink)" }}>
                    最近写下的
                  </h3>
                </div>
                <CalendarDays size={18} style={{ color: "var(--m-accent)" }} />
              </div>

              {recentLogs.length > 0 ? (
                <div className="space-y-3">
                  {recentLogs.map((log) => (
                    <RecentEntryButton
                      active={log.date === viewingDate}
                      key={log.id}
                      log={log}
                      onClick={() => setDiaryModalId(log.id)}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="rounded-[22px] px-4 py-8 text-center text-sm leading-7"
                  style={{ background: "rgba(255,253,248,0.58)", color: "var(--m-ink3)" }}
                >
                  还没有日记。第一篇会在这里静静出现。
                </div>
              )}
            </div>

            <div
              className="rounded-[28px] p-5"
              style={{
                background: "linear-gradient(135deg, rgba(255,247,235,0.92), rgba(245,231,210,0.72))",
                border: "1px solid rgba(139,94,60,0.10)",
                color: "var(--m-ink2)",
              }}
            >
              <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--m-ink)" }}>
                <NotebookPen size={16} />
                记录的意义
              </p>
              <p className="mt-3 text-sm leading-7">
                "无论多么微小的情绪或进步，只要被写下来，就是抵抗遗忘的锚点。不要有压力，只写一两句也很好。"
              </p>
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
        // Scroll form into view
        setTimeout(() => {
          document.getElementById("journal-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
      }}
    />
    </>
  );
}
