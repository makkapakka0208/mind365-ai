"use client";

import { BookHeart, BookOpen, Compass, Feather, Grid2x2, House, NotebookPen, ScanSearch, Settings, Settings2, Sparkles, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useTabMode } from "@/lib/tab-mode";
import { useThemeTint } from "@/lib/theme-colors";

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
  // 卡通主题换用圆润图标
  const cute = useThemeTint() === "sakura";

  const tabs: Tab[] = [
    { label: "首页", href: "/", icon: cute ? House : Grid2x2 },
    { label: "记录", href: "/daily-log", icon: cute ? Feather : NotebookPen },
    { label: "复盘", href: "/review", icon: cute ? Sparkles : ScanSearch },
    tabMode === "lifepath"
      ? { label: "主线", href: "/life-path", icon: cute ? Sprout : Compass }
      : { label: "书库", href: "/library", icon: cute ? BookHeart : BookOpen },
    { label: "我的", href: "/settings", icon: cute ? Settings : Settings2 },
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
