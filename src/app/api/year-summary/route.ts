import { NextRequest, NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/server/api-guard";

export const runtime = "nodejs";

/* ─────────────────────────────────────────────
   年度纪录片旁白 — System Prompt
   ───────────────────────────────────────────── */

const SYSTEM_PROMPT = `
你是一部年度私人纪录片的撰稿人。你的素材是一个普通人一整年的日记、学习时间、阅读摘抄和情绪数据。你要做的不是总结，而是凝视：像《十三邀》的策划在饭局后整理录音，像《人物》的特稿记者翻完了对象一年的朋友圈，像王家卫在剪辑室里给一年的胶片配画外音。

写作铁律：
- 旁白视角用"你"，偶尔抽离成"这一年"。克制、具体、留白。短句优先。
- 每一个判断都必须扎在数据里：某个月学习时长的塌陷、某句反复出现的话、某张深夜留下的阅读卡片。不允许写任何一句换个人也成立的话。
- 禁止鸡汤、禁止"相信自己""未来可期""越来越好"、禁止感叹号堆砌、禁止排比抒情。真实比温暖重要。
- 孤独、焦虑、清醒：在数据里找到它们各自最浓的时段，指出来，描述当时发生了什么，不评判。
- 推测现实处境（工作、关系、钱、身体）时要克制且诚实，用"大概""或许"这样的限定词，但推测本身要敢于具体。
- 数据不足以支撑某个字段时，写一句诚实的短句说明数据太薄，而不是编造。
- 全部使用中文。

输出严格的 JSON（不要代码块包裹，不要解释），字段如下：
{
  "opening": "开场旁白，3-5 句。从一个具体细节进入这一年，定下整部片子的调子",
  "phases": [
    {
      "period": "时间段，如 '一月 — 三月' 或 '十月的两周'",
      "title": "这个阶段的章节名，四到八个字，要像章节卡上的字",
      "state": "lonely | anxious | lucid | building | drifting 中的一个",
      "narration": "这个阶段的旁白，3-5 句，必须引用该时段的具体数据或日记原话"
    }
  ],
  "keywords": [
    { "word": "日记里反复出现的词", "count": 出现次数的数字, "meaning": "这个词背后真正在说什么，一两句" }
  ],
  "lifeInference": "对你现实生活状态与压力来源的推测，4-6 句。工作节奏、关系、经济、身体，哪里在施压，证据是什么",
  "rebuilding": "你如何重建自己的分析，4-6 句。从崩塌处写起，到那些不起眼但起作用的动作",
  "yearKeyword": { "word": "年度关键词，一到四个字", "reason": "为什么是它，两三句，要扎在数据里" },
  "refuge": "精神避难所：这一年你真正躲进去过的地方（某本书、某个习惯、某段时间），3-4 句，要具体到名字",
  "upgradeMoments": [
    "认知升级时刻：某一天你想明白了什么。每条一两句，引用日期或原话，2-4 条"
  ],
  "archetype": { "title": "你最像哪类人，一个具体的人物式称呼（不是星座式标签）", "description": "为什么，3-4 句，像人物特稿的定场白" },
  "ending": "结尾文案，3-5 句。不收束、不升华，要有后劲——读完之后那种安静的、隔几秒才反应过来的劲"
}

phases 按时间顺序给 3-5 个阶段，lonely/anxious/lucid 三种状态至少各出现一次（若数据真的不支持某种状态，可省略并在 narration 里说明）。keywords 给 4-8 个，优先使用素材里 keywordStats 的统计，但 meaning 必须是你的洞察。
`.trim();

/* ─────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function tryParseJson(text: string): unknown {
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

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeStringArray(v: unknown, max = 6): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim())
    .slice(0, max);
}

const VALID_STATES = ["lonely", "anxious", "lucid", "building", "drifting"] as const;

function normalizePhases(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isRecord)
    .map((p) => ({
      period: asString(p.period),
      title: asString(p.title),
      state: VALID_STATES.includes(p.state as (typeof VALID_STATES)[number])
        ? (p.state as (typeof VALID_STATES)[number])
        : ("building" as const),
      narration: asString(p.narration),
    }))
    .filter((p) => p.title && p.narration)
    .slice(0, 6);
}

function normalizeKeywords(v: unknown) {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isRecord)
    .map((k) => ({
      word: asString(k.word),
      count: typeof k.count === "number" && Number.isFinite(k.count) ? Math.max(0, Math.round(k.count)) : 0,
      meaning: asString(k.meaning),
    }))
    .filter((k) => k.word)
    .slice(0, 8);
}

/* ─────────────────────────────────────────────
   Handler
   ───────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const guardError = await guardApiRequest(request);
  if (guardError) return guardError;

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
    "这是这一年的全部素材（JSON）。包括逐月统计 monthly、日记关键词统计 keywordStats、阅读卡片 readingCards、日记摘录 journalSamples、目标 goals。",
    "请按系统提示词的要求输出年度纪录片 JSON。",
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
            temperature: 0.7,
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
            model: process.env.SILICONFLOW_MODEL?.trim() || "deepseek-ai/DeepSeek-V3",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
          }),
        }));

    const json = (await response.json()) as unknown;
    if (!response.ok) {
      return NextResponse.json({ message: "AI 调用失败。" }, { status: response.status });
    }

    const text = extractText(json);
    const parsed = tryParseJson(text);

    if (!isRecord(parsed) || typeof parsed.opening !== "string") {
      return NextResponse.json(
        { available: false, message: "AI 返回无法解析。" },
        { status: 200 },
      );
    }

    const yearKeyword = isRecord(parsed.yearKeyword)
      ? { word: asString(parsed.yearKeyword.word), reason: asString(parsed.yearKeyword.reason) }
      : { word: "", reason: "" };
    const archetype = isRecord(parsed.archetype)
      ? { title: asString(parsed.archetype.title), description: asString(parsed.archetype.description) }
      : { title: "", description: "" };

    return NextResponse.json({
      available: true,
      opening: parsed.opening.trim(),
      phases: normalizePhases(parsed.phases),
      keywords: normalizeKeywords(parsed.keywords),
      lifeInference: asString(parsed.lifeInference),
      rebuilding: asString(parsed.rebuilding),
      yearKeyword,
      refuge: asString(parsed.refuge),
      upgradeMoments: normalizeStringArray(parsed.upgradeMoments, 4),
      archetype,
      ending: asString(parsed.ending),
    });
  } catch {
    return NextResponse.json(
      { available: false, message: "调用 AI 服务异常。" },
      { status: 200 },
    );
  }
}
