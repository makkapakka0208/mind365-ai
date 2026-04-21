"use client";

import {
  ArrowRight,
  CalendarDays,
  Hash,
  Moon,
  RefreshCw,
  Sparkles,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PageTransition, StaggerItem } from "@/components/ui/page-transition";
import { Panel } from "@/components/ui/panel";
import {
  buildMemoryCards,
  type MemoryCard,
  type MemoryTriggerType,
} from "@/lib/memory-triggers";
import { useDailyLogsStore } from "@/lib/storage-store";

const SERIF = '"Noto Serif SC", "Songti SC", serif';

function getExcerpt(text: string): string {
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return "这一天没有写下文字，只留下一段安静的空白。";
  return clean.length > 140 ? `${clean.slice(0, 140)}…` : clean;
}

// ── Trigger configs ────────────────────────────────────────────
const TRIGGER_CONFIG: Record<
  MemoryTriggerType,
  { Icon: typeof CalendarDays; accentColor: string; lineColor: string; bg: string }
> = {
  on_this_day: {
    Icon: CalendarDays,
    accentColor: "var(--m-accent)",
    lineColor: "rgba(139,94,60,0.45)",
    bg: "rgba(139,94,60,0.04)",
  },
  mood_echo: {
    Icon: Waves,
    accentColor: "#4E7A64",
    lineColor: "rgba(78,122,100,0.45)",
    bg: "rgba(78,122,100,0.04)",
  },
  long_forgotten: {
    Icon: Moon,
    accentColor: "#6264A0",
    lineColor: "rgba(98,100,160,0.4)",
    bg: "rgba(98,100,160,0.04)",
  },
  tag_resonance: {
    Icon: Hash,
    accentColor: "#727240",
    lineColor: "rgba(114,114,64,0.45)",
    bg: "rgba(114,114,64,0.04)",
  },
};

// ── Year progress hook ─────────────────────────────────────────
function useYearProgress() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 5, 0);
    const ms = tomorrow.getTime() - Date.now();
    const t = setTimeout(() => setNow(new Date()), Math.max(1000, ms));
    return () => clearTimeout(t);
  }, [now]);

  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const nextStart = new Date(year + 1, 0, 1);
  const DAY = 86400000;
  const daysInYear = Math.round((nextStart.getTime() - start.getTime()) / DAY);
  const daysPassed = Math.max(
    0,
    Math.min(daysInYear, Math.floor((now.getTime() - start.getTime()) / DAY) + 1),
  );
  const daysRemaining = Math.max(0, daysInYear - daysPassed);
  const pct = Math.round((daysPassed / daysInYear) * 100);

  return { year, daysPassed, daysRemaining, daysInYear, pct };
}

// ── Arc SVG (semicircle year meter) ───────────────────────────
function YearArcSVG({ pct }: { pct: number }) {
  const cx = 64, cy = 64, r = 50;
  // Angle: 180° (left) → 360° (right) via 270° (top) in screen coords
  const angleDeg = 180 + (pct / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;
  const dotX = cx + r * Math.cos(angleRad);
  const dotY = cy + r * Math.sin(angleRad);
  const lx = cx - r, ly = cy;
  const rx = cx + r, ry = cy;
  const largeArc = pct > 50 ? 1 : 0;

  return (
    <svg
      aria-hidden
      fill="none"
      viewBox="8 12 112 58"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Track */}
      <path
        d={`M ${lx},${ly} A ${r},${r} 0 0 0 ${rx},${ry}`}
        stroke="rgba(139,94,60,0.12)"
        strokeLinecap="round"
        strokeWidth="3"
      />
      {/* Progress */}
      {pct > 1 && (
        <path
          d={`M ${lx},${ly} A ${r},${r} 0 ${largeArc} 0 ${dotX},${dotY}`}
          stroke="var(--m-accent)"
          strokeLinecap="round"
          strokeOpacity="0.55"
          strokeWidth="3"
        />
      )}
      {/* Dot */}
      <circle cx={dotX} cy={dotY} fill="var(--m-accent)" opacity="0.8" r="5.5" />
      <circle cx={dotX} cy={dotY} fill="var(--m-base-light)" r="2.5" />
      {/* End ticks */}
      <line stroke="rgba(139,94,60,0.2)" strokeLinecap="round" strokeWidth="1.5"
        x1={lx} x2={lx - 5} y1={ly} y2={ly + 4} />
      <line stroke="rgba(139,94,60,0.2)" strokeLinecap="round" strokeWidth="1.5"
        x1={rx} x2={rx + 5} y1={ry} y2={ry + 4} />
      {/* Pct label */}
      <text dominantBaseline="middle" fill="var(--m-ink3)" fontFamily="system-ui"
        fontSize="11" textAnchor="middle" x={cx} y={cy - r + 18}>
        {pct}%
      </text>
    </svg>
  );
}

