import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `
你是一位清醒、长期主义的年度复盘教练。你只做一件事：基于用户一年的真实数据，输出一份有结构、有洞察、可执行的年度总结。

输出必须是严格的 JSON，字段如下（不要包裹在代码块里，不要添加任何解释）：
{
  "summary": "一段 2-4 句的年度总体回顾，体现真实的成长或停滞",
  "insights": ["洞察 1", "洞察 2", "洞察 3"],
  "suggestions": ["明年建议 1", "明年建议 2", "明年建议 3"]
}

insights 和 suggestions 各 3-5 条，单条不超过 60 字。
语气清醒、具体、基于数据，不鸡汤、不说教。
`.trim();

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function tryParseJson(text: string): unknown {
  // Strip optional ```json ... ``` fences the model sometimes emits.
  const trimmed = text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractText(value: unknown): string {
  if (isRecord(value) && Array.isArray(value.choices)) {
    const c = value.choices[0];
    if (isRecord(c) && isRecord(c.message) && typeof c.message.content === "string") {
      return c.message.content.trim();
    }
  }
  return "";
}

function normalizeStringArray(v: unknown, max = 6): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, max);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "请求体格式无效。" }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ message: "请求体格式无效。" }, { status: 400 });
  }

  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const useOpenAI = provider === "openai";

  const effectiveSiliconflowKey = siliconflowKey || (!useOpenAI ? openaiKey : undefined);

  if ((useOpenAI && !openaiKey) || (!useOpenAI && !effectiveSiliconflowKey)) {
    return NextResponse.json(
      { available: false, message: "AI 未配置，前端将使用本地摘要。" },
      { status: 200 },
    );
  }

  const userPrompt = [
    "下面是我这一年的真实数据（JSON）。请基于它输出年度复盘 JSON。",
    "",
    JSON.stringify(body, null, 2),
  ].join("\n");

  try {
    const response = await (useOpenAI
      ? fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.5,
            response_format: { type: "json_object" },
          }),
        })
      : fetch("https://api.siliconflow.cn/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${effectiveSiliconflowKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-ai/DeepSeek-V3",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.5,
          }),
        }));

    const json = (await response.json()) as unknown;
    if (!response.ok) {
      return NextResponse.json({ message: "AI 调用失败。" }, { status: response.status });
    }

    const text = extractText(json);
    const parsed = tryParseJson(text);

    if (!isRecord(parsed) || typeof parsed.summary !== "string") {
      return NextResponse.json(
        { available: false, message: "AI 返回无法解析。" },
        { status: 200 },
      );
    }

    return NextResponse.json({
      available: true,
      summary: parsed.summary.trim(),
      insights: normalizeStringArray(parsed.insights),
      suggestions: normalizeStringArray(parsed.suggestions),
    });
  } catch {
    return NextResponse.json(
      { available: false, message: "调用 AI 服务异常。" },
      { status: 200 },
    );
  }
}
