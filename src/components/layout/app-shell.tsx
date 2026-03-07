"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { navItems } from "@/components/layout/nav-items";
import { cn } from "@/lib/cn";

interface AppShellProps {
  children: React.ReactNode;
}

interface SparklePoint {
  delay: string;
  duration: string;
  left: string;
  top: string;
}

function createSparkles(count: number): SparklePoint[] {
  return Array.from({ length: count }, (_, index) => ({
    delay: `${(index % 8) * 0.55}s`,
    duration: `${6 + (index % 5)}s`,
    left: `${(index * 17) % 100}%`,
    top: `${(index * 23) % 100}%`,
  }));
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const sparkles = useMemo(() => createSparkles(24), []);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="relative h-screen overflow-hidden text-slate-100">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="bg-float float-one -left-28 -top-24 h-80 w-80 bg-indigo-500/40" />
        <div className="bg-float float-two right-[-72px] top-[18%] h-72 w-72 bg-pink-500/35" />
        <div className="bg-float float-one bottom-[-120px] left-[24%] h-[26rem] w-[26rem] bg-cyan-400/28" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.24),transparent_55%)]" />

        {sparkles.map((sparkle, index) => (
          <span
            className="sparkle"
            key={`${sparkle.left}-${sparkle.top}-${index}`}
            style={{
              animationDelay: sparkle.delay,
              animationDuration: sparkle.duration,
              left: sparkle.left,
              top: sparkle.top,
            }}
          />
        ))}
      </div>

      <div className="mx-auto flex h-full w-full max-w-[1500px] gap-3 px-0 sm:px-3 md:px-4">
        <aside className="hidden h-full w-72 shrink-0 rounded-2xl border border-white/10 bg-white/10 p-4 shadow-xl backdrop-blur-md md:flex md:flex-col">
          <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-r from-indigo-500/85 via-purple-500/85 to-pink-500/85 p-4 text-white shadow-xl shadow-indigo-900/40">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-indigo-100">
              <Sparkles size={15} />
              Mind365
            </div>
            <p className="mt-3 text-lg font-semibold tracking-tight">个人成长空间</p>
            <p className="mt-1 text-xs text-indigo-100/90">慢一点，写下来，继续成长。</p>
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
                      isActive(item.href)
                        ? "bg-gradient-to-r from-indigo-500/35 via-purple-500/35 to-pink-500/35 text-white shadow-md shadow-indigo-900/40"
                        : "text-slate-300 hover:bg-white/10 hover:text-white",
                    )}
                    href={item.href}
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

          <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-300">今日提醒</p>
            <p className="mt-2 text-sm leading-7 text-slate-200">
              你今天认真写下的一小段话，正在替未来的自己留下清晰的线索。
            </p>
          </div>
        </aside>

        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-900/45 px-4 py-3 backdrop-blur-xl md:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="rounded-xl border border-white/15 bg-white/10 p-2 text-indigo-200">
                  <Sparkles size={14} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight">Mind365</p>
                  <p className="truncate text-xs text-slate-400">把日常记录成可回看的成长轨迹</p>
                </div>
              </div>

              <button
                className="rounded-xl border border-white/10 bg-white/10 p-2 text-slate-200 transition-all duration-300 ease-out hover:brightness-110"
                onClick={() => setIsOpen((current) => !current)}
                type="button"
              >
                {isOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>

            <AnimatePresence>
              {isOpen ? (
                <motion.nav
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 grid gap-1 rounded-2xl border border-white/10 bg-white/10 p-2 shadow-xl backdrop-blur-md"
                  exit={{ opacity: 0, y: -8 }}
                  initial={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {navItems.map((item) => {
                    const Icon = item.icon;

                    return (
                      <Link
                        className={cn(
                          "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
                          "transition-all duration-300 ease-out",
                          isActive(item.href)
                            ? "bg-gradient-to-r from-indigo-500/35 via-purple-500/35 to-pink-500/35 text-white"
                            : "text-slate-200 hover:bg-white/10",
                        )}
                        href={item.href}
                        key={item.href}
                        onClick={() => setIsOpen(false)}
                      >
                        <Icon size={15} />
                        {item.label}
                      </Link>
                    );
                  })}
                </motion.nav>
              ) : null}
            </AnimatePresence>
          </header>

          <main className="h-full flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

