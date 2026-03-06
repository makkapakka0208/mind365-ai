import {
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
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
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Journal", href: "/daily-log", icon: NotebookPen },
  { label: "Timeline", href: "/timeline", icon: Sparkles },
  { label: "Quote Library", href: "/quotes", icon: Quote },
  { label: "Deep Thinking", href: "/notes", icon: BookOpen },
  { label: "Weekly Review", href: "/weekly-review", icon: CalendarClock },
  { label: "Monthly Review", href: "/monthly-review", icon: CalendarDays },
  { label: "Data Dashboard", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings2 },
];