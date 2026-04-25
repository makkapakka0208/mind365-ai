"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { desktopNavItems } from "@/components/layout/nav-items";
import { SmartActionCard } from "@/components/layout/smart-action-card";
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
  "/life-path": ["/life-path", "/week-plan"],
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
          <div className="flex h-full flex-col px-4 py-4">
            
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
            <nav className="mt-4 space-y-0.5 overflow-y-auto">
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
                        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300",
                      )}
                      href={item.href}
                      style={
                        active
                          ? {
                              background: "var(--m-base)",
                              boxShadow: "var(--m-shadow-in)",
                              color: "var(--m-accent)",
                            }
                          : {
                              color: "var(--m-ink2)",
                            }
                      }
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                        style={{
                          background: active ? "rgba(139,94,60,0.05)" : "transparent",
                        }}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="tracking-[0.01em]">{item.label}</span>
                    </Link>
                  </motion.div>
                );
              })}
            </nav>

            {/* 底部"下一步"卡片 - 智能给出当前最该做的一个行动 */}
            <SmartActionCard />
          </div>
        </aside>

        {/* ── Main Content Area ── */}
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden md:py-5">
          <main
            className="m-scroll-hidden h-full flex-1 overflow-y-auto rounded-2xl p-4 pb-28 sm:p-6 md:p-8"
            style={{
              background: "linear-gradient(160deg, #FDFAF3 0%, #F8F1E4 50%, #F3EAD8 100%)",
              backgroundImage: [
                "linear-gradient(160deg, #FDFAF3 0%, #F8F1E4 50%, #F3EAD8 100%)",
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
              ].join(", "),
            }}
          >
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
