"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * TimeHero — v5 year-progress hero with vintage pendulum clock.
 * Implements the timehero-spec exactly: 1.4fr/1fr two-column gradient
 * card, serif year/day numerals, italic subtitle, gradient progress bar,
 * mono month labels, accent link, and an SVG pendulum that swings.
 *
 * The pendulum animates via requestAnimationFrame writing to SVG's native
 * `transform="rotate(deg, cx, cy)"` attribute — not CSS animation on a
 * <g> element, because CSS transform-origin in px on SVG groups is
 * unreliable across browsers and several users reported the pendulum
 * appearing static. The RAF approach renders identically everywhere and
 * honours prefers-reduced-motion.
 *
 * Pure-frontend year stats (no API).
 */

function getYearStats() {
  const now = new Date();
  const year = now.getFullYear();
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const daysPassed = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1;
  const daysLeft = Math.floor((end.getTime() - now.getTime()) / 86400000);
  const yearPct = Math.round((daysPassed / 365) * 100);
  return { year, daysPassed, daysLeft, yearPct };
}

export function TimeHero({
  summaryHref = "/yearly-review",
}: {
  summaryHref?: string;
}) {
  const { year, daysPassed, daysLeft, yearPct } = getYearStats();

  // Pendulum swing — RAF + SVG transform attribute (cross-browser reliable).
  // Period = 4s round-trip; amplitude = ±8° per spec.
  const [angle, setAngle] = useState(-8);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    // Respect prefers-reduced-motion: leave the pendulum at rest angle.
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const phase = ((t - start) / 4000) * 2 * Math.PI; // 4s = one full back-and-forth
      // Ease-in-out via sine; amplitude 8°.
      setAngle(Math.sin(phase) * 8);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      style={{
        borderRadius: 28,
        padding: "36px 44px",
        background: "linear-gradient(135deg, var(--v5-card) 0%, #faecc8 100%)",
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
              background: "rgba(75,51,27,0.10)",
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

      {/* ── Right column · Pendulum SVG ── */}
      <div style={{ display: "grid", placeItems: "center", padding: 12 }}>
        <svg viewBox="0 0 160 200" width={180} height={220} aria-hidden>
          <defs>
            <radialGradient id="timehero-face" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff8e7" />
              <stop offset="100%" stopColor="#ead7b3" />
            </radialGradient>
          </defs>

          {/* Outer faces */}
          <circle cx="80" cy="80" r="58" fill="url(#timehero-face)" stroke="var(--v5-accent)" strokeWidth="1.6" />
          <circle cx="80" cy="80" r="52" fill="none" stroke="var(--v5-rule-strong)" strokeWidth="0.8" />

          {/* 12 hour ticks */}
          {Array.from({ length: 12 }, (_, h) => {
            const a = (h / 12) * 2 * Math.PI - Math.PI / 2;
            return (
              <line
                key={h}
                x1={80 + Math.cos(a) * 47}
                y1={80 + Math.sin(a) * 47}
                x2={80 + Math.cos(a) * 52}
                y2={80 + Math.sin(a) * 52}
                stroke="var(--v5-ink2)"
                strokeWidth="0.8"
              />
            );
          })}

          {/* Hour hand (straight up) */}
          <line x1="80" y1="80" x2="80" y2="50" stroke="var(--v5-ink)" strokeWidth="1.8" strokeLinecap="round" />
          {/* Minute hand (down-right) */}
          <line x1="80" y1="80" x2="102" y2="92" stroke="var(--v5-accent)" strokeWidth="2" strokeLinecap="round" />
          {/* Center pin */}
          <circle cx="80" cy="80" r="2.5" fill="var(--v5-ink)" />

          {/* Year label on face */}
          <text
            x="80"
            y="58"
            textAnchor="middle"
            fontFamily="serif"
            fontSize="6"
            fill="var(--v5-ink3)"
            fontStyle="italic"
          >
            {year}
          </text>

          {/* Pendulum arm + bob — RAF rotates around clock-face center (80,80) */}
          <g transform={`rotate(${angle.toFixed(2)} 80 80)`}>
            <line x1="80" y1="138" x2="80" y2="184" stroke="var(--v5-accent)" strokeWidth="1.2" />
            <circle cx="80" cy="188" r="9" fill="var(--v5-accent)" />
            <circle cx="80" cy="188" r="9" fill="none" stroke="rgba(75,51,27,0.18)" strokeWidth="1" />
          </g>
        </svg>
      </div>
    </div>
  );
}