// ── Year progress panel ────────────────────────────────────────
function YearProgressPanel() {
  const { year, daysPassed, daysRemaining, pct } = useYearProgress();

  return (
    <Panel className="p-6 md:p-7">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
            TIME · 时间摆
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className="text-[2.6rem] font-semibold leading-none tracking-[-0.04em]"
              style={{ color: "var(--m-ink)", fontFamily: SERIF }}
            >
              {year}
            </span>
            <span className="text-sm" style={{ color: "var(--m-ink3)" }}>
              年已过去
            </span>
          </div>
        </div>
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
          style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
        >
          <CalendarDays size={18} />
        </span>
      </div>

      {/* Stats + arc */}
      <div className="mt-5 flex items-end gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-6">
            <div>
              <span
                className="block text-[2.2rem] font-semibold leading-none tracking-[-0.04em]"
                style={{ color: "var(--m-accent)", fontFamily: SERIF }}
              >
                {daysPassed}
              </span>
              <span className="mt-1 block text-xs" style={{ color: "var(--m-ink3)" }}>
                天已过
              </span>
            </div>
            <div
              className="h-9 w-px"
              style={{ background: "var(--m-rule)" }}
            />
            <div>
              <span
                className="block text-[2.2rem] font-light leading-none tracking-[-0.04em]"
                style={{ color: "var(--m-ink)", fontFamily: SERIF }}
              >
                {daysRemaining}
              </span>
              <span className="mt-1 block text-xs" style={{ color: "var(--m-ink3)" }}>
                天未至
              </span>
            </div>
          </div>

          {/* Progress line */}
          <div className="mt-5">
            <div
              className="h-1 w-full overflow-hidden rounded-full"
              style={{ background: "rgba(139,94,60,0.1)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-1000"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, var(--m-accent), rgba(165,106,67,0.6))",
                }}
              />
            </div>
            <div className="mt-1.5 flex justify-between">
              <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>1 月</span>
              <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>已走完 {pct}%</span>
              <span className="text-[10px]" style={{ color: "var(--m-ink3)" }}>12 月</span>
            </div>
          </div>
        </div>

        {/* Arc */}
        <div className="hidden w-32 shrink-0 sm:block">
          <YearArcSVG pct={pct} />
        </div>
      </div>
    </Panel>
  );
}

// ── Annual review entry panel ──────────────────────────────────
function AnnualReviewPanel() {
  const { year } = useYearProgress();

  return (
    <Link className="group block h-full" href="/year-review">
      <Panel
        className="flex h-full flex-col justify-between p-6 transition-all duration-300 group-hover:-translate-y-0.5 md:p-7"
        interactive
      >
        <div>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs font-medium tracking-[0.18em]" style={{ color: "var(--m-ink3)" }}>
              REVIEW · 年度回看
            </p>
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]"
              style={{ background: "rgba(139,94,60,0.08)", color: "var(--m-accent)" }}
            >
              <Sparkles size={18} />
            </span>
          </div>

          <h3
            className="mt-3 text-[1.9rem] font-semibold leading-tight tracking-[-0.03em]"
            style={{ color: "var(--m-ink)", fontFamily: SERIF }}
          >
            {year} 年度
            <br />
            <span style={{ color: "var(--m-accent)" }}>回看</span>
          </h3>

          <p className="mt-3 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
            把这一年的心境、投入与目标放在一页纸上，让 AI 帮你总结。
          </p>
        </div>

        <div
          className="mt-5 flex items-center gap-1.5 border-t border-dashed pt-4 text-sm font-medium"
          style={{
            borderColor: "rgba(139,94,60,0.12)",
            color: "var(--m-accent)",
          }}
        >
          翻开年度总结
          <ArrowRight
            className="transition-transform duration-200 group-hover:translate-x-1"
            size={14}
          />
        </div>
      </Panel>
    </Link>
  );
}

