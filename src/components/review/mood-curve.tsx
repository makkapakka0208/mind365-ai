"use client";

import { useMemo, useState } from "react";

import { parseISODate, toISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

/**
 * 复盘页 · 情绪曲线：横轴是本周 / 本月的每一天，纵轴是心情 1–10。
 * 有记录的日子画成圆点并用平滑曲线相连，虚线标出平均分；悬停圆点显示当天分数。
 */

const W = 720;
const H = 200;
const PAD = { top: 18, right: 20, bottom: 30, left: 30 };
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const r2 = (n: number) => Math.round(n * 100) / 100;

type Point = { iso: string; mood: number; x: number; y: number };

/** 控制点限制在 1–10 分的绘图区内，避免曲线冲出 10 分线或掉到 1 分线以下 */
const clampY = (y: number) => r2(Math.min(H - PAD.bottom, Math.max(PAD.top, y)));

/** Catmull-Rom 转三次贝塞尔：穿过每个点的平滑曲线 */
function smoothPath(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = r2(p1.x + (p2.x - p0.x) / 6);
    const c1y = clampY(p1.y + (p2.y - p0.y) / 6);
    const c2x = r2(p2.x - (p3.x - p1.x) / 6);
    const c2y = clampY(p2.y - (p3.y - p1.y) / 6);
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function MoodCurve({
  logs,
  range,
  mode,
}: {
  logs: DailyLog[];
  range: { start: Date; end: Date };
  mode: "week" | "month";
}) {
  const [hover, setHover] = useState<Point | null>(null);

  const { days, points, avg, max, min } = useMemo(() => {
    const days: string[] = [];
    const cursor = new Date(range.start);
    cursor.setHours(0, 0, 0, 0);
    const end = toISODate(range.end);
    while (toISODate(cursor) <= end) {
      days.push(toISODate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    // 同一天多篇取平均
    const byDay = new Map<string, number[]>();
    for (const log of logs) {
      if (log.mood > 0) byDay.set(log.date, [...(byDay.get(log.date) ?? []), log.mood]);
    }

    const innerW = W - PAD.left - PAD.right;
    const innerH = H - PAD.top - PAD.bottom;
    const xOf = (i: number) => r2(PAD.left + (days.length <= 1 ? innerW / 2 : (i / (days.length - 1)) * innerW));
    const yOf = (mood: number) => r2(PAD.top + (1 - (mood - 1) / 9) * innerH);

    const points: Point[] = [];
    days.forEach((iso, i) => {
      const moods = byDay.get(iso);
      if (!moods) return;
      const mood = Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10;
      points.push({ iso, mood, x: xOf(i), y: yOf(mood) });
    });

    const avg = points.length ? points.reduce((a, p) => a + p.mood, 0) / points.length : null;
    const max = points.reduce<Point | null>((m, p) => (!m || p.mood > m.mood ? p : m), null);
    const min = points.reduce<Point | null>((m, p) => (!m || p.mood < m.mood ? p : m), null);
    return { days, points, avg, max, min, yOf, xOf };
  }, [logs, range.start, range.end]);

  if (points.length === 0) {
    return (
      <p className="mt-3 text-sm" style={{ color: "var(--v5-ink3)", fontFamily: "var(--v5-serif)" }}>
        这段时间还没有心情记录。
      </p>
    );
  }

  const yOf = (mood: number) => r2(PAD.top + (1 - (mood - 1) / 9) * (H - PAD.top - PAD.bottom));
  const baseY = H - PAD.bottom;
  const line = smoothPath(points);
  const area = points.length > 1 ? `${line} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z` : "";
  const dayLabel = (iso: string) => {
    const d = parseISODate(iso);
    return mode === "week" ? WEEKDAYS[d.getDay()] : `${d.getDate()} 日`;
  };

  // 横轴刻度：周 → 每天；月 → 1、8、15、22、29
  const ticks = days
    .map((iso, i) => ({ iso, i }))
    .filter(({ iso }) => mode === "week" || [1, 8, 15, 22, 29].includes(parseISODate(iso).getDate()));
  const xOfIndex = (i: number) =>
    r2(PAD.left + (days.length <= 1 ? (W - PAD.left - PAD.right) / 2 : (i / (days.length - 1)) * (W - PAD.left - PAD.right)));

  return (
    <div className="mt-3">
      {/* 摘要 */}
      <p className="m-0 flex flex-wrap gap-x-5 gap-y-1" style={{ fontFamily: "var(--v5-serif)", fontSize: 14.5, color: "var(--v5-ink3)" }}>
        {avg !== null && (
          <span>
            平均 <span style={{ fontSize: 18, color: "var(--v5-ink)" }}>{avg.toFixed(1)}</span>
          </span>
        )}
        {max && (
          <span>
            最高 <span style={{ fontSize: 18, color: "var(--v5-accent)" }}>{max.mood}</span>（{dayLabel(max.iso)}）
          </span>
        )}
        {min && points.length > 1 && (
          <span>
            最低 <span style={{ fontSize: 18, color: "var(--v5-ink)" }}>{min.mood}</span>（{dayLabel(min.iso)}）
          </span>
        )}
      </p>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block w-full" role="img" aria-label="情绪曲线">
        <defs>
          <linearGradient id="mood-curve-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "rgba(var(--v5-accent-rgb),0.22)" }} />
            <stop offset="100%" style={{ stopColor: "rgba(var(--v5-accent-rgb),0)" }} />
          </linearGradient>
        </defs>

        {/* 横向参考线：10 / 5 / 1 */}
        {[10, 5, 1].map((m) => (
          <g key={m}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yOf(m)} y2={yOf(m)} stroke="var(--v5-rule)" strokeWidth="1" />
            <text x={PAD.left - 8} y={yOf(m)} textAnchor="end" dominantBaseline="central" fontSize="11" fill="var(--v5-ink-mute)" fontFamily="var(--v5-serif)">
              {m}
            </text>
          </g>
        ))}

        {/* 平均线 */}
        {avg !== null && (
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={yOf(avg)}
            y2={yOf(avg)}
            stroke="var(--v5-accent)"
            strokeOpacity="0.5"
            strokeWidth="1"
            strokeDasharray="4 5"
          />
        )}

        {/* 曲线与面积 */}
        {area && <path d={area} fill="url(#mood-curve-area)" />}
        {points.length > 1 && <path d={line} fill="none" stroke="var(--v5-accent)" strokeWidth="2" strokeLinecap="round" />}

        {/* 圆点 */}
        {points.map((p) => (
          <g key={p.iso} onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} style={{ cursor: "default" }}>
            <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
            <circle cx={p.x} cy={p.y} r={hover?.iso === p.iso ? 5.5 : 4} fill="var(--v5-surface)" stroke="var(--v5-accent)" strokeWidth="2" />
          </g>
        ))}

        {/* 悬停标签 */}
        {hover && (
          <g pointerEvents="none">
            <text
              x={Math.min(Math.max(hover.x, PAD.left + 40), W - PAD.right - 40)}
              y={hover.y - 14}
              textAnchor="middle"
              fontSize="13"
              fill="var(--v5-ink)"
              fontFamily="var(--v5-serif)"
            >
              {dayLabel(hover.iso)} · {hover.mood}
            </text>
          </g>
        )}

        {/* 横轴 */}
        {ticks.map(({ iso, i }) => (
          <text key={iso} x={xOfIndex(i)} y={H - 8} textAnchor="middle" fontSize="11.5" fill="var(--v5-ink3)" fontFamily="var(--v5-serif)">
            {dayLabel(iso)}
          </text>
        ))}
      </svg>
    </div>
  );
}
