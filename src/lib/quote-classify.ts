/**
 * quote-classify.ts
 *
 * Lightweight rule-based auto-classification for quotes/notes into
 * cognitive system themes ("赚钱"、"行动"、"情绪与认知"...).
 *
 * Users can override the auto-derived label by setting `quote.themeCategory`
 * via the "加入我的认知体系" dialog; auto-classification is only the fallback
 * for un-tagged quotes so the archive view never shows an empty bucket.
 */

import type { Note, Quote } from "@/types";

// ── Built-in themes ──────────────────────────────────────────────────────────

export interface ThemeDef {
  id: string;
  /** Display label, also used as the value persisted in Quote.themeCategory. */
  label: string;
  /** Single-character emoji icon used in the folder list. */
  icon: string;
  /** Lower-case keyword stems used by the auto-classifier. */
  keywords: string[];
}

export const BUILTIN_THEMES: ThemeDef[] = [
  {
    id: "wealth",
    label: "赚钱",
    icon: "💰",
    keywords: [
      "赚钱", "金钱", "财富", "收入", "投资", "理财", "资产", "现金流",
      "商业", "生意", "副业", "创业", "市场", "客户", "盈利", "利润",
      "复利", "贫穷", "富有", "money", "wealth", "income",
    ],
  },
  {
    id: "action",
    label: "行动",
    icon: "🎯",
    keywords: [
      "行动", "执行", "实践", "去做", "动手", "落地", "开始", "坚持",
      "拖延", "懒惰", "效率", "专注", "deep work", "habit", "习惯",
      "纪律", "完成", "推进", "迭代", "做事",
    ],
  },
  {
    id: "emotion",
    label: "情绪与认知",
    icon: "🧠",
    keywords: [
      "情绪", "焦虑", "恐惧", "愤怒", "悲伤", "孤独", "压力", "崩溃",
      "自卑", "自信", "心态", "心境", "认知", "思维", "偏见", "观念",
      "觉察", "正念", "冥想", "平静", "接纳", "释怀",
    ],
  },
  {
    id: "growth",
    label: "成长",
    icon: "🌱",
    keywords: [
      "成长", "蜕变", "进化", "学习", "复利", "积累", "刻意练习",
      "深度", "时间", "长期", "复盘", "反思", "教训", "经验",
      "格局", "升维", "精进",
    ],
  },
  {
    id: "relation",
    label: "关系",
    icon: "🤝",
    keywords: [
      "关系", "朋友", "家人", "父母", "伴侣", "爱情", "婚姻", "孩子",
      "信任", "沟通", "倾听", "共情", "边界", "团队", "合作", "陪伴",
      "亲密", "孤独",
    ],
  },
  {
    id: "wisdom",
    label: "智慧",
    icon: "📜",
    keywords: [
      "智慧", "本质", "真相", "原则", "规律", "道", "哲学", "思想",
      "辩证", "因果", "知行合一", "自省", "无常", "舍得",
    ],
  },
];

const FALLBACK_LABEL = "未分类";

// ── Custom themes (user-added via "加入我的认知体系") ───────────────────────

const CUSTOM_THEMES_KEY = "mind365_custom_themes";

export function loadCustomThemes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CUSTOM_THEMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t: unknown): t is string => typeof t === "string" && !!t.trim()) : [];
  } catch {
    return [];
  }
}

export function saveCustomThemes(themes: string[]): void {
  if (typeof window === "undefined") return;
  const cleaned = [...new Set(themes.map((t) => t.trim()).filter(Boolean))];
  localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(cleaned));
}

export function addCustomTheme(theme: string): void {
  const trimmed = theme.trim();
  if (!trimmed) return;
  // Don't duplicate built-in labels.
  if (BUILTIN_THEMES.some((t) => t.label === trimmed)) return;
  const next = [...new Set([...loadCustomThemes(), trimmed])];
  saveCustomThemes(next);
}

/** All theme labels available for the picker (built-ins + user customs). */
export function getAllThemeLabels(): string[] {
  return [...BUILTIN_THEMES.map((t) => t.label), ...loadCustomThemes()];
}

// ── Classification ───────────────────────────────────────────────────────────

/**
 * Returns the user-set theme if present, else runs keyword-based detection.
 * Falls back to "未分类".
 */
export function classifyQuote(quote: Quote): string {
  if (quote.themeCategory && quote.themeCategory.trim()) {
    return quote.themeCategory.trim();
  }
  return autoClassify(quote.text, quote.tags, quote.author, quote.book);
}

export function classifyNote(note: Note): string {
  return autoClassify(`${note.title}\n${note.content}`, note.tags);
}

function autoClassify(text: string, tags: string[] = [], ...extras: string[]): string {
  const haystack = [text, ...tags, ...extras].join(" ").toLowerCase();
  if (!haystack.trim()) return FALLBACK_LABEL;

  let bestLabel = FALLBACK_LABEL;
  let bestScore = 0;

  for (const theme of BUILTIN_THEMES) {
    let score = 0;
    for (const kw of theme.keywords) {
      if (haystack.includes(kw.toLowerCase())) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLabel = theme.label;
    }
  }

  return bestLabel;
}

/** Look up a theme's icon from its label, with a sensible default. */
export function getThemeIcon(label: string): string {
  const found = BUILTIN_THEMES.find((t) => t.label === label);
  if (found) return found.icon;
  if (label === FALLBACK_LABEL) return "📂";
  return "🏷️";
}

/** Group quotes into theme buckets. Returns a sorted [{label, icon, items}]. */
export interface ThemeBucket {
  label: string;
  icon: string;
  items: Quote[];
}

export function groupQuotesByTheme(quotes: Quote[]): ThemeBucket[] {
  const map = new Map<string, Quote[]>();
  for (const q of quotes) {
    const label = classifyQuote(q);
    const list = map.get(label) ?? [];
    list.push(q);
    map.set(label, list);
  }
  // Order: built-ins (in defined order) first, then custom themes alphabetically,
  // unclassified always last.
  const builtinOrder = BUILTIN_THEMES.map((t) => t.label);
  const out: ThemeBucket[] = [];
  for (const label of builtinOrder) {
    if (map.has(label)) {
      out.push({ label, icon: getThemeIcon(label), items: map.get(label)! });
      map.delete(label);
    }
  }
  // Custom themes
  const customs = [...map.entries()].filter(([k]) => k !== FALLBACK_LABEL);
  customs.sort(([a], [b]) => a.localeCompare(b));
  for (const [label, items] of customs) {
    out.push({ label, icon: getThemeIcon(label), items });
  }
  if (map.has(FALLBACK_LABEL)) {
    out.push({ label: FALLBACK_LABEL, icon: getThemeIcon(FALLBACK_LABEL), items: map.get(FALLBACK_LABEL)! });
  }
  return out;
}
