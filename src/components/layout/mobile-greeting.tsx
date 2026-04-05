"use client";

import { useEffect, useState } from "react";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "夜深了";
  if (h < 12) return "早上好";
  if (h < 14) return "中午好";
  if (h < 18) return "下午好";
  return "晚上好";
}

function formatToday(): string {
  const d = new Date();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`;
}

export function MobileGreeting() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="m-greeting md:hidden">
      <h1>{getGreeting()}，记录者</h1>
      <p>{formatToday()}</p>
    </div>
  );
}
