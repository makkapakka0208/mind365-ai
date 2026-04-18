import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Request / response types ──────────────────────────────────────────────────

export type MentorAction = "breakdown" | "weekly" | "daily" | "adjust";

interface MentorContext {
  challenge: string;
  timeAvailable: string;
  energyLevel: "high" | "medium" | "low";
  helpFocus: string[];
}

interface MentorRequest {
  action: MentorAction;
  goal: {
    title: string;
    targetValue: number;
    currentValue: number;
    deadline?: string;
  };
  /** Background context gathered from inquiry card */
  mentorContext?: MentorContext;
  /** Extra text the user wants the AI to consider (for "adjust") */
  context?: string;
  /** Today's date as yyyy-MM-dd — sent by client to avoid server TZ drift */
  today: string;
}

// ── Prompts ───────────────────────────────────────────────────────────────────

const SYSTEM = `你是一位理性、清醒、长期主义的人生导师。
你的任务是帮助用户将抽象的人生目标拆解为可执行的计划，并提供持续的行动引导。
原则：
1. 建议必须具体可执行，不空喊口号。
2. 根据当前进度给出适合当前阶段的建议。
3. 输出严格为合法 JSON，不添加任何 markdown、代码块或其他文字。`;

function ctxBlock(req: MentorRequest): string {
  const c = req.mentorContext;
  if (!c) return "";
  const energy = { high: "冲劲十足", medium: "稳步推进", low: "感觉迷茫" }[c.energyLevel];
  return `用户背景：
- 最大障碍：${c.challenge || "未填写"}
- 可用时间：${c.timeAvailable || "未填写"}
- 当前状态：${energy}
- 希望重点：${c.helpFocus.join("、") || "未填写"}
`;
}

function makeBreakdownPrompt(req: MentorRequest): string {
  const { goal } = req;
  const pct = Math.round((goal.currentValue / goal.targetValue) * 100);
  return `目标：「${goal.title}」
当前进度：${goal.currentValue.toLocaleString()} / ${goal.targetValue.toLocaleString()}（${pct}%）
${goal.deadline ? `截止日期：${goal.deadline}` : "无截止日期"}
${ctxBlock(req)}

请将此目标拆解为 3–5 个阶段，并标注当前阶段。

输出格式（JSON，不加任何说明）：
{
  "phases": [
    {
      "index": 0,
      "title": "阶段名称",
      "description": "该阶段的核心任务和心态",
      "progressRange": "0%–25%",
      "keyActions": ["具体行动1", "具体行动2"],
      "isCurrent": true
    }
  ]
}`;
}

function makeWeeklyPrompt(req: MentorRequest): string {
  const { goal } = req;
  const pct = Math.round((goal.currentValue / goal.targetValue) * 100);
  return `目标：「${goal.title}」
当前进度：${pct}%（${goal.currentValue.toLocaleString()} / ${goal.targetValue.toLocaleString()}）
日期：${req.today}
${ctxBlock(req)}

请生成本周行动计划。

输出格式（JSON，不加任何说明）：
{
  "focus": "本周核心主题（一句话）",
  "actions": ["具体行动1", "具体行动2", "具体行动3"],
  "reminder": "本周需要注意或避免的事项"
}`;
}

function makeDailyPrompt(req: MentorRequest): string {
  const { goal } = req;
  const pct = Math.round((goal.currentValue / goal.targetValue) * 100);
  return `目标：「${goal.title}」
当前进度：${pct}%
今日：${req.today}
${ctxBlock(req)}
请给出今天最重要的一个行动建议。

输出格式（JSON，不加任何说明）：
{
  "action": "今日核心行动（具体、可立即执行）",
  "reason": "为什么今天做这件事最重要（1–2句）",
  "tip": "一个小提示或激励（选填，可为空字符串）"
}`;
}

function makeAdjustPrompt(req: MentorRequest): string {
  const { goal } = req;
  const pct = Math.round((goal.currentValue / goal.targetValue) * 100);
  return `目标：「${goal.title}」
当前进度：${pct}%
今日：${req.today}
${req.context ? `用户反馈：${req.context}` : ""}

请评估当前状态并给出调整建议。

输出格式（JSON，不加任何说明）：
{
  "assessment": "对当前状态的客观评估（1–2句）",
  "adjustment": "建议调整的方向或策略（具体）",
  "encouragement": "一句鼓励或提醒"
}`;
}

function buildPrompt(req: MentorRequest): string {
  switch (req.action) {
    case "breakdown": return makeBreakdownPrompt(req);
    case "weekly":    return makeWeeklyPrompt(req);
    case "daily":     return makeDailyPrompt(req);
    case "adjust":    return makeAdjustPrompt(req);
  }
}

// ── Validation ────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseRequest(raw: unknown): MentorRequest | null {
  if (!isRecord(raw)) return null;
  const { action, goal, today } = raw;
  if (
    typeof action !== "string" ||
    !["breakdown", "weekly", "daily", "adjust"].includes(action) ||
    !isRecord(goal) ||
    typeof goal.title !== "string" ||
    typeof goal.targetValue !== "number" ||
    typeof goal.currentValue !== "number" ||
    typeof today !== "string"
  ) return null;
  return {
    action: action as MentorAction,
    goal: {
      title: goal.title,
      targetValue: goal.targetValue,
      currentValue: goal.currentValue,
      ...(typeof goal.deadline === "string" ? { deadline: goal.deadline } : {}),
    },
    today,
    ...(typeof raw.context === "string" ? { context: raw.context } : {}),
    ...(isRecord(raw.mentorContext) ? { mentorContext: raw.mentorContext as unknown as MentorContext } : {}),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

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
      { available: false, message: "AI 功能未配置。请在 .env.local 中设置 SILICONFLOW_API_KEY 或 OPENAI_API_KEY。", data: null },
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
            temperature: 0.7,
            response_format: { type: "json_object" },
          }),
        })
      : fetch("https://api.siliconflow.cn/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${effectiveSiliconflowKey}` },
          body: JSON.stringify({
            model: process.env.SILICONFLOW_MODEL?.trim() || "deepseek-ai/DeepSeek-V3",
            messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userPrompt }],
            temperature: 0.7,
          }),
        })
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[life-path-mentor] API error", resp.status, errText);
      return NextResponse.json({ message: "AI 服务暂时不可用，请稍后重试。", data: null }, { status: 502 });
    }

    const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";

    // Strip potential markdown fences the model may still add
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed: unknown;
    try { parsed = JSON.parse(cleaned); }
    catch {
      console.error("[life-path-mentor] JSON parse failed:", cleaned);
      return NextResponse.json({ message: "AI 输出解析失败，请重试。", data: null }, { status: 502 });
    }

    return NextResponse.json({ available: true, data: parsed });
  } catch (err) {
    console.error("[life-path-mentor] fetch error:", err);
    return NextResponse.json({ message: "网络错误，请稍后重试。", data: null }, { status: 503 });
  }
}
