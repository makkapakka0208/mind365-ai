"use client";

import { motion } from "framer-motion";
import { BookMarked, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { GoalReviewCard } from "@/components/year-review/goal-review-card";
import { TrendChart } from "@/components/year-review/trend-chart";
import { PageTransition } from "@/components/ui/page-transition";
import { ParticleField } from "@/components/ui/particle-field";
import { useDailyLogsStore, useQuotesStore } from "@/lib/storage-store";
import { computeYearStats, generateYearSummary, type YearReadingCard } from "@/lib/year-review";
import { YEAR_REVIEW_MOCK, adaptFromDailyLogs } from "@/lib/year-review-mock";
import type { DocPhase, PhaseState, YearReviewData, YearSummaryAI } from "@/types/year-review";

/* ── 风格常量 ─────────────────────────────────────────────────────────────────
   封面与结尾固定用"胶片黑"，不随日夜主题翻转——电影在白天放也是黑的。 */
const FILM = {
  bg: "linear-gradient(165deg, #15100b 0%, #1d150d 55%, #120d08 100%)",
  ink: "#efe3d2",
  ink2: "#c3a785",
  ink3: "#8d7355",
  rule: "rgba(235, 210, 180, 0.14)",
  accent: "#c89a6e",
};

const SERIF = "var(--m-font-serif)";
const DISPLAY = "var(--m-font-display)";

const STATE_META: Record<PhaseState, { label: string; color: string; bg: string }> = {
  lonely:   { label: "孤独", color: "#8b9bbd", bg: "rgba(139,155,189,0.12)" },
  anxious:  { label: "焦虑", color: "#c4685a", bg: "rgba(196,104,90,0.12)" },
  lucid:    { label: "清醒", color: "#7fae87", bg: "rgba(127,174,135,0.12)" },
  building: { label: "重建", color: "#c89a6e", bg: "rgba(200,154,110,0.12)" },
  drifting: { label: "漂移", color: "#a39884", bg: "rgba(163,152,132,0.12)" },
};

const CHAPTER_NUMERALS = ["壹", "贰", "叁", "肆", "伍", "陆"];

/* ── 小组件 ───────────────────────────────────────────────────────────────── */

function Eyebrow({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      className="text-[11px] font-medium uppercase"
      style={{ letterSpacing: "0.22em", color: color ?? "var(--m-ink3)", fontFamily: "var(--v5-sans)" }}
    >
      {children}
    </p>
  );
}

/** 章节标题：编号 + 名称 + 延伸的细线 */
function ChapterHead({ no, title }: { no: string; title: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span
        className="text-sm"
        style={{ fontFamily: DISPLAY, color: "var(--m-accent)", letterSpacing: "0.1em" }}
      >
        {no}
      </span>
      <h2
        className="shrink-0 text-xl font-semibold sm:text-2xl"
        style={{ fontFamily: SERIF, color: "var(--m-ink)", letterSpacing: "0.04em" }}
      >
        {title}
      </h2>
      <div className="h-px flex-1 self-center" style={{ background: "var(--m-rule)" }} />
    </div>
  );
}

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── 封面 ─────────────────────────────────────────────────────────────────── */

function Cover({
  year,
  entries,
  yearKeyword,
  isLoading,
}: {
  year: number;
  entries: number;
  yearKeyword: { word: string; reason: string } | null;
  isLoading: boolean;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-[32px] px-7 py-14 sm:px-12 sm:py-20"
      style={{ background: FILM.bg, color: FILM.ink }}
    >
      {/* 颗粒噪点 + 暗角，胶片质感 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(200,154,110,0.10), transparent 55%), radial-gradient(ellipse at 50% 120%, rgba(0,0,0,0.55), transparent 60%)",
        }}
      />
      {/* 放映机里浮动的尘埃 */}
      <ParticleField count={42} />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#b4584a" }} />
          <Eyebrow color={FILM.ink3}>Annual Documentary · 私人纪录片</Eyebrow>
        </div>

        <h1
          className="mt-8 leading-none"
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(88px, 18vw, 200px)",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: FILM.ink,
          }}
        >
          {year}
        </h1>

        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <p className="max-w-md text-sm leading-7" style={{ color: FILM.ink2, fontFamily: SERIF }}>
            {entries} 天的素材。学习的时长、抄下的句子、深夜的日记——剪在一起，是这部只有一个观众的片子。
          </p>

          {/* 年度关键词钤印 */}
          <div className="text-right">
            <Eyebrow color={FILM.ink3}>年度关键词</Eyebrow>
            {isLoading ? (
              <div className="mt-2 flex items-center justify-end gap-2" style={{ color: FILM.ink3 }}>
                <Loader2 className="animate-spin" size={14} />
                <span className="text-sm" style={{ fontFamily: SERIF }}>显影中</span>
              </div>
            ) : (
              <p
                className="mt-1"
                style={{
                  fontFamily: SERIF,
                  fontSize: "clamp(34px, 5vw, 52px)",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: FILM.accent,
                }}
              >
                {yearKeyword?.word || "——"}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── 开场旁白 ─────────────────────────────────────────────────────────────── */

function OpeningNarration({ text }: { text: string }) {
  return (
    <FadeIn>
      <div className="mx-auto max-w-2xl px-2 py-6 text-center">
        <span style={{ fontFamily: DISPLAY, fontSize: 44, lineHeight: 0, color: "var(--m-accent)" }}>“</span>
        <p
          className="mt-2 text-lg leading-10 sm:text-xl sm:leading-[2.6]"
          style={{ fontFamily: SERIF, color: "var(--m-ink)", letterSpacing: "0.02em" }}
        >
          {text}
        </p>
        <div className="mx-auto mt-6 h-px w-16" style={{ background: "var(--m-accent)", opacity: 0.4 }} />
      </div>
    </FadeIn>
  );
}

/* ── 阶段章节 ─────────────────────────────────────────────────────────────── */

function PhaseChapters({ phases }: { phases: DocPhase[] }) {
  return (
    <div className="relative space-y-5">
      {/* 时间轴竖线 */}
      <div
        className="absolute bottom-6 left-[19px] top-6 hidden w-px sm:block"
        style={{ background: "linear-gradient(180deg, transparent, var(--m-rule) 12%, var(--m-rule) 88%, transparent)" }}
      />
      {phases.map((phase, i) => {
        const meta = STATE_META[phase.state];
        return (
          <FadeIn key={`${phase.period}-${i}`} delay={i * 0.05}>
            <div className="relative flex gap-5">
              {/* 章号节点 */}
              <div className="hidden shrink-0 sm:block">
                <span
                  className="relative z-10 grid h-10 w-10 place-items-center rounded-full text-sm"
                  style={{
                    fontFamily: SERIF,
                    background: "var(--m-base-light)",
                    border: "1px solid var(--m-rule)",
                    color: "var(--m-accent)",
                    boxShadow: "var(--m-shadow-out)",
                  }}
                >
                  {CHAPTER_NUMERALS[i] ?? i + 1}
                </span>
              </div>

              <div
                className="min-w-0 flex-1 rounded-2xl p-5 sm:p-6"
                style={{
                  background: "var(--m-base-light)",
                  border: "1px solid var(--m-rule)",
                  boxShadow: "var(--m-shadow-out)",
                }}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="text-xs tracking-[0.14em]" style={{ color: "var(--m-ink3)", fontFamily: "var(--v5-sans)" }}>
                    {phase.period}
                  </span>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wider"
                    style={{ background: meta.bg, color: meta.color }}
                  >
                    {meta.label}
                  </span>
                </div>
                <h3
                  className="mt-2 text-lg font-semibold sm:text-xl"
                  style={{ fontFamily: SERIF, color: "var(--m-ink)", letterSpacing: "0.05em" }}
                >
                  {phase.title}
                </h3>
                <p className="mt-3 text-[15px] leading-8" style={{ fontFamily: SERIF, color: "var(--m-ink2)" }}>
                  {phase.narration}
                </p>
              </div>
            </div>
          </FadeIn>
        );
      })}
    </div>
  );
}

/* ── 关键词墙 ─────────────────────────────────────────────────────────────── */

function KeywordWall({ keywords }: { keywords: YearSummaryAI["keywords"] }) {
  const maxCount = Math.max(1, ...keywords.map((k) => k.count));
  return (
    <div
      className="rounded-[28px] px-6 py-8 sm:px-10 sm:py-10"
      style={{ background: "var(--m-base)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-in)" }}
    >
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-5">
        {keywords.map((k, i) => {
          const scale = 0.55 + 0.45 * (k.count / maxCount);
          return (
            <FadeIn key={k.word} delay={i * 0.04}>
              <span className="inline-flex items-baseline gap-2">
                <span
                  style={{
                    fontFamily: SERIF,
                    fontWeight: 600,
                    fontSize: `clamp(${18 * scale + 8}px, ${4.4 * scale}vw, ${44 * scale + 8}px)`,
                    color: i === 0 ? "var(--m-accent)" : "var(--m-ink)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {k.word}
                </span>
                {k.count > 0 && (
                  <span className="text-[11px]" style={{ color: "var(--m-ink3)", fontFamily: "var(--v5-sans)" }}>
                    ×{k.count}
                  </span>
                )}
              </span>
            </FadeIn>
          );
        })}
      </div>
      {/* 词义注脚 */}
      <div className="mt-8 space-y-2.5 border-t pt-5" style={{ borderColor: "var(--m-rule)" }}>
        {keywords.filter((k) => k.meaning).map((k) => (
          <p key={`m-${k.word}`} className="text-sm leading-7" style={{ fontFamily: SERIF, color: "var(--m-ink2)" }}>
            <span className="font-semibold" style={{ color: "var(--m-ink)" }}>{k.word}</span>
            <span style={{ color: "var(--m-ink3)" }}> —— </span>
            {k.meaning}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ── 双栏特稿：现实推测 / 重建 ────────────────────────────────────────────── */

function EditorialSpread({ lifeInference, rebuilding }: { lifeInference: string; rebuilding: string }) {
  const columns = [
    { eyebrow: "镜头之外", title: "你大概过着怎样的生活", body: lifeInference },
    { eyebrow: "余烬之后", title: "你如何重建自己", body: rebuilding },
  ].filter((c) => c.body);
  if (columns.length === 0) return null;
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {columns.map((col, i) => (
        <FadeIn key={col.title} delay={i * 0.08}>
          <article
            className="h-full rounded-2xl p-6 sm:p-7"
            style={{ background: "var(--m-base-light)", border: "1px solid var(--m-rule)", boxShadow: "var(--m-shadow-out)" }}
          >
            <Eyebrow>{col.eyebrow}</Eyebrow>
            <h3 className="mt-2 text-lg font-semibold" style={{ fontFamily: SERIF, color: "var(--m-ink)" }}>
              {col.title}
            </h3>
            <p
              className="mt-4 text-[15px] leading-8 first-letter:float-left first-letter:mr-2 first-letter:text-4xl first-letter:font-semibold first-letter:leading-[1.1]"
              style={{ fontFamily: SERIF, color: "var(--m-ink2)" }}
            >
              {col.body}
            </p>
          </article>
        </FadeIn>
      ))}
    </div>
  );
}

/* ── 精神避难所 ───────────────────────────────────────────────────────────── */

function RefugeCard({ refuge }: { refuge: string }) {
  if (!refuge) return null;
  return (
    <FadeIn>
      <div className="liquid-glass relative overflow-hidden rounded-[28px] p-7 sm:p-9">
        <BookMarked
          className="absolute -right-4 -top-4 opacity-[0.07]"
          size={120}
          style={{ color: "var(--m-accent)" }}
        />
        <Eyebrow>精神避难所</Eyebrow>
        <p className="mt-4 max-w-2xl text-base leading-9" style={{ fontFamily: SERIF, color: "var(--m-ink)" }}>
          {refuge}
        </p>
      </div>
    </FadeIn>
  );
}

/* ── 认知升级时刻 ─────────────────────────────────────────────────────────── */

function UpgradeMoments({ moments }: { moments: string[] }) {
  if (moments.length === 0) return null;
  return (
    <div className="space-y-0">
      {moments.map((m, i) => (
        <FadeIn key={i} delay={i * 0.06}>
          <div
            className="flex gap-5 py-5"
            style={{ borderBottom: i < moments.length - 1 ? "1px dashed var(--m-rule)" : "none" }}
          >
            <span
              className="shrink-0 text-2xl tabular-nums"
              style={{ fontFamily: DISPLAY, color: "var(--m-accent)", opacity: 0.85 }}
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[15px] leading-8" style={{ fontFamily: SERIF, color: "var(--m-ink2)" }}>
              {m}
            </p>
          </div>
        </FadeIn>
      ))}
    </div>
  );
}

/* ── 人物画像 ─────────────────────────────────────────────────────────────── */

function ArchetypeCard({ archetype }: { archetype: { title: string; description: string } }) {
  if (!archetype.title) return null;
  return (
    <FadeIn>
      <div
        className="rounded-[28px] px-7 py-10 text-center sm:px-12"
        style={{
          background: "linear-gradient(135deg, var(--m-paper-hi), var(--m-paper-lo))",
          border: "1px solid var(--m-rule)",
          boxShadow: "var(--m-shadow-out)",
        }}
      >
        <Eyebrow>你最像</Eyebrow>
        <h3
          className="mx-auto mt-4 max-w-xl text-2xl font-bold leading-snug sm:text-3xl"
          style={{ fontFamily: SERIF, color: "var(--m-ink)", letterSpacing: "0.04em" }}
        >
          {archetype.title}
        </h3>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-8" style={{ fontFamily: SERIF, color: "var(--m-ink2)" }}>
          {archetype.description}
        </p>
      </div>
    </FadeIn>
  );
}

/* ── 结尾：渐入黑场 ───────────────────────────────────────────────────────── */

function EndingCredits({ ending, year, reason }: { ending: string; year: number; reason: string }) {
  return (
    <section
      className="relative overflow-hidden rounded-[32px] px-7 py-16 text-center sm:px-16 sm:py-24"
      style={{ background: FILM.bg, color: FILM.ink }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(200,154,110,0.08), transparent 55%)" }}
      />
      <ParticleField count={30} speed={0.12} />
      <div className="relative mx-auto max-w-2xl">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 1.6, ease: "easeOut" }}
          className="text-lg leading-10 sm:text-xl sm:leading-[2.7]"
          style={{ fontFamily: SERIF, letterSpacing: "0.03em" }}
        >
          {ending}
        </motion.p>
        {reason && (
          <p className="mt-10 text-sm leading-7" style={{ color: FILM.ink3, fontFamily: SERIF }}>
            {reason}
          </p>
        )}
        <p className="mt-12 text-xs tracking-[0.3em]" style={{ color: FILM.ink3, fontFamily: "var(--v5-sans)" }}>
          —— {year}，终 ——
        </p>
      </div>
    </section>
  );
}

/* ── 加载骨架：放映前的黑场 ───────────────────────────────────────────────── */

function ProjectingState() {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 rounded-[28px] py-20"
      style={{ background: FILM.bg, color: FILM.ink3 }}
    >
      <Loader2 className="animate-spin" size={22} style={{ color: FILM.accent }} />
      <p className="text-sm tracking-[0.2em]" style={{ fontFamily: SERIF }}>
        正在回放这一年的素材…
      </p>
      <p className="text-xs" style={{ color: FILM.ink3 }}>
        旁白生成约需半分钟
      </p>
    </div>
  );
}

/* ── 数据插叙条 ───────────────────────────────────────────────────────────── */

function DataStrip({ entries, study, waste, avgMood }: { entries: number; study: number; waste: number; avgMood: number }) {
  const items = [
    { label: "记录天数", value: String(entries), unit: "天" },
    { label: "有效投入", value: study.toFixed(1), unit: "h" },
    { label: "被标记的消耗", value: waste.toFixed(1), unit: "h" },
    { label: "平均对齐", value: String(avgMood), unit: "/100" },
  ];
  return (
    <div
      className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl sm:grid-cols-4"
      style={{ background: "var(--m-rule)", border: "1px solid var(--m-rule)" }}
    >
      {items.map((it) => (
        <div key={it.label} className="px-5 py-4" style={{ background: "var(--m-base-light)" }}>
          <p className="text-[11px] tracking-[0.14em]" style={{ color: "var(--m-ink3)", fontFamily: "var(--v5-sans)" }}>
            {it.label}
          </p>
          <p className="mt-1.5 flex items-baseline gap-1">
            <span className="text-2xl font-semibold tabular-nums" style={{ fontFamily: DISPLAY, color: "var(--m-ink)" }}>
              {it.value}
            </span>
            <span className="text-xs" style={{ color: "var(--m-ink3)" }}>{it.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
}

/* ── 页面 ─────────────────────────────────────────────────────────────────── */

export default function YearReviewPage() {
  const allLogs = useDailyLogsStore();
  const allQuotes = useQuotesStore();
  const [useMock, setUseMock] = useState(false);
  const [ai, setAi] = useState<YearSummaryAI | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const currentYear = new Date().getFullYear();

  const data: YearReviewData = useMemo(() => {
    if (useMock) return YEAR_REVIEW_MOCK;
    const live = adaptFromDailyLogs(allLogs, currentYear);
    return live.records.length === 0 ? YEAR_REVIEW_MOCK : live;
  }, [allLogs, currentYear, useMock]);

  const isShowingMock = data === YEAR_REVIEW_MOCK;

  // 阅读卡片素材（mock 模式下不混入真实金句）
  const readingCards: YearReadingCard[] = useMemo(() => {
    if (isShowingMock) return [];
    const prefix = `${currentYear}-`;
    return allQuotes
      .filter((q) => q.createdAt.startsWith(prefix))
      .map((q) => ({ createdAt: q.createdAt.slice(0, 10), text: q.text.slice(0, 120), book: q.book, author: q.author }));
  }, [allQuotes, currentYear, isShowingMock]);

  const stats = useMemo(() => computeYearStats(data), [data]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.resolve();
      if (cancelled) return;
      setIsAiLoading(true);
      setAi(null);
      const result = await generateYearSummary(data, readingCards).catch(() => null);
      if (cancelled) return;
      if (result) setAi(result);
      setIsAiLoading(false);
    })();
    return () => { cancelled = true; };
  }, [data, readingCards]);

  const regenerate = () => {
    setIsAiLoading(true);
    setAi(null);
    generateYearSummary(data, readingCards)
      .then((result) => setAi(result))
      .finally(() => setIsAiLoading(false));
  };

  return (
    <PageTransition className="mx-auto max-w-4xl space-y-10 pb-10">
      {/* 顶部工具行 */}
      <div className="flex items-center justify-end gap-3 text-xs" style={{ color: "var(--m-ink3)" }}>
        {isShowingMock && (
          <span className="rounded-full px-2.5 py-0.5" style={{ background: "rgba(220,146,100,0.15)", color: "#B4584A" }}>
            示例数据
          </span>
        )}
        <button
          className="rounded-full border px-3 py-1 transition hover:bg-[rgba(139,94,60,0.06)]"
          onClick={() => setUseMock((v) => !v)}
          style={{ borderColor: "var(--m-rule)" }}
          type="button"
        >
          {useMock ? "使用我的数据" : "查看示例"}
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 transition hover:-translate-y-0.5"
          disabled={isAiLoading}
          onClick={regenerate}
          style={{ borderColor: "var(--m-rule)", opacity: isAiLoading ? 0.6 : 1 }}
          type="button"
        >
          <RefreshCw className={isAiLoading ? "animate-spin" : ""} size={12} />
          重新生成
        </button>
      </div>

      {/* 封面 */}
      <Cover year={data.year} entries={stats.entries} yearKeyword={ai?.yearKeyword ?? null} isLoading={isAiLoading} />

      {isAiLoading && <ProjectingState />}

      {ai && !isAiLoading && (
        <>
          {/* 开场旁白 */}
          {ai.opening && <OpeningNarration text={ai.opening} />}

          {/* 数据插叙 */}
          <FadeIn>
            <div className="space-y-5">
              <DataStrip entries={stats.entries} study={stats.totalStudyHours} waste={stats.totalWasteHours} avgMood={stats.avgScore} />
              <TrendChart trend={stats.trend} />
            </div>
          </FadeIn>

          {/* 第一章 · 这一年的几个阶段 */}
          {ai.phases.length > 0 && (
            <section className="space-y-6">
              <FadeIn><ChapterHead no="壹" title="这一年的几个阶段" /></FadeIn>
              <PhaseChapters phases={ai.phases} />
            </section>
          )}

          {/* 第二章 · 日记里反复出现的词 */}
          {ai.keywords.length > 0 && (
            <section className="space-y-6">
              <FadeIn><ChapterHead no="贰" title="反复出现的词" /></FadeIn>
              <FadeIn delay={0.06}><KeywordWall keywords={ai.keywords} /></FadeIn>
            </section>
          )}

          {/* 第三章 · 镜头之外 / 重建 */}
          {(ai.lifeInference || ai.rebuilding) && (
            <section className="space-y-6">
              <FadeIn><ChapterHead no="叁" title="镜头之外" /></FadeIn>
              <EditorialSpread lifeInference={ai.lifeInference} rebuilding={ai.rebuilding} />
            </section>
          )}

          {/* 第四章 · 避难所与认知升级 */}
          {(ai.refuge || ai.upgradeMoments.length > 0) && (
            <section className="space-y-6">
              <FadeIn><ChapterHead no="肆" title="避难所与转折点" /></FadeIn>
              <RefugeCard refuge={ai.refuge} />
              <UpgradeMoments moments={ai.upgradeMoments} />
            </section>
          )}

          {/* 第五章 · 画像 + 目标档案 */}
          <section className="space-y-6">
            <FadeIn><ChapterHead no="伍" title="一份侧写" /></FadeIn>
            <ArchetypeCard archetype={ai.archetype} />
            {data.goals.length > 0 && <FadeIn delay={0.06}><GoalReviewCard goals={data.goals} /></FadeIn>}
          </section>

          {/* 终章 */}
          {ai.ending && (
            <EndingCredits ending={ai.ending} year={data.year} reason={ai.yearKeyword?.reason ?? ""} />
          )}
        </>
      )}
    </PageTransition>
  );
}
