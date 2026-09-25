"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

/**
 * TimeHero — 年度进度卡片：左侧年份 / 天数 / 进度条，右侧「星盘式年轮」YearDial。
 * YearDial 的刻度、月相、动态层次见其注释；全部颜色走主题 token，四套主题通用。
 * 纯前端计算，无 API。
 */

const ROMAN_MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

function toRoman(n: number) {
  const table: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, r] of table) {
    while (n >= v) {
      out += r;
      n -= v;
    }
  }
  return out;
}

export function getYearStats() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const daysInYear = Math.round((new Date(year + 1, 0, 1).getTime() - start.getTime()) / 86400000);
  const daysPassed = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  const daysLeft = daysInYear - daysPassed;
  const yearPct = Math.round((daysPassed / daysInYear) * 100);
  return { year, month: now.getMonth(), daysInYear, daysPassed, daysLeft, yearPct };
}

// ── 年轮几何 ──────────────────────────────────────────────────
const C = 130; // 中心
const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  // 取两位小数：服务端与浏览器的三角函数末位精度不同，避免水合不一致
  return { x: Math.round((C + Math.cos(rad) * r) * 100) / 100, y: Math.round((C + Math.sin(rad) * r) * 100) / 100 };
};

const noopSubscribe = () => () => {};

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReduced(cb: () => void) {
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
/** 系统「减少动态效果」开关（SSR 时按不减少渲染）。 */
function useReducedMotion() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED_QUERY).matches, () => false);
}

/** 秒点：每分钟绕内轨一周，从当前秒数对应的角度开始（只在客户端渲染）。 */
function SecondOrbit() {
  const [startDeg] = useState(() => {
    const d = new Date();
    return (d.getSeconds() + d.getMilliseconds() / 1000) * 6;
  });
  return (
    <g>
      <circle cx={C} cy={C - 80} r={1.8} fill="var(--v5-accent)" />
      <animateTransform
        attributeName="transform"
        type="rotate"
        from={`${startDeg} ${C} ${C}`}
        to={`${startDeg + 360} ${C} ${C}`}
        dur="60s"
        repeatCount="indefinite"
      />
    </g>
  );
}

/** 绕中心匀速旋转（SMIL，跨浏览器比 CSS transform-origin 可靠）。 */
function Spin({ dur, reverse = false }: { dur: number; reverse?: boolean }) {
  return (
    <animateTransform
      attributeName="transform"
      type="rotate"
      from={`0 ${C} ${C}`}
      to={`${reverse ? -360 : 360} ${C} ${C}`}
      dur={`${dur}s`}
      repeatCount="indefinite"
    />
  );
}

/**
 * 星盘式年轮。动态克制，只有三处：
 * 1. 载入时已过的日刻度从一月依次点亮到今天（只播一次）；
 * 2. 秒点每分钟绕内轨一周；
 * 3. 点状内圈极慢地逆时针转动。
 * 系统开启「减少动态效果」时全部静止。
 * compact：小尺寸（手机卡片）时省掉月份数字和中央小字，否则缩小后文字不可读。
 */
