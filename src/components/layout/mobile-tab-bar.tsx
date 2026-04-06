"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { mobileNavItems } from "@/components/layout/nav-items";

const MATCHERS: Record<string, string[]> = {
  "/": ["/"],
  "/record": ["/record", "/daily-log", "/journal"],
  "/review": ["/review", "/weekly-review", "/monthly-review", "/yearly-review", "/review-history"],
  "/library": ["/library", "/quotes"],
  "/me": ["/me", "/settings"],
};

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    const matchers = MATCHERS[href] ?? [href];
    return matchers.some((matcher) => (matcher === "/" ? pathname === "/" : pathname.startsWith(matcher)));
  };

  return (
    <nav className="m-tab-bar md:hidden">
      {mobileNavItems.map((tab) => {
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
