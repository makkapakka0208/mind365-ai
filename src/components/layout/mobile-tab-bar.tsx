"use client";

import { BookOpen, Home, NotebookPen, RefreshCcw, Settings2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "首页", icon: Home },
  { href: "/daily-log", label: "日记", icon: NotebookPen },
  { href: "/weekly-review", label: "复盘", icon: RefreshCcw },
  { href: "/quotes", label: "书库", icon: BookOpen },
  { href: "/settings", label: "设置", icon: Settings2 },
] as const;

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="m-tab-bar md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <Link
            className={isActive(tab.href) ? "active" : ""}
            href={tab.href}
            key={tab.href}
          >
            <Icon size={20} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
