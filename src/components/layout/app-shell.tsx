"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileTabBar } from "@/components/layout/mobile-tab-bar";
import { desktopNavItems } from "@/components/layout/nav-items";
import { SmartActionCard } from "@/components/layout/smart-action-card";
import { OnlineStatus } from "@/components/pwa/online-status";
import { PWAInstallPrompt } from "@/components/pwa/install-prompt";
import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { useAuth } from "@/lib/auth";

interface AppShellProps {
  children: React.ReactNode;
}

const PATH_GROUPS: Record<string, string[]> = {
  "/": ["/"],
  "/daily-log": ["/daily-log", "/record", "/journal"],
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
  const { loading, authConfigured } = useAuth();

  // Login page should render without the shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // When auth is configured, keep the shell stable while the session hydrates.
  if (authConfigured && loading) {
    return (
      <div
        className="v5-page-bg flex items-center justify-center"
        style={{ height: "100dvh" }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-4"
          style={{
            borderColor: "var(--v5-rule)",
            borderTopColor: "var(--v5-accent)",
          }}
        />
      </div>
    );
  }

  const isActive = (href: string) => {
    const matchers = PATH_GROUPS[href] ?? [href];
    return matchers.some((matcher) => (matcher === "/" ? pathname === "/" : pathname.startsWith(matcher)));
  };

  return (
    <div
      className="v5-page-bg relative overflow-hidden"
      style={{ color: "var(--v5-ink)", height: "100dvh" }}
    >
      <div className="mx-auto flex h-full w-full max-w-[1500px]">

        {/* ── Desktop Sidebar (v5: 240px transparent flat) ── */}
        <aside
          aria-label="主导航"
          className="hidden h-full shrink-0 flex-col md:flex"
          style={{
            width: 240,
            background: "transparent",
            padding: "24px 16px",
          }}
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5" style={{ padding: "0 12px 28px" }}>
            <span
              className="grid place-items-center"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "var(--v5-accent)",
                color: "#fff",
                fontFamily: "var(--v5-serif)",
                fontVariationSettings: '"opsz" 144',
                fontSize: 16,
                fontWeight: 500,
                letterSpacing: "-0.02em",
              }}
            >
              M
            </span>
            <span
              style={{
                fontFamily: "var(--v5-serif)",
                fontSize: 17,
                fontWeight: 500,
                color: "var(--v5-ink)",
                letterSpacing: "-0.01em",
              }}
            >
              Mind365
            </span>
          </div>

          {/* Nav list */}
          <nav className="grid" style={{ gap: 2 }}>
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className="flex items-center"
                  href={item.href}
                  key={item.href}
                  style={{
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: active ? "1px solid var(--v5-rule)" : "1px solid transparent",
                    fontFamily: "var(--v5-serif)",
                    fontSize: 14.5,
                    fontWeight: active ? 500 : 400,
                    background: active ? "#fff" : "transparent",
                    boxShadow: active ? "var(--v5-sh-1)" : "none",
                    color: active ? "var(--v5-ink)" : "var(--v5-ink2)",
                    transition:
                      "background var(--v5-dur-fast) var(--v5-ease), color var(--v5-dur-fast) var(--v5-ease)",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = "rgba(75,51,27,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon
                    size={16}
                    color={active ? "var(--v5-accent)" : "var(--v5-ink3)"}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          {/* Calm-style Smart Action — soft gradient pill */}
          <SmartActionCard />
        </aside>

        {/* ── Main Content Area ── */}
        <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          <main
            className="m-scroll-hidden h-full flex-1 overflow-y-auto px-4 pb-28 pt-5 sm:px-6 md:px-10 md:pb-16 md:pt-8"
          >
            {children}
          </main>
        </div>
      </div>

      <MobileTabBar />
      <OnlineStatus />
      <PWAInstallPrompt />
      <ServiceWorkerRegister />
    </div>
  );
}
