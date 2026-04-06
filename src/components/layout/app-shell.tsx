"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { desktopNavItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: React.ReactNode;
}

const PATH_GROUPS: Record<string, string[]> = {
  "/": ["/"],
  "/record": ["/record", "/daily-log", "/journal"],
  "/timeline": ["/timeline"],
  "/library": ["/library", "/quotes"],
  "/notes": ["/notes"],
  "/review": ["/review", "/weekly-review", "/monthly-review", "/yearly-review", "/review-history"],
  "/analytics": ["/analytics"],
  "/settings": ["/settings", "/me"],
};

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const matchers = PATH_GROUPS[href] ?? [href];
    return matchers.some((matcher) => (matcher === "/" ? pathname === "/" : pathname.startsWith(matcher)));
  };

  return (
    <div className="relative h-screen overflow-hidden" style={{ color: "var(--m-ink)" }}>
      <div className="mx-auto flex h-full w-full max-w-[1500px] gap-0 md:gap-4 px-0 md:px-4">
        
        {/* ── Desktop Sidebar ── */}
        <aside
          className="hidden h-full w-72 shrink-0 flex-col overflow-hidden md:my-5 md:flex"
          style={{
            background: "var(--m-base-light)", // 使用基础亮色
            border: "1px solid var(--m-rule)",
            borderRadius: "24px",
            boxShadow: "var(--m-shadow-out)", // 外部浮起阴影
          }}
        >
          <div className="flex h-full flex-col px-5 py-5">
            
            {/* 顶部品牌卡片 - 采用外凸效果 */}
            <div
              className="rounded-[24px] px-5 py-5"
              style={{
                background: "var(--m-accent)",
                color: "#fff",
                boxShadow: "var(--m-shadow-out)", 
              }}
            >
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em]" style={{ opacity: 0.9 }}>
                <BookOpen size={14} />
                <span>Mind365</span>
              </div>
              <div className="mt-3 text-lg font-semibold tracking-tight">Personal Growth</div>
              <p className="mt-1 text-xs opacity-80">慢一点，写下来，继续成长。</p>
            </div>

            {/* 导航列表 */}
            <nav className="mt-6 space-y-2">
              {desktopNavItems.map((item, index) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <motion.div
                    animate={{ opacity: 1, y: 0 }}
                    initial={{ opacity: 0, y: 8 }}
                    key={item.href}
                    transition={{ delay: index * 0.03, duration: 0.22, ease: "easeOut" }}
                  >
                    <Link
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300",
                      )}
                      href={item.href}
                      style={
                        active
                          ? {
                              background: "var(--m-base)",
                              boxShadow: "var(--m-shadow-in)", // 核心：点击后内凹阴影
                              color: "var(--m-accent)",
                            }
                          : {
                              color: "var(--m-ink2)",
                            }
                      }
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]"
                        style={{
                          background: active ? "rgba(139,94,60,0.05)" : "transparent",
                        }}
                      >
                        <Icon size={18} />
                      </span>
                      <span className="tracking-[0.01em]">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* 底部提醒卡片 - 采用内凹效果，增加“线索”感 */}
            <div
              className="mt-auto rounded-[20px] p-4"
              style={{
                background: "var(--m-base)",
                border: "1px solid var(--m-rule)",
                boxShadow: "var(--m-shadow-in)", // 内凹效果
              }}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.12em]" style={{ color: "var(--m-ink3)" }}>
                今日提醒
              </p>
              <p className="mt-2 text-sm leading-6" style={{ color: "var(--m-ink2)" }}>
                你今天认真写下的一小段话，正在替未来的自己留下清晰的线索。
              </p>
            </div>
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden md:py-5">
          <main className="m-scroll-hidden h-full flex-1 overflow-y-auto rounded-2xl bg-white/50 p-4 pb-28 sm:p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
