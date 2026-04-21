import {
  BookOpen,
  Clock,
  Compass,
  Grid2x2,
  NotebookPen,
  Quote,
  ScanSearch,
  Settings2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// Mobile bottom navigation.
export const mobileNavItems: NavItem[] = [
  { label: "\u9996\u9875", href: "/", icon: Grid2x2 },
  { label: "\u8bb0\u5f55", href: "/record", icon: NotebookPen },
  { label: "\u590d\u76d8", href: "/review", icon: ScanSearch },
  { label: "\u4e66\u5e93", href: "/library", icon: BookOpen },
  { label: "\u6211\u7684", href: "/settings", icon: Settings2 },
];

// Desktop sidebar navigation.
export const desktopNavItems: NavItem[] = [
  { label: "\u6210\u957f\u6982\u89c8", href: "/", icon: Grid2x2 },
  { label: "\u5fc3\u5883\u968f\u7b14", href: "/record", icon: NotebookPen },
  { label: "\u53bb\u5e74\u4eca\u65e5", href: "/timeline", icon: Clock },
  { label: "\u7075\u611f\u4e66\u5e93", href: "/library", icon: Quote },
  { label: "\u590d\u76d8\u62a5\u544a", href: "/review", icon: ScanSearch },
  { label: "\u4eba\u751f\u4e3b\u7ebf", href: "/life-path", icon: Compass },
  { label: "\u8bbe\u7f6e", href: "/settings", icon: Settings2 },
];
