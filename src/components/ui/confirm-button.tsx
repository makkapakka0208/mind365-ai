"use client";

import { useEffect, useState } from "react";

/**
 * 两步确认按钮：第一次点击变成「确认…？」，几秒内再点一次才执行。
 * 代替 window.confirm——部分内嵌浏览器会直接把系统确认框当作「取消」。
 */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  className,
  style,
  confirmStyle,
  title,
}: {
  children: React.ReactNode;
  confirmLabel: React.ReactNode;
  onConfirm: () => void;
  className?: string;
  style?: React.CSSProperties;
  confirmStyle?: React.CSSProperties;
  title?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      title={title}
      className={className}
      style={armed ? { ...style, color: "#b4533c", borderColor: "rgba(180,83,60,0.5)", ...confirmStyle } : style}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}
