import { NextRequest, NextResponse } from "next/server";

import { chatCompletion, resolveAiProvider } from "@/lib/server/ai-provider";
import { guardApiRequest } from "@/lib/server/api-guard";

import type { LifeDirection } from "@/types/life-path";

export const runtime = "nodejs";

interface EnrichRequest {
  directions: LifeDirection[];
}

interface EnrichedPattern {
  id: string;
  aiPositivePatterns: string[];
  aiNegativePatterns: string[];
}

function buildPrompt(directions: LifeDirection[]): string {
  const payload = directions.map((d) => ({
    id: d.id,
    name: d.name,
    positiveActions: d.positiveActions,
    negativeActions: d.negativeActions,
  }));

  return `用户设定了以下人生主线：
${JSON.stringify(payload, null, 2)}

请为每个方向生成额外的关键词/短语，供系统在用户的中文日记文本中做模糊匹配。

要求：
1. 每个方向正向和负向各生成 5-8 个短语
2. 使用口语化的中文表达，贴近真实日记语言（例如"去跑步了""又刷了半天手机"）
3. 不要重复用户已定义的关键词
4. 覆盖多种表达方式，包括动词短语、形容词描述、结果陈述等

输出格式（严格合法 JSON，不加任何说明或代码块）：
{
  "enriched": [
    {
      "id": "方向id",
      "aiPositivePatterns": ["短语1", "短语2"],
      "aiNegativePatterns": ["短语1", "短语2"]
    }
  ]
}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export async function POST(request: NextRequest) {
  const guardError = await guardApiRequest(request);
  if (guardError) return guardError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: "请求格式无效。" }, { status: 400 });
  }

  if (!isRecord(rawBody) || !Array.isArray(rawBody.directions) || rawBody.directions.length === 0) {
    return NextResponse.json({ message: "参数格式无效。" }, { status: 400 });
  }

  const { directions } = rawBody as unknown as EnrichRequest;

  const provider = resolveAiProvider();
  if (!provider) {
    return NextResponse.json({ available: false, enriched: [] });
  }

  const userPrompt = buildPrompt(directions);
  const system = "你是一个行为模式分析助手，擅长将抽象的人生方向转化为日记中的自然语言信号。输出严格为合法 JSON，不添加任何 markdown、代码块或其他文字。";

  try {
    const resp = await chatCompletion(provider, { system, user: userPrompt, temperature: 0.6, json: true });

    if (!resp.ok) {
      console.error("[life-path-enrich] API error", resp.status);
      return NextResponse.json({ available: false, enriched: [] });
    }

    const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("[life-path-enrich] JSON parse failed:", cleaned);
      return NextResponse.json({ available: false, enriched: [] });
    }

    if (!isRecord(parsed) || !Array.isArray((parsed as Record<string, unknown>).enriched)) {
      return NextResponse.json({ available: false, enriched: [] });
    }

    const enriched = ((parsed as Record<string, unknown>).enriched as unknown[]).filter(
      (e): e is EnrichedPattern =>
        isRecord(e) &&
        typeof e.id === "string" &&
        Array.isArray(e.aiPositivePatterns) &&
        Array.isArray(e.aiNegativePatterns),
    );

    return NextResponse.json({ available: true, enriched });
  } catch (err) {
    console.error("[life-path-enrich] fetch error:", err);
    return NextResponse.json({ available: false, enriched: [] });
  }
}
