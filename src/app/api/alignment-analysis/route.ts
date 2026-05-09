import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface GoalSummary {
  title: string;
  targetValue: number;
  currentValue: number;
}

interface AlignmentRequest {
  thoughts: string;
  goals: GoalSummary[];
}

const SYSTEM = `你是一位理性、清醒、长期主义的人生导师。
你的任务是分析用户今天的日记内容，判断其行为与人生目标的契合程度。
原则：
1. 评分客观，基于日记中实际出现的行为和内容。
2. 正面行为指推动目标进展的行为，负面行为指消耗精力却偏离目标的行为。
3. 洞察要精准简短，不超过 30 字。
4. 输出严格为合法 JSON，不添加任何 markdown、代码块或其他文字。`;

function buildPrompt(req: AlignmentRequest): string {
  const goalList = req.goals
    .map((g, i) => {
      const pct = Math.round((g.currentValue / g.targetValue) * 100);
      return `${i + 1}. 「${g.title}」（当前进度 ${pct}%）`;
    })
    .join("\n");

  return `用户的人生目标：
${goalList}

今日日记内容：
${req.thoughts}

请分析今日日记与以上目标的契合程度，并输出以下 JSON：
{
  "score": <0–100 的整数，50 = 中性，越高代表越契合目标>,
  "positiveActions": [<推进目标的行为，中文短语，最多 4 个>],
  "negativeActions": [<阻碍目标的行为，中文短语，最多 4 个>],
  "insight": "<一句话洞察，不超过 30 字>"
}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseRequest(raw: unknown): AlignmentRequest | null {
  if (!isRecord(raw)) return null;
  const { thoughts, goals } = raw;
  if (typeof thoughts !== "string" || !Array.isArray(goals) || goals.length === 0) return null;
  const parsedGoals = goals
    .filter(isRecord)
    .map((g) => ({
      title: typeof g.title === "string" ? g.title : "",
      targetValue: typeof g.targetValue === "number" ? g.targetValue : 1,
      currentValue: typeof g.currentValue === "number" ? g.currentValue : 0,
    }))
    .filter((g) => g.title.trim().length > 0);
  if (parsedGoals.length === 0) return null;
  return { thoughts, goals: parsedGoals };
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try { rawBody = await request.json(); }
  catch { return NextResponse.json({ message: "请求格式无效。" }, { status: 400 }); }

  const req = parseRequest(rawBody);
  if (!req) return NextResponse.json({ message: "参数格式无效。" }, { status: 400 });

  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const legacyKey = !siliconflowKey && provider !== "openai" ? openaiKey : undefined;
  const effectiveSiliconflowKey = siliconflowKey || legacyKey;

  if (!effectiveSiliconflowKey && !openaiKey) {
    return NextResponse.json(
      { available: false, message: "AI 功能未配置。", data: null },
      { status: 200 },
    );
  }

  const userPrompt = buildPrompt(req);

  try {
    const useOpenAI = provider === "openai";
    const resp = await (useOpenAI
      ? fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey}` },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
            messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
            temperature: 0.5,
            response_format: { type: "json_object" },
          }),
        })
      : fetch("https://api.siliconflow.cn/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${effectiveSiliconflowKey}` },
          body: JSON.stringify({
            model: process.env.SILICONFLOW_MODEL?.trim() || "deepseek-ai/DeepSeek-V3",
            messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
            temperature: 0.5,
          }),
        })
    );

    if (!resp.ok) {
      console.error("[alignment-analysis] API error", resp.status);
      return NextResponse.json({ message: "AI 服务暂时不可用，请稍后重试。", data: null }, { status: 502 });
    }

    const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: unknown;
    try { parsed = JSON.parse(cleaned); }
    catch {
      console.error("[alignment-analysis] JSON parse failed:", cleaned);
      return NextResponse.json({ message: "AI 输出解析失败，请重试。", data: null }, { status: 502 });
    }

    return NextResponse.json({ available: true, data: parsed });
  } catch (err) {
    console.error("[alignment-analysis] fetch error:", err);
    return NextResponse.json({ message: "网络错误，请稍后重试。", data: null }, { status: 503 });
  }
}
