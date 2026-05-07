"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "rgba(139,94,60,0.1)" }}
      >
        <WifiOff size={36} style={{ color: "var(--m-accent)" }} />
      </div>
      <div className="space-y-2">
        <h1
          className="text-xl font-semibold"
          style={{ color: "var(--m-ink)", fontFamily: '"Noto Serif SC", serif' }}
        >
          暂时无法连接网络
        </h1>
        <p className="text-sm" style={{ color: "var(--m-ink3)" }}>
          别担心，你的日记数据已保存在本地。
          <br />
          连接网络后会自动同步。
        </p>
      </div>
      <button
        className="rounded-xl px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ background: "var(--m-accent)", color: "#fff" }}
        type="button"
        onClick={() => window.location.reload()}
      >
        重试连接
      </button>
    </div>
  );
}
