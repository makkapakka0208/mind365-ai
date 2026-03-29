import {
  Archive,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  NotebookPen,
  Quote,
  Settings2,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { label: "成长概览", href: "/", icon: LayoutDashboard },
  { label: "心境随笔", href: "/daily-log", icon: NotebookPen },
  { label: "时光轨迹", href: "/timeline", icon: Sparkles },
  { label: "灵感书库", href: "/quotes", icon: Quote },
  { label: "深度思考", href: "/notes", icon: BookOpen },
  { label: "周度复盘", href: "/weekly-review", icon: CalendarClock },
  { label: "月度复盘", href: "/monthly-review", icon: CalendarDays },
  { label: "年度复盘", href: "/yearly-review", icon: CalendarRange },
  { label: "复盘档案", href: "/review-history", icon: Archive },
  { label: "数据看板", href: "/analytics", icon: BarChart3 },
  { label: "设置", href: "/settings", icon: Settings2 },
];
