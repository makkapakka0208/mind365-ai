"use client";

import { ChevronLeft, ChevronRight, History, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { PageTitle } from "@/components/ui/page-title";
import { PageTransition } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import { sortLogsByDate } from "@/lib/analytics";
import { formatDate } from "@/lib/date";
import { useDailyLogsStore } from "@/lib/storage-store";

function useSwipe(onSwipeLeft: () => void, onSwipeRight: () => void) {
  const startX = useRef(0);
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);
  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = e.changedTouches[0].clientX - startX.current;
      if (Math.abs(diff) > 60) {
        if (diff < 0) onSwipeLeft();
        else onSwipeRight();
      }
    },
    [onSwipeLeft, onSwipeRight],
  );
  return { onTouchStart, onTouchEnd };
}

function MobileTimelineCard({
  entries,
}: {
  entries: ReturnType<typeof sortLogsByDate>;
}) {
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState<"left" | "right" | "">("");

  const goPrev = useCallback(() => {
    setDir("right");
    setIdx((i) => Math.max(0, i - 1));
  }, []);
  const goNext = useCallback(() => {
    setDir("left");
    setIdx((i) => Math.min(entries.length - 1, i + 1));
  }, [entries.length]);

  const swipe = useSwipe(goNext, goPrev);
  const entry = entries[idx];
  if (!entry) return null;

  return (
    <div className="space-y-4" {...swipe}>
      <div className="flex items-center justify-between text-sm">
        <button
          className="rounded-lg p-1.5 disabled:opacity-30"
          disabled={idx === 0}
          onClick={goPrev}
          style={{
            background: "var(--m-base-light)",
            boxShadow: idx > 0 ? "var(--m-shadow-out)" : "none",
          }}
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <span style={{ color: "var(--m-ink3)" }}>
          {idx + 1} / {entries.length}
        </span>
        <button
          className="rounded-lg p-1.5 disabled:opacity-30"
          disabled={idx === entries.length - 1}
          onClick={goNext}
          style={{
            background: "var(--m-base-light)",
            boxShadow: idx < entries.length - 1 ? "var(--m-shadow-out)" : "none",
          }}
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <Link className="block" href={`/journal?id=${entry.id}`}>
        <Panel
          className={`p-5 ${dir === "left" ? "m-slide-left" : dir === "right" ? "m-slide-right" : ""}`}
          key={entry.id}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" style={{ color: "var(--m-ink2)" }}>
              {formatDate(entry.date)}
            </p>
            <p
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{
                background: "var(--m-base)",
                boxShadow: "var(--m-shadow-out)",
                color: "var(--m-accent)",
              }}
            >
              情绪 {entry.mood}/10
            </p>
          </div>

          <p
            className="mt-4 text-sm leading-7"
            style={{ color: "var(--m-ink)" }}
          >
            {entry.thoughts.length > 180
              ? `${entry.thoughts.slice(0, 180)}...`
              : entry.thoughts || "这一天还没有写下具体内容"}
          </p>

          <div className="mt-4 grid gap-2 text-sm" style={{ color: "var(--m-ink2)" }}>
            <p>
              <span className="font-medium" style={{ color: "var(--m-ink)" }}>
                阅读记录：
              </span>
              {entry.reading || "-"}
            </p>
            <p>
              <span className="font-medium" style={{ color: "var(--m-ink)" }}>
                学习时长：
              </span>
              {entry.studyHours} 小时
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {entry.tags.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--m-ink3)" }}>
                暂无标签
              </p>
            ) : (
              entry.tags.map((tag) => (
                <span
                  className="rounded-full px-3 py-1 text-xs"
                  key={`${entry.id}-${tag}`}
                  style={{
                    background: "var(--m-base)",
                    border: "1px solid var(--m-rule)",
                    color: "var(--m-ink2)",
                  }}
                >
                  #{tag}
                </span>
              ))
            )}
          </div>
        </Panel>
      </Link>
    </div>
  );
}

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
        <MobileTimelineCard entries={entries} />
      )}
    </PageTransition>
  );
}
