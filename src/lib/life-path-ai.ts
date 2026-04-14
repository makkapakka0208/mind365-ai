/**
 * life-path-ai.ts
 *
 * Layer 2 of the Life Path detection pipeline: AI / NLP-based action
 * extraction.
 *
 * This module is intentionally a thin interface.  The real implementation
 * will call a Claude / GPT endpoint and return structured JSON; everything
 * downstream (fusion, scoring) is wired up to consume the shape declared
 * in `AiAction` so swapping providers is trivial.
 *
 * For now `analyzeWithAI()` returns `[]` — the fusion layer treats this
 * gracefully and falls back to rule-only output.
 */

import type { AiAction, RuleAction } from "@/types/life-path";

// ── Trigger heuristics ────────────────────────────────────────────────────────

/**
 * Decide whether a given log warrants an AI call.
 *
 * The AI layer is comparatively expensive, so we only invoke it when the
 * cheap rule layer is likely to be insufficient:
 *
 *   1. **Empty rule output** — content was free-form and contained no known
 *      keywords, but might still describe meaningful behavior.
 *   2. **Long / complex content** — multi-sentence reflections often carry
 *      emotional or implicit signals the regexes can't capture.
 *   3. **Explicit deep mode** — the caller (e.g. a "deep analysis" UI button)
 *      forces the AI pass.
 */
export function shouldRunAI(
  content: string,
  ruleActions: RuleAction[],
  options?: { deepMode?: boolean },
): boolean {
  if (options?.deepMode) return true;
  if (!content?.trim()) return false;
  if (ruleActions.length === 0) return true;
  // Heuristic threshold — long-form journals get an AI second pass.
  if (content.length >= 80) return true;
  return false;
}

// ── AI invocation (stub) ─────────────────────────────────────────────────────

export interface AnalyzeOptions {
  /**
   * Force an AI call regardless of `shouldRunAI()`'s heuristics.
   * Wire this up to a "深度分析" button in the journal UI.
   */
  deepMode?: boolean;

  /**
   * Optional override for the AI client.  Lets tests inject a mock without
   * needing to network-stub.  When omitted, the default (currently a no-op)
   * implementation is used.
   */
  client?: AiClient;
}

/**
 * Minimal abstraction over an LLM call.  A real implementation will likely
 * call Anthropic / OpenAI through `fetch` and parse the structured JSON
 * response.
 */
export interface AiClient {
  analyze(content: string): Promise<AiAction[]>;
}

/**
 * Default no-op client.  Returns no actions so the pipeline continues to
 * work end-to-end before the real backend is wired in.  Replace this with
 * a Claude / GPT-backed client when the AI integration is implemented.
 */
const defaultClient: AiClient = {
  async analyze(): Promise<AiAction[]> {
    return [];
  },
};

/**
 * Run the AI layer against `content`.  Always returns a (possibly empty)
 * array — never throws — so the fusion layer can call it unconditionally.
 *
 * @example
 * const ai = await analyzeWithAI("今天心情低落，没怎么看进去书", { deepMode: true });
 * // → [{ type: "lowMood", category: "negative", confidence: 0.7,
 * //      reason: "用户表达情绪低落", source: "ai" }]
 */
export async function analyzeWithAI(
  content: string,
  options: AnalyzeOptions = {},
): Promise<AiAction[]> {
  const client = options.client ?? defaultClient;
  try {
    const actions = await client.analyze(content);
    // Defensive: clamp confidences to the documented [0.5, 0.9] range so
    // downstream weighting can't be tricked by an out-of-spec model.
    return actions.map((a) => ({
      ...a,
      source: "ai" as const,
      confidence: Math.min(0.9, Math.max(0.5, a.confidence)),
    }));
  } catch {
    // AI failures must never break logging — fall back to no-op.
    return [];
  }
}
