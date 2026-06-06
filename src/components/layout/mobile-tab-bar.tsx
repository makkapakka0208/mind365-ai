"use client";

import { BookOpen, Compass, Grid2x2, NotebookPen, ScanSearch, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTabMode } from "@/lib/tab-mode";

const MATCHERS: Record<string, string[]> = {
  "/": ["/"],
  "/daily-log": ["/daily-log", "/record", "/journal"],
  "/review": ["/review", "/weekly-review", "/monthly-review", "/yearly-review", "/review-history"],
  "/library": ["/library", "/quotes"],
  "/life-path": ["/life-path", "/week-plan"],
  "/settings": ["/settings", "/me"],
};

interface Tab {
  label: string;
  href: string;
  icon: LucideIcon;
}

export function MobileTabBar() {
  const pathname = usePathname();
  const tabMode = useTabMode();

  const tabs: Tab[] = [
    { label: "首页", href: "/", icon: Grid2x2 },
    { label: "记录", href: "/daily-log", icon: NotebookPen },
    { label: "复盘", href: "/review", icon: ScanSearch },
    tabMode === "lifepath"
      ? { label: "主线", href: "/life-path", icon: Compass }
      : { label: "书库", href: "/library", icon: BookOpen },
    { label: "我的", href: "/settings", icon: Settings2 },
  ];

  const isActive = (href: string) => {
    const matchers = MATCHERS[href] ?? [href];
    return matchers.some((matcher) => (matcher === "/" ? pathname === "/" : pathname.startsWith(matcher)));
  };

  return (
    <nav className="m-tab-bar md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.href);

        return (
          <Link className={active ? "active" : ""} href={tab.href} key={tab.href}>
            <span className="m-tab-icon">
              <Icon size={18} />
            </span>
            <span className="m-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
