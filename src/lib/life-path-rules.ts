/**
 * life-path-rules.ts
 *
 * Layer 1 of the Life Path detection pipeline: deterministic, pattern-based
 * action extraction.
 *
 * These rules are intentionally narrow and high-precision.  They produce the
 * "ground truth" signals that the fusion layer trusts the most (weight = 1.0).
 *
 * Patterns are CJK-aware and currently target Chinese expressions used in the
 * user's daily logs, e.g. "学习2小时", "刷视频半小时", "拖延".
 *
 * Adding a new pattern is a one-line change to RULE_PATTERNS — no other code
 * in the system needs to be touched.
 */

import type { ActionCategory, RuleAction } from "@/types/life-path";

// ── Pattern definitions ───────────────────────────────────────────────────────

interface RulePattern {
  /**
   * Regex that captures the matched phrase.  When the first capture group is
   * present, it is parsed as a duration in hours
   * (e.g. /学习\s*([\d.]+|半|一|两|...)?\s*小时?/).  Patterns with no capture
   * group simply emit the action without a duration.
   *
   * Patterns must be created with the `g` flag so `String.prototype.matchAll`
   * iterates every occurrence.
   */
  regex: RegExp;

  /** Canonical action key emitted by this pattern */
  type: string;

  category: ActionCategory;
}

/** Shared duration alternation used inside the regexes below */
const DUR = "([\\d.]+|半|一|两|二|三|四|五|六|七|八|九|十)?";

/**
 * Map a Chinese duration word to its numeric value in hours.
 * Used as a fallback when the user writes "半小时" instead of "0.5小时".
 */
const DURATION_WORDS: Record<string, number> = {
  半: 0.5,
  一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function parseChineseDuration(raw: string): number | undefined {
  if (!raw) return undefined;
  const numeric = Number(raw);
  if (!Number.isNaN(numeric)) return numeric;
  // Single-character Chinese number ("半小时", "一小时")
  return DURATION_WORDS[raw[0]];
}

/**
 * The full rule set.  Order matters only for `rawMatch` overlap — earlier
 * patterns get first claim on a substring, so put more specific patterns first.
 */
const RULE_PATTERNS: RulePattern[] = [
  // ── Positive: time-bound activities ────────────────────────────────────────
  { type: "study",    category: "positive", regex: new RegExp(`学习\\s*${DUR}\\s*(?:小时|h)?`, "g") },
  { type: "work",     category: "positive", regex: new RegExp(`工作\\s*${DUR}\\s*(?:小时|h)?`, "g") },
  { type: "read",     category: "positive", regex: new RegExp(`(?:阅读|读书)\\s*${DUR}\\s*(?:小时|h)?`, "g") },
  { type: "exercise", category: "positive", regex: new RegExp(`(?:运动|健身|跑步|锻炼)\\s*${DUR}\\s*(?:小时|h)?`, "g") },
  { type: "meditate", category: "positive", regex: new RegExp(`(?:冥想|打坐)\\s*${DUR}\\s*(?:小时|h|分钟)?`, "g") },

  // ── Negative: time-bound time-sinks ────────────────────────────────────────
  { type: "scrolling", category: "negative", regex: new RegExp(`(?:刷视频|刷手机|刷抖音|刷小红书|刷微博|刷推特)\\s*${DUR}\\s*(?:小时|h)?`, "g") },
  { type: "gaming",    category: "negative", regex: new RegExp(`(?:打游戏|玩游戏)\\s*${DUR}\\s*(?:小时|h)?`, "g") },

  // ── Negative: state markers (no duration) ──────────────────────────────────
  { type: "lazy",            category: "negative", regex: /(?:摆烂|躺平)/g },
  { type: "procrastination", category: "negative", regex: /(?:拖延|拖了一天|没动手)/g },
  { type: "stayup",          category: "negative", regex: /(?:熬夜|通宵)/g },
];

// ── Detection ────────────────────────────────────────────────────────────────

/**
 * Run every rule against `content` and return the unique actions found.
 *
 * Deduplication strategy:
 *   - Same `type` collapses into one entry.
 *   - When the same type matches multiple times with durations, the durations
 *     are summed (e.g. "学习1小时...又学习2小时" → study/3h).
 *
 * @example
 * detectActionsByRules("学习2小时，刷视频1小时，今天有点摆烂")
 * // → [
 * //     { type: "study",     duration: 2, category: "positive", source: "rule" },
 * //     { type: "scrolling", duration: 1, category: "negative", source: "rule" },
 * //     { type: "lazy",                   category: "negative", source: "rule" },
 * //   ]
 */
export function detectActionsByRules(content: string): RuleAction[] {
  if (!content) return [];

  // Keyed by action type so we can merge duplicate matches.
  const merged = new Map<string, RuleAction>();

  for (const pattern of RULE_PATTERNS) {
    // Reset state since regexes are reused across calls.
    pattern.regex.lastIndex = 0;

    for (const match of content.matchAll(pattern.regex)) {
      // First numbered group (when present) holds the duration token.
      const rawDur = match[1];
      const duration = rawDur ? parseChineseDuration(rawDur) : undefined;

      const existing = merged.get(pattern.type);
      if (existing) {
        // Merge durations when both sides have them.
        if (duration !== undefined) {
          existing.duration = (existing.duration ?? 0) + duration;
        }
        continue;
      }

      merged.set(pattern.type, {
        type: pattern.type,
        category: pattern.category,
        source: "rule",
        ...(duration !== undefined ? { duration } : {}),
        rawMatch: match[0],
      });
    }
  }

  return [...merged.values()];
}
