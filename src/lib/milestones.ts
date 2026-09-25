import {
  Activity,
  BookOpen,
  Briefcase,
  Flag,
  GraduationCap,
  Heart,
  Home,
  Plane,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { parseISODate, toISODate } from "@/lib/date";
import type { DailyLog } from "@/types";

/** 手动里程碑可选的图标（键存进数据，改名时保持键不变） */
export const MILESTONE_ICONS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "home", label: "住处", Icon: Home },
  { key: "work", label: "工作", Icon: Briefcase },
  { key: "study", label: "学习", Icon: GraduationCap },
  { key: "book", label: "阅读", Icon: BookOpen },
  { key: "heart", label: "关系", Icon: Heart },
  { key: "travel", label: "旅行", Icon: Plane },
  { key: "health", label: "身体", Icon: Activity },
  { key: "start", label: "开始", Icon: Flag },
  { key: "other", label: "其他", Icon: Sparkles },
];

export function milestoneIcon(key: string): LucideIcon {
  return MILESTONE_ICONS.find((i) => i.key === key)?.Icon ?? Sparkles;
}

export interface AutoMilestone {
  id: string;
  date: string;
  title: string;
  icon: string;
}

const COUNT_MARKS = [50, 100, 200, 300, 365, 500, 730, 1000];

/**
 * 自动里程碑：只用日记统计得出，不调用 AI。
 * - 第 1 篇日记，以及第 50 / 100 / 200 … 篇
 * - 连续记录 7 天及以上（记在那段连续记录的最后一天）
 * - 每年心情平均最高的一个月（该月至少 5 篇才参与）
 */
export function buildAutoMilestones(logs: DailyLog[]): AutoMilestone[] {
  if (logs.length === 0) return [];
  const result: AutoMilestone[] = [];

  // 按日期去重排序（同一天多篇只算一天）
  const days = [...new Set(logs.map((l) => l.date))].sort();

  // 篇数节点（按篇数，不去重）
  const byDate = [...logs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  result.push({ id: "auto-first", date: byDate[0].date, title: "写下第一篇日记", icon: "start" });
  for (const mark of COUNT_MARKS) {
    const log = byDate[mark - 1];
    if (log) result.push({ id: `auto-count-${mark}`, date: log.date, title: `第 ${mark} 篇日记`, icon: "other" });
  }

  // 连续记录 ≥ 7 天
  let runStart = 0;
  for (let i = 1; i <= days.length; i++) {
    const prev = days[i - 1];
    const cur = days[i];
    const next = cur ? toISODate(new Date(parseISODate(prev).getTime() + 86400000)) : null;
    if (cur && cur === next) continue;
    const length = i - runStart;
    if (length >= 7) {
      result.push({ id: `auto-streak-${prev}`, date: prev, title: `连续记录 ${length} 天`, icon: "other" });
    }
    runStart = i;
  }

  // 每年心情最好的一个月
  const monthMoods = new Map<string, number[]>();
  for (const log of logs) {
    if (log.mood <= 0) continue;
    const key = log.date.slice(0, 7);
    monthMoods.set(key, [...(monthMoods.get(key) ?? []), log.mood]);
  }
  const bestByYear = new Map<string, { month: string; avg: number }>();
  for (const [month, moods] of monthMoods) {
    if (moods.length < 5) continue;
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length;
    const year = month.slice(0, 4);
    const best = bestByYear.get(year);
    if (!best || avg > best.avg) bestByYear.set(year, { month, avg });
  }
  for (const [year, { month, avg }] of bestByYear) {
    const [, m] = month.split("-").map(Number);
    result.push({
      id: `auto-best-mood-${year}`,
      date: `${month}-01`,
      title: `${year} 年心情最好的一个月（${m} 月，平均 ${avg.toFixed(1)}）`,
      icon: "heart",
    });
  }

  return result;
}