export function YearDial({
  year,
  month,
  daysInYear,
  daysPassed,
  size = 250,
  compact = false,
}: {
  year: number;
  month: number;
  daysInYear: number;
  daysPassed: number;
  size?: number;
  compact?: boolean;
}) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const reduced = useReducedMotion();
  const animate = !reduced;

  const dayDeg = (day: number) => (day / daysInYear) * 360 - 90; // day 从 0 开始
  const todayDeg = dayDeg(daysPassed - 0.5);

  // 每月第一天是一年中的第几天（0 起）
  const monthStarts = Array.from({ length: 12 }, (_, m) =>
    Math.round((new Date(year, m, 1).getTime() - new Date(year, 0, 1).getTime()) / 86400000),
  );
  const monthStartSet = new Set(monthStarts);

  const ticks = Array.from({ length: daysInYear }, (_, d) => {
    const isMonthStart = monthStartSet.has(d);
    const deg = dayDeg(d);
    return {
      d,
      p1: polar(deg, isMonthStart ? 104 : 110),
      p2: polar(deg, 118),
      isMonthStart,
      passed: d < daysPassed,
    };
  });

  const tip = polar(todayDeg, 106);
  const tipBack = polar(todayDeg, 96);
  const tipL = polar(todayDeg - 2.2, 100);
  const tipR = polar(todayDeg + 2.2, 100);
  const handStart = polar(todayDeg, compact ? 58 : 50);
  const marker = polar(todayDeg, 122);

  return (
    <svg
      viewBox="0 0 260 260"
      width={size}
      height={size}
      aria-hidden
      className={animate ? "year-dial is-animated" : "year-dial"}
      style={{ overflow: "visible", flexShrink: 0 }}
    >
      <defs>
        <radialGradient id="yeardial-face" cx="50%" cy="42%" r="60%">
          <stop offset="0%" style={{ stopColor: "rgba(var(--v5-accent-rgb), 0.12)" }} />
          <stop offset="100%" style={{ stopColor: "rgba(var(--v5-accent-rgb), 0.02)" }} />
        </radialGradient>
        <filter id="yeardial-glow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>

      {/* 外圈发丝线 */}
      <circle cx={C} cy={C} r={125} fill="none" stroke="var(--v5-rule-strong)" strokeWidth="0.6" />

      {/* 日刻度：未过的淡色底 + 已过的依次点亮 */}
      {ticks.map((t) => (
        <line
          key={t.d}
          x1={t.p1.x}
          y1={t.p1.y}
          x2={t.p2.x}
          y2={t.p2.y}
          className={t.passed ? "year-dial-tick" : undefined}
          style={t.passed ? { animationDelay: `${Math.round((t.d / Math.max(daysPassed, 1)) * 1100)}ms` } : undefined}
          stroke={t.passed ? "var(--v5-accent)" : "var(--v5-ink3)"}
          strokeOpacity={t.passed ? (t.isMonthStart ? 1 : 0.75) : t.isMonthStart ? 0.45 : 0.18}
          strokeWidth={t.isMonthStart ? 1.1 : 0.55}
          strokeLinecap="round"
        />
      ))}

      {/* 月份罗马数字（放在每月中点） */}
      {!compact && monthStarts.map((start, m) => {
        const end = m < 11 ? monthStarts[m + 1] : daysInYear;
        const p = polar(dayDeg((start + end) / 2), 93);
        const current = m === month;
        return (
          <text
            key={m}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--v5-serif)"
            fontSize={current ? 11 : 9.5}
            fontWeight={current ? 600 : 500}
            letterSpacing="0.04em"
            fill={current ? "var(--v5-accent)" : "var(--v5-ink3)"}
            fillOpacity={current ? 1 : 0.8}
          >
            {ROMAN_MONTHS[m]}
          </text>
        );
      })}

      {/* 内轨 + 表盘 */}
      <circle cx={C} cy={C} r={82} fill="url(#yeardial-face)" stroke="var(--v5-rule-strong)" strokeWidth="0.7" />

      {/* 雕纹放射线 */}
      <g stroke="var(--v5-accent)" strokeOpacity="0.16" strokeWidth="0.4" fill="none">
        {Array.from({ length: 60 }, (_, i) => {
          const deg = (i / 60) * 360;
          const p1 = polar(deg, i % 5 === 0 ? 42 : 50);
          const p2 = polar(deg, 58);
          return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} />;
        })}
        <circle cx={C} cy={C} r={42} />
      </g>

      {/* 点状内圈：逆时针慢转 */}
      <g>
        <circle
          cx={C}
          cy={C}
          r={76}
          fill="none"
          stroke="var(--v5-accent)"
          strokeOpacity="0.35"
          strokeWidth="0.9"
          strokeDasharray="0.1 5.2"
          strokeLinecap="round"
        />
        {animate && <Spin dur={90} reverse />}
      </g>

      {/* 秒点 */}
      {isClient && animate && <SecondOrbit />}

      {/* 今天：指针 + 菱形针尖 + 外圈小光点 */}
      <line
        x1={handStart.x}
        y1={handStart.y}
        x2={tipBack.x}
        y2={tipBack.y}
        stroke="var(--v5-accent)"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      <path
        d={`M ${tipBack.x} ${tipBack.y} L ${tipL.x} ${tipL.y} L ${tip.x} ${tip.y} L ${tipR.x} ${tipR.y} Z`}
        fill="var(--v5-accent)"
      />
      <circle cx={marker.x} cy={marker.y} r={3.2} fill="var(--v5-accent)" opacity="0.35" filter="url(#yeardial-glow)" />
      <circle cx={marker.x} cy={marker.y} r={2.2} fill="var(--v5-accent)" />

      {/* 中央：今年第几天 */}
      {compact ? (
        <text
          x={C}
          y={C + 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="var(--v5-serif)"
          fontSize="54"
          fontWeight="500"
          fill="var(--v5-ink)"
          style={{ fontFeatureSettings: '"lnum" 1' }}
        >
          {daysPassed}
        </text>
      ) : (
        <>
          <text
            x={C}
            y={C - 21}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--v5-serif)"
            fontSize="8"
            fontWeight="600"
            letterSpacing="0.34em"
            fill="var(--v5-ink3)"
          >
            DIES
          </text>
          <text
            x={C}
            y={C + 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--v5-serif)"
            fontSize="34"
            fontWeight="500"
            fill="var(--v5-ink)"
            style={{ fontFeatureSettings: '"lnum" 1' }}
          >
            {daysPassed}
          </text>
          <line x1={C - 14} y1={C + 22} x2={C + 14} y2={C + 22} stroke="var(--v5-accent)" strokeOpacity="0.5" strokeWidth="0.6" />
          <text
            x={C}
            y={C + 33}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--v5-serif)"
            fontSize="8.5"
            fontWeight="600"
            letterSpacing="0.28em"
            fill="var(--v5-accent)"
          >
            {toRoman(year)}
          </text>
        </>
      )}
    </svg>
  );
}

