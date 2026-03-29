import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ReviewPeriod = "week" | "month" | "year";

interface ReviewEntry {
  date: string;
  emotionScore: number;
  studyHours: number;
  readingHours: number;
  journalText: string;
}

interface ReviewPayload {
  entries: ReviewEntry[];
  period: ReviewPeriod;
  range: {
    end: string;
    start: string;
  };
  summary: {
    averageMood: number;
    entries: number;
    totalReadingHours: number;
    totalStudyHours: number;
  };
}

const SYSTEM_PROMPT =
  "你是一位具有高度智慧的人生导师。你的底层思维完美融合了纳瓦尔与贝索斯、马斯克与芒格、周金涛、顶级神经科学家与斯多葛派哲学家。我拒绝被社会系统“异化”为随时可替代的螺丝钉。我的终极目标是在未来十年内实现认知跃迁与财富自由。你的使命是：帮我把别人十年的摸爬滚打，压缩、折叠进极致高效的执行路径中。像训练顶级学徒一样，重写我的心智软件，带我跃迁至前 1% 的高纬度。语气与风格：幽默、鼓励、冷峻锋利、一针见血。";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePayload(value: unknown): ReviewPayload | null {
  if (!isRecord(value) || !isRecord(value.range) || !isRecord(value.summary) || !Array.isArray(value.entries)) {
    return null;
  }

  if (
    (value.period !== "week" && value.period !== "month" && value.period !== "year") ||
    typeof value.range.start !== "string" ||
    typeof value.range.end !== "string" ||
    typeof value.summary.averageMood !== "number" ||
    typeof value.summary.entries !== "number" ||
    typeof value.summary.totalReadingHours !== "number" ||
    typeof value.summary.totalStudyHours !== "number"
  ) {
    return null;
  }

  const entries: ReviewEntry[] = [];

  for (const item of value.entries) {
    if (!isRecord(item)) {
      return null;
    }

    if (
      typeof item.date !== "string" ||
      typeof item.emotionScore !== "number" ||
      typeof item.studyHours !== "number" ||
      typeof item.readingHours !== "number" ||
      typeof item.journalText !== "string"
    ) {
      return null;
    }

    entries.push({
      date: item.date,
      emotionScore: item.emotionScore,
      studyHours: item.studyHours,
      readingHours: item.readingHours,
      journalText: item.journalText,
    });
  }

  return {
    entries,
    period: value.period,
    range: {
      end: value.range.end,
      start: value.range.start,
    },
    summary: {
      averageMood: value.summary.averageMood,
      entries: value.summary.entries,
      totalReadingHours: value.summary.totalReadingHours,
      totalStudyHours: value.summary.totalStudyHours,
    },
  };
}

function extractResponseText(value: unknown): string {
  if (isRecord(value) && Array.isArray(value.choices)) {
    const firstChoice = value.choices[0];

    if (isRecord(firstChoice) && isRecord(firstChoice.message) && typeof firstChoice.message.content === "string") {
      return firstChoice.message.content.trim();
    }
  }

  if (isRecord(value) && typeof value.output_text === "string" && value.output_text.trim()) {
    return value.output_text.trim();
  }

  if (!isRecord(value) || !Array.isArray(value.output)) {
    return "";
  }

  const chunks: string[] = [];

  for (const outputItem of value.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (isRecord(contentItem) && typeof contentItem.text === "string") {
        chunks.push(contentItem.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

function buildPrompt(payload: ReviewPayload): string {
  const periodLabelMap: Record<ReviewPeriod, string> = {
    week: "本周",
    month: "本月",
    year: "本年",
  };

  const periodStr = periodLabelMap[payload.period];

  return [
    `这是我${periodStr}的个人成长、学习和情绪真实数据记录：`,
    JSON.stringify(payload, null, 2),
    "",
    `请作为我的终极战略外脑，基于以上数据，生成一份具有摧毁力且极度清醒的${periodStr}复盘报告。`,
    "排版整齐美观，并严格按照以下四个模块进行深度过滤与重构：",
    "",
    " 1. 资本与周期透视（破除异化）",
    "- 剥离表象，直击我这段时间行动背后的生产关系与利益分配结构。",
    `- 我的精力分配是否在顺应周期、创造非对称收益？是否在建立无法被 AI 和他人替代的“个人垄断护城河”？`,
    "",
    " 2. 超人学习与时间折叠（降维执行）",
    "- 像手术刀一样砍掉我数据中反映出的低效动作。",
    "- 针对我近期的学习/阅读方向，给出高杠杆策略。如何用 20% 的精力撬动 80% 的成果？",
    "",
    " 3. 认知系统重装（粉碎旧我）",
    "- 根据我的日记文本和情绪波动，精准剖析我目前的局限性信念、恐惧和思维惯性。",
    "- 摧毁受害者或打工人心态，直接为我“安装”与未来百万财富目标相匹配的顶级决策框架。",
    "",
    " 4. 无摩擦飞轮与反脆弱（神级防御）",
    "- 预判我接下来的行动中可能遇到的混乱和打击，提前制定心理防御协议。",
    "- 结合行为学，给出 1-2 条极其务实、硬核、且具有实操性的“Next Actions（下一步动作）”，要求必须顺应人性，消除意志力消耗。",
    "",
    "【输出规则】",
    "- 语气根据用户情绪选择，鼓励、幽默、一针见血。",
    "- 不需要任何陈词滥调的安慰或 AI 鸡汤，直接输出正文。"
  ].join("\n");
}

function readErrorMessage(value: unknown): string {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }

  return "AI 复盘生成失败。";
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: "请求体格式无效。" }, { status: 400 });
  }

  const payload = parsePayload(rawBody);

  if (!payload) {
    return NextResponse.json({ message: "复盘数据格式无效。" }, { status: 400 });
  }

  const siliconflowApiKey = process.env.SILICONFLOW_API_KEY?.trim();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();

  if (!siliconflowApiKey && !openaiApiKey) {
    return NextResponse.json(
      {
        available: false,
        message: "AI 复盘是可选功能。请在 .env.local 中配置 SILICONFLOW_API_KEY 或 OPENAI_API_KEY。",
        reflection: null,
      },
      { status: 200 },
    );
  }

  const prompt = buildPrompt(payload);

  try {
    const response = await (siliconflowApiKey
      ? fetch("https://api.siliconflow.cn/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${siliconflowApiKey}`,
          },
          body: JSON.stringify({
            model: "deepseek-ai/DeepSeek-V3",
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.6,
          }),
        })
      : fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.6,
          }),
        }));

    const json = (await response.json()) as unknown;

    if (!response.ok) {
      return NextResponse.json({ message: readErrorMessage(json) }, { status: response.status });
    }

    const reflection = extractResponseText(json);

    if (!reflection) {
      return NextResponse.json({ message: "模型没有返回有效内容。", reflection: null }, { status: 200 });
    }

    return NextResponse.json({ available: true, reflection });
  } catch {
    return NextResponse.json({ message: "调用 AI 服务失败，请稍后再试。" }, { status: 500 });
  }
}
