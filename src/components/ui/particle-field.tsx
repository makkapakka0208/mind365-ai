"use client";

import { useEffect, useRef } from "react";

/**
 * ParticleField — 轻量的飘尘/微光粒子层（canvas，绝对定位铺满父容器）。
 * 用于电影化封面/终章，营造放映机里浮动尘埃的质感。
 * - requestAnimationFrame 驱动，离屏时自动暂停
 * - 尊重 prefers-reduced-motion：开启后只画静态一帧
 * - 纯装饰，pointer-events: none
 */
export function ParticleField({
  className,
  color = "200, 154, 110",
  count = 36,
  speed = 0.18,
}: {
  className?: string;
  /** 粒子颜色的 RGB 部分，如 "200, 154, 110" */
  color?: string;
  count?: number;
  speed?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    type P = { x: number; y: number; r: number; vx: number; vy: number; a: number; ta: number };
    let particles: P[] = [];

    const seed = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.6 + 0.4,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed - speed * 0.3, // 整体略微上飘
        a: Math.random() * 0.5 + 0.1,
        ta: Math.random() * 0.5 + 0.1,
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        // 缓慢呼吸式明暗
        p.a += (p.ta - p.a) * 0.02;
        if (Math.abs(p.a - p.ta) < 0.01) p.ta = Math.random() * 0.5 + 0.1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${color}, ${p.a})`;
        ctx.fill();
      }
    };

    const tick = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -4) p.x = w + 4;
        else if (p.x > w + 4) p.x = -4;
        if (p.y < -4) p.y = h + 4;
        else if (p.y > h + 4) p.y = -4;
      }
      draw();
      raf = requestAnimationFrame(tick);
    };

    // 仅在「可见 + 页面在前台」时跑动画，离开视口或切后台即暂停，省电省 CPU。
    let onScreen = true;
    let running = false;
    const start = () => {
      if (running || reduced) return;
      running = true;
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    const sync = () => {
      if (onScreen && document.visibilityState === "visible") start();
      else stop();
    };

    resize();
    draw();

    const io = new IntersectionObserver(
      (entries) => { onScreen = entries.some((e) => e.isIntersecting); sync(); },
      { threshold: 0 },
    );
    io.observe(canvas);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("resize", resize);
    sync();

    return () => {
      stop();
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("resize", resize);
    };
  }, [color, count, speed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
