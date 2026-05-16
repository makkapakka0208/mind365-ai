"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 时间摆（TimePendulum）— 复古机械摆钟样式的「年内进度」可视化组件。
 * - 表盘：12 月制圆盘，时针 = 整年进度，分针 = 当月进度
 * - 摆锤：持续左右摆动（带 3 道余影）
 * - 纯 SVG，配色全部硬编码（不跟随主题反转）
 */
export function TimePendulum({ className }: { className?: string }) {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef<number>(0);

  useEffect(() => {
    startedAt.current = performance.now();
    const loop = (ts: number) => {
      const elapsed = (ts - startedAt.current) / 1000;
      // SPEED ~ 1.3 rad/s — 一次完整摆动约 4.8s，缓而克制
      setTick(elapsed * 1.3);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── 当前日期 ────────────────────────────────────────────────
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();         // 0-11
  const day = now.getDate();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // 时针（年进度）— 月+当月小数 / 12
  const progress = (month + day / daysInMonth) / 12;
  const hourAngleDeg = progress * 360 - 90;

  // 分针（月进度）
  const minuteProgress = day / daysInMonth;
  const minAngleDeg = minuteProgress * 360 - 90;

  // 年百分比（用于环 + 文字）
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year + 1, 0, 1).getTime();
  const yearPct = (now.getTime() - yearStart) / (yearEnd - yearStart);
  const yearPctRound = Math.round(yearPct * 100);

  // ── 几何参数 ────────────────────────────────────────────────
  const cx = 60, cy = 62;
  const dialR = 42;
  const arcR = 32;

  // 指针终点
  const hourX = cx + Math.cos((hourAngleDeg * Math.PI) / 180) * 20;
  const hourY = cy + Math.sin((hourAngleDeg * Math.PI) / 180) * 20;
  const minX = cx + Math.cos((minAngleDeg * Math.PI) / 180) * 28;
  const minY = cy + Math.sin((minAngleDeg * Math.PI) / 180) * 28;

  // 进度弧
  const arcAngleDeg = yearPct * 360 - 90;
  const arcEndX = cx + Math.cos((arcAngleDeg * Math.PI) / 180) * arcR;
  const arcEndY = cy + Math.sin((arcAngleDeg * Math.PI) / 180) * arcR;
  const arcLarge = yearPct > 0.5 ? 1 : 0;
  const arcPath =
    yearPct > 0.001
      ? `M ${cx},${cy - arcR} A ${arcR},${arcR} 0 ${arcLarge} 1 ${arcEndX},${arcEndY}`
      : "";

  // ── 摆锤参数 ────────────────────────────────────────────────
  const pivotX = cx, pivotY = 130;
  const rodLen = 58;
  const bobY = pivotY + rodLen;
  const MAX_ANGLE = 18;

  const eased = (t: number) => {
    const s = Math.sin(t);
    return Math.sign(s) * Math.pow(Math.abs(s), 0.75) * MAX_ANGLE;
  };

  const angle = eased(tick);
  const echoes = [
    { a: eased(tick - 1.4), op: 0.45, w: 1.2 },
    { a: eased(tick - 2.6), op: 0.3, w: 0.9 },
    { a: eased(tick - 4.2), op: 0.2, w: 0.6 },
  ];

  // ── 刻度 ────────────────────────────────────────────────────
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * 360 - 90;
    const isHour = i % 5 === 0;
    const inner = dialR - (isHour ? 5 : 2.5);
    const outer = dialR - 1;
    const rad = (a * Math.PI) / 180;
    return {
      x1: cx + Math.cos(rad) * inner,
      y1: cy + Math.sin(rad) * inner,
      x2: cx + Math.cos(rad) * outer,
      y2: cy + Math.sin(rad) * outer,
      width: isHour ? 1.2 : 0.5,
      key: i,
    };
  });

  // 罗马数字 — 12/3/6/9
  const romans = [
    { x: cx, y: cy - dialR + 10, label: "Ⅰ" },
    { x: cx + dialR - 10, y: cy + 0.5, label: "Ⅳ" },
    { x: cx, y: cy + dialR - 7, label: "Ⅶ" },
    { x: cx - dialR + 10, y: cy + 0.5, label: "Ⅹ" },
  ];

  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 120 210"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* ── 钟体外壳 ── */}
      <rect
        x="4" y="4" width="112" height="124" rx="14"
        fill="#fdf6ed" stroke="#ddd0bc" strokeWidth="1.2"
      />
      <rect
        x="4" y="4" width="112" height="124" rx="14"
        fill="none" stroke="rgba(92,64,48,0.04)" strokeWidth="3"
      />

      {/* ── 表圈 ── */}
      <circle cx={cx} cy={cy} r={dialR + 6} fill="#f4e8d4" />
      <circle cx={cx} cy={cy} r={dialR + 6} fill="none" stroke="#c8b4a0" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={dialR + 3} fill="none" stroke="#ddd0bc" strokeWidth="0.6" />

      {/* ── 表面 ── */}
      <circle cx={cx} cy={cy} r={dialR} fill="#fdf6ed" />

      {/* 进度弧 — 全圈底 */}
      <circle cx={cx} cy={cy} r={arcR} fill="none" stroke="rgba(139,94,60,0.10)" strokeWidth="1.5" />
      {/* 进度弧 — 已过部分 */}
      {arcPath && (
        <path
          d={arcPath}
          fill="none"
          stroke="#8b6f5c"
          strokeWidth="1.5"
          strokeLinecap="round"
          opacity="0.55"
        />
      )}

      {/* 60 刻度 */}
      {ticks.map((t) => (
        <line
          key={t.key}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#8b6f5c"
          strokeWidth={t.width}
          strokeLinecap="round"
        />
      ))}

      {/* 罗马数字 */}
      {romans.map((r) => (
        <text
          key={r.label}
          x={r.x} y={r.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="7.5"
          fill="#5c4030"
          fontFamily="'Noto Serif SC', serif"
          fontWeight="500"
        >
          {r.label}
        </text>
      ))}

      {/* 年份 + 百分比 */}
      <text
        x={cx} y={cy + 14}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="6"
        fill="#9c8060"
        fontFamily="'Noto Serif SC', serif"
        letterSpacing="0.1em"
      >
        {year} · {yearPctRound}%
      </text>

      {/* 分针 */}
      <line
        x1={cx} y1={cy} x2={minX} y2={minY}
        stroke="#8b6f5c"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* 时针 */}
      <line
        x1={cx} y1={cy} x2={hourX} y2={hourY}
        stroke="#5c4030"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* 表心 */}
      <circle cx={cx} cy={cy} r="3.5" fill="#8b6f5c" />
      <circle cx={cx} cy={cy} r="1.5" fill="#fdf6ed" />

      {/* ── 颈部连接 ── */}
      <rect x={cx - 5} y="124" width="10" height="8" rx="1.5" fill="#c8b4a0" />
      <rect x={cx - 5} y="124" width="10" height="8" rx="1.5" fill="none" stroke="#8b6f5c" strokeWidth="0.5" />

      {/* ── 余影（先画，置底） ── */}
      {echoes.map((e, i) => {
        const rad = (e.a * Math.PI) / 180;
        const tipX = pivotX + Math.sin(rad) * rodLen;
        const tipY = pivotY + Math.cos(rad) * rodLen;
        return (
          <line
            key={`echo-${i}`}
            x1={pivotX} y1={pivotY}
            x2={tipX} y2={tipY}
            stroke="#8b6f5c"
            strokeWidth={e.w}
            opacity={e.op}
            strokeLinecap="round"
          />
        );
      })}

      {/* ── 摆锤组（整体旋转） ── */}
      <g transform={`rotate(${angle}, ${pivotX}, ${pivotY})`}>
        {/* 悬挂铆钉 */}
        <circle cx={pivotX} cy={pivotY} r="2" fill="#5c4030" />

        {/* 摆杆 */}
        <line
          x1={pivotX} y1={pivotY}
          x2={pivotX} y2={bobY - 10}
          stroke="#8b6f5c"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        {/* 中段装饰节 */}
        <ellipse
          cx={pivotX}
          cy={pivotY + rodLen * 0.5}
          rx="2.8"
          ry="4.5"
          fill="#c8b4a0"
          stroke="#8b6f5c"
          strokeWidth="0.4"
        />

        {/* 摆锤外晕 */}
        <circle cx={pivotX} cy={bobY} r="12" fill="rgba(139,94,60,0.08)" />
        {/* 摆锤主体 */}
        <circle
          cx={pivotX} cy={bobY}
          r="9.5"
          fill="#c8b4a0"
          stroke="#8b6f5c"
          strokeWidth="0.8"
        />
        {/* 内刻纹 */}
        <circle cx={pivotX} cy={bobY} r="6.5" fill="none" stroke="#8b6f5c" strokeWidth="0.5" opacity="0.45" />
        <circle cx={pivotX} cy={bobY} r="3.8" fill="none" stroke="#8b6f5c" strokeWidth="0.4" opacity="0.55" />
        {/* 中心点 */}
        <circle cx={pivotX} cy={bobY} r="1.2" fill="#5c4030" />
      </g>
    </svg>
  );
}
