import {
  BookOpen,
  Grid2x2,
  NotebookPen,
  Quote,
  ScanSearch,
  Settings2,
  Sparkles,
  TreePine,
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
  { label: "\u65f6\u5149\u8f68\u8ff9", href: "/timeline", icon: Sparkles },
  { label: "\u7075\u611f\u4e66\u5e93", href: "/library", icon: Quote },
  { label: "\u6df1\u5ea6\u601d\u8003", href: "/notes", icon: BookOpen },
  { label: "\u590d\u76d8\u62a5\u544a", href: "/review", icon: ScanSearch },
  { label: "\u56fd\u7b56\u6811", href: "/policies", icon: TreePine },
  { label: "\u8bbe\u7f6e", href: "/settings", icon: Settings2 },
];
