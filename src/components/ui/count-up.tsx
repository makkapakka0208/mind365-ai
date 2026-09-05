"use client";

import { useEffect, useRef, useState } from "react";

/**
 * CountUp — 数字从 0 滚动到目标值（ease-out），用于 KPI 大数字。
 * - 解析字符串里的数字（保留小数位与原格式），非数字（如 "--"）原样显示
 * - 进入视口才开始，只播一次；尊重 prefers-reduced-motion
 */
export function CountUp({
  value,
  duration = 900,
  className,
  style,
}: {
  value: string;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const match = value.match(/-?\d+(\.\d+)?/);
  const target = match ? parseFloat(match[0]) : null;
  const decimals = match && match[1] ? match[1].length - 1 : 0;
  const prefix = match ? value.slice(0, match.index) : "";
  const suffix = match ? value.slice((match.index ?? 0) + match[0].length) : "";

  const [display, setDisplay] = useState(target ?? 0);
  const ref = useRef<HTMLSpanElement>(null);
  const played = useRef(false);

  useEffect(() => {
    if (target === null) return;
    const node = ref.current;
    if (!node) return;

    // reduced-motion：display 初值已等于 target，直接保持静态即可
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const run = () => {
      if (played.current) return;
      played.current = true;
      setDisplay(0); // 从 0 起跳（异步回调内，不在 effect 体同步调用）
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        setDisplay(target * eased);
        if (t < 1) requestAnimationFrame(tick);
        else setDisplay(target);
      };
      requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [target, duration]);

  if (target === null) {
    return <span className={className} style={style}>{value}</span>;
  }

  return (
    <span ref={ref} className={className} style={style}>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}
