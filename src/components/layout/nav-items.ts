import {
  BookHeart,
  BookOpen,
  Compass,
  Feather,
  Grid2x2,
  House,
  NotebookPen,
  Quote,
  ScanSearch,
  Settings,
  Settings2,
  Sparkles,
  Sprout,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  shortLabel?: string; // Abbreviated label for mobile tab bar
  href: string;
  icon: LucideIcon;
  /** 卡通主题（data-tint="sakura"）下换用的圆润图标 */
  cuteIcon: LucideIcon;
}

// Mobile bottom navigation (shortLabel shown on tab bar).
export const mobileNavItems: NavItem[] = [
  { label: "\u6210\u957f\u6982\u89c8", shortLabel: "\u9996\u9875", href: "/", icon: Grid2x2, cuteIcon: House },
  { label: "\u5fc3\u5883\u968f\u7b14", shortLabel: "\u8bb0\u5f55", href: "/daily-log", icon: NotebookPen, cuteIcon: Feather },
  { label: "\u590d\u76d8\u62a5\u544a", shortLabel: "\u590d\u76d8", href: "/review", icon: ScanSearch, cuteIcon: Sparkles },
  { label: "\u7075\u611f\u4e66\u5e93", shortLabel: "\u4e66\u5e93", href: "/library", icon: BookOpen, cuteIcon: BookHeart },
  { label: "\u8bbe\u7f6e", shortLabel: "\u6211\u7684", href: "/settings", icon: Settings2, cuteIcon: Settings },
];

// Desktop sidebar navigation (full label shown).
export const desktopNavItems: NavItem[] = [
  { label: "\u6210\u957f\u6982\u89c8", href: "/", icon: Grid2x2, cuteIcon: House },
  { label: "\u5fc3\u5883\u968f\u7b14", href: "/daily-log", icon: NotebookPen, cuteIcon: Feather },
  { label: "\u4eba\u751f\u4e3b\u7ebf", href: "/life-path", icon: Compass, cuteIcon: Sprout },
  { label: "\u7075\u611f\u4e66\u5e93", href: "/library", icon: Quote, cuteIcon: BookHeart },
  { label: "\u590d\u76d8\u62a5\u544a", href: "/review", icon: ScanSearch, cuteIcon: Sparkles },
  { label: "\u8bbe\u7f6e", href: "/settings", icon: Settings2, cuteIcon: Settings },
];
