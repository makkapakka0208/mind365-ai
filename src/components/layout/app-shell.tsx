"use client";

import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="relative h-screen overflow-hidden" style={{ color: "var(--m-ink)" }}>
      <div className="mx-auto flex h-full w-full max-w-[1500px] gap-3 px-0 sm:px-3 md:px-4">
        {/* ── Desktop sidebar ── */}
        <aside
          className="hidden h-full w-72 shrink-0 flex-col overflow-y-auto rounded-2xl p-4 md:flex"
          style={{
            background: "var(--m-base-light)",
            border: "1px solid var(--m-rule)",
            boxShadow: "var(--m-shadow-out)",
          }}
        >
          <div
            className="overflow-hidden rounded-2xl p-4"
            style={{
              background: "var(--m-accent)",
              color: "#fff",
              boxShadow: "var(--m-shadow-out)",
            }}
          >
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em]" style={{ opacity: 0.85 }}>
              <BookOpen size={15} />
              Mind365
            </div>
            <p className="mt-3 text-lg font-semibold tracking-tight">Personal Growth</p>
            <p className="mt-1 text-xs" style={{ opacity: 0.85 }}>慢一点，写下来，继续成长。</p>
          </div>

          <nav className="mt-5 space-y-1.5">
            {navItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <motion.div
                  animate={{ opacity: 1, y: 0 }}
                  initial={{ opacity: 0, y: 8 }}
                  key={item.href}
                  transition={{ delay: index * 0.05, duration: 0.25, ease: "easeOut" }}
                >
                  <Link
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                      "transition-all duration-300 ease-out",
                    )}
                    href={item.href}
                    style={
                      isActive(item.href)
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
                    <Icon
                      className="shrink-0 transition-transform duration-300 ease-out group-hover:-translate-y-0.5"
                      size={16}
                    />
                    <span>{item.label}</span>
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          <div
            className="mt-auto rounded-2xl p-4"
            style={{
              background: "var(--m-base)",
              border: "1px solid var(--m-rule)",
              boxShadow: "var(--m-shadow-in)",
            }}
          >
            <p className="text-xs font-medium uppercase tracking-[0.14em]" style={{ color: "var(--m-ink3)" }}>今日提醒</p>
            <p className="mt-2 text-sm leading-7" style={{ color: "var(--m-ink2)" }}>
              你今天认真写下的一小段话，正在替未来的自己留下清晰的线索。
            </p>
          </div>
        </aside>

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <main className="h-full flex-1 overflow-y-auto p-4 pb-20 sm:p-6 md:pb-8 lg:p-8">{children}</main>
        </div>
      </div>

      <MobileTabBar />
    </div>
  );
}