export function TimeHero({
  summaryHref = "/yearly-review",
}: {
  summaryHref?: string;
}) {
  const { year, month, daysInYear, daysPassed, daysLeft, yearPct } = getYearStats();

  return (
    <div
      style={{
        borderRadius: 28,
        padding: "36px 44px",
        background: "linear-gradient(135deg, var(--v5-card) 0%, var(--v5-card-grad) 100%)",
        boxShadow: "var(--v5-sh-3)",
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 32,
        alignItems: "center",
      }}
    >
      {/* ── Left column ── */}
      <div>
        {/* Layer 1 · 年份大字 */}
        <h2
          style={{
            margin: 0,
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 144, "SOFT" 60',
            fontWeight: 400,
            fontSize: 52,
            lineHeight: 1,
            letterSpacing: "-0.04em",
            color: "var(--v5-ink)",
          }}
        >
          {year} 年
        </h2>

        {/* Layer 2 · 天数统计行 */}
        <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 16 }}>
          <div>
            <div
              style={{
                fontFamily: "var(--v5-serif)",
                fontVariationSettings: '"opsz" 144',
                fontSize: 34,
                color: "var(--v5-ink)",
                letterSpacing: "-0.04em",
              }}
            >
              {daysPassed}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--v5-ink3)",
                marginTop: 2,
                fontFamily: "var(--v5-sans)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              天已过
            </div>
          </div>

          <div style={{ width: 1, height: 32, background: "var(--v5-rule-strong)", flexShrink: 0 }} />

          <div>
            <div
              style={{
                fontFamily: "var(--v5-serif)",
                fontVariationSettings: '"opsz" 144',
                fontSize: 34,
                color: "var(--v5-ink2)",
                letterSpacing: "-0.04em",
              }}
            >
              {daysLeft}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--v5-ink3)",
                marginTop: 2,
                fontFamily: "var(--v5-sans)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              天未至
            </div>
          </div>
        </div>

        {/* Layer 3 · 斜体副标题 */}
        <p
          style={{
            margin: "16px 0 0",
            fontFamily: "var(--v5-serif)",
            fontVariationSettings: '"opsz" 14',
            fontStyle: "italic",
            fontSize: 14.5,
            color: "var(--v5-ink2)",
            maxWidth: 360,
            lineHeight: 1.65,
          }}
        >
          已陪你走过 {daysPassed} 天，还有 {daysLeft} 个明天等着你写下来。
        </p>

        {/* Layer 4 · 年度进度条 */}
        <div style={{ marginTop: 20 }}>
          <div
            style={{
              height: 3,
              background: "rgba(var(--v5-ink-rgb),0.10)",
              borderRadius: 999,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: 3,
                width: `${yearPct}%`,
                background:
                  "linear-gradient(90deg, var(--v5-accent) 0%, var(--v5-accent-soft) 100%)",
                borderRadius: 999,
                transition: "width var(--v5-dur-slow) var(--v5-ease-out)",
              }}
            />
          </div>
          <div
            style={{
              marginTop: 6,
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--v5-mono)",
              fontSize: 10.5,
              color: "var(--v5-ink3)",
            }}
          >
            <span>1 月</span>
            <span>已走完 {yearPct}%</span>
            <span>12 月</span>
          </div>
        </div>

        {/* Layer 5 · 年度总结链接 */}
        <Link
          href={summaryHref}
          style={{
            marginTop: 22,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--v5-sans)",
            fontSize: 13,
            fontWeight: 500,
            color: "var(--v5-accent)",
            textDecoration: "underline",
            textDecorationColor: "var(--v5-rule-strong)",
            textUnderlineOffset: 4,
          }}
        >
          翻开 {year} 年度总结 →
        </Link>
      </div>

      {/* ── Right column · 年轮 ── */}
      <div style={{ display: "grid", placeItems: "center", padding: 8 }}>
        <YearDial year={year} month={month} daysInYear={daysInYear} daysPassed={daysPassed} />
      </div>
    </div>
  );
}