// ── Memory card ────────────────────────────────────────────────
function MemoryCardView({ card }: { card: MemoryCard }) {
  const { entry, trigger } = card;
  const excerpt = getExcerpt(entry.thoughts);
  const cfg = TRIGGER_CONFIG[trigger.type];
  const { Icon } = cfg;

  return (
    <Link className="group block" href={`/journal?id=${entry.id}`}>
      <div
        className="relative overflow-hidden rounded-xl border transition-all duration-250 group-hover:-translate-y-0.5"
        style={{
          background: cfg.bg,
          borderColor: "var(--m-rule)",
          boxShadow: "0 1px 6px rgba(139,94,60,0.03)",
          transitionProperty: "transform, box-shadow",
          transitionDuration: "250ms",
          transitionTimingFunction: "ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 4px 20px rgba(139,94,60,0.09)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow =
            "0 1px 6px rgba(139,94,60,0.03)";
        }}
      >
        {/* Left accent bar */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 top-0 w-[3px]"
          style={{ background: cfg.lineColor, borderRadius: "0 2px 2px 0" }}
        />

        <div className="px-6 py-5 pl-8 md:px-7 md:py-5 md:pl-9">
          {/* Trigger label row */}
          <div className="mb-3 flex items-center gap-2">
            <span
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: `${cfg.lineColor.replace("0.45", "0.12").replace("0.4", "0.12")}` }}
            >
              <Icon size={12} strokeWidth={1.8} style={{ color: cfg.accentColor }} />
            </span>
            <span
              className="text-[11px] font-medium tracking-[0.1em]"
              style={{ color: cfg.accentColor, opacity: 0.9 }}
            >
              {trigger.label}
            </span>
          </div>

          {/* Excerpt */}
          <p
            className="text-[15px] leading-[1.9]"
            style={{ color: "var(--m-ink)", fontFamily: SERIF }}
          >
            {excerpt}
          </p>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--m-ink3)" }}>
              {trigger.subLabel}
            </span>
            <span
              className="flex items-center gap-1 text-[11px] font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ color: cfg.accentColor }}
            >
              阅读全文
              <ArrowRight size={11} />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Empty state ────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-dashed px-6 py-12 text-center"
      style={{ borderColor: "rgba(139,94,60,0.16)" }}
    >
      <p className="text-sm leading-8" style={{ color: "var(--m-ink2)", fontFamily: SERIF }}>
        {message}
      </p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────
export default function TimelinePage() {
  const logs = useDailyLogsStore();
  const [refreshKey, setRefreshKey] = useState(0);

  const cards = useMemo(
    () => buildMemoryCards(logs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [logs, refreshKey],
  );

  const isEmpty = logs.length === 0;

  return (
    <PageTransition>
      <div className="w-full space-y-5 md:space-y-6">

        {/* ── Page header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 px-1 py-2">
          <div>
            <p
              className="text-xs font-medium tracking-[0.18em]"
              style={{ color: "var(--m-ink3)" }}
            >
              MEMORY · 旧日回响
            </p>
            <h1
              className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]"
              style={{ color: "var(--m-ink)", fontFamily: SERIF }}
            >
              去年今日
            </h1>
            <p className="mt-1 text-sm leading-7" style={{ color: "var(--m-ink3)" }}>
              你已经走了很远，偶尔让旧日记来提醒你从哪里出发。
            </p>
          </div>
          <span
            className="hidden shrink-0 items-center justify-center rounded-[14px] h-10 w-10 md:flex"
            style={{ background: "rgba(139,94,60,0.07)", color: "var(--m-accent)" }}
          >
            <Sparkles size={18} />
          </span>
        </div>

        {/* ── Year stats + annual review ───────────────────────── */}
        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr] md:gap-6">
          <YearProgressPanel />
          <AnnualReviewPanel />
        </div>

        {/* ── Memory entries panel ─────────────────────────────── */}
        <Panel className="p-6 md:p-7">
          <div
            className="flex items-center justify-between border-b border-dashed pb-5"
            style={{ borderColor: "rgba(139,94,60,0.12)" }}
          >
            <div>
              <p
                className="text-xs font-medium tracking-[0.18em]"
                style={{ color: "var(--m-ink3)" }}
              >
                RECALL · 记忆碎片
              </p>
              <h2
                className="mt-2 text-xl font-semibold tracking-tight"
                style={{ color: "var(--m-ink)" }}
              >
                今日触发的旧日记忆
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {!isEmpty && cards.length > 0 && (
                <button
                  className="group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 hover:-translate-y-0.5"
                  onClick={() => setRefreshKey((k) => k + 1)}
                  style={{
                    borderColor: "rgba(139,94,60,0.18)",
                    background: "transparent",
                    color: "var(--m-ink2)",
                  }}
                  type="button"
                >
                  <RefreshCw
                    className="transition-transform duration-300 group-hover:rotate-180"
                    size={11}
                  />
                  再翻一翻
                </button>
              )}
              {!isEmpty && cards.length > 0 && (
                <span
                  className="rounded-full border px-3 py-1.5 text-xs"
                  style={{ borderColor: "rgba(139,94,60,0.12)", color: "var(--m-ink3)" }}
                >
                  {cards.length} 条
                </span>
              )}
            </div>
          </div>

          <div className="mt-5">
            {isEmpty ? (
              <EmptyState message="还没有足够的记录。继续写下去，未来的你会感谢现在的你。" />
            ) : cards.length === 0 ? (
              <EmptyState message="正在翻开旧日记…" />
            ) : (
              <div className="grid gap-3">
                {cards.map((card, i) => (
                  <StaggerItem index={i} key={`${card.entry.id}-${card.trigger.type}`}>
                    <MemoryCardView card={card} />
                  </StaggerItem>
                ))}
              </div>
            )}
          </div>

        </Panel>
      </div>
    </PageTransition>
  );
}
