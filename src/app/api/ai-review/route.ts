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
  const headingMap: Record<ReviewPeriod, string> = {
    week: "以下是我本周的日记，请帮我做周度复盘：\n- 总结情绪变化\n- 分析学习连续性\n- 提炼个人洞察\n- 给出下周的温和建议",
    month: "以下是我本月的日记，请帮我做月度复盘：\n- 总结情绪变化\n- 提取重要事件\n- 给出成长建议",
    year: "以下是我本年的日记，请帮我做年度复盘：\n- 总结年度成长变化\n- 分析情绪变化\n- 提取重要里程碑\n- 给出未来建议",
  };

  const structureMap: Record<ReviewPeriod, string> = {
    week: "请用以下结构输出：\n1. 本周总结\n2. 情绪趋势\n3. 学习节奏\n4. 关键洞察\n5. 下周建议",
    month: "请用以下结构输出：\n1. 本月总结\n2. 情绪趋势\n3. 关键事件\n4. 成长建议",
    year: "请用以下结构输出：\n1. 年度成长总结\n2. 情绪变化\n3. 重要里程碑\n4. 未来建议",
  };

  return [
    headingMap[payload.period],
    "",
    structureMap[payload.period],
    "",
    "要求：",
    "- 使用简体中文",
    "- 语气温和、诚实、具体",
    "- 每个部分控制在 2-4 句",
    "- 优先结合输入中的真实事件和情绪波动",
    "",
    "用户数据：",
    JSON.stringify(payload, null, 2),
  ].join("\n");
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.SILICONFLOW_API_KEY || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        available: false,
        message: "AI 复盘是可选功能。请在 .env.local 中配置 SILICONFLOW_API_KEY 或 OPENAI_API_KEY。",
        reflection: null,
      },
      { status: 200 },
    );
  }

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

  try {
    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        messages: [
          {
            role: "system",
            content: "你是一位冷静、温和、擅长个人成长复盘的中文教练。",
          },
          {
            role: "user",
            content: buildPrompt(payload),
          },
        ],
        temperature: 0.7,
      }),
    });

    const json = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        isRecord(json) && isRecord(json.error) && typeof json.error.message === "string"
          ? json.error.message
          : "AI 复盘生成失败。";

      return NextResponse.json({ message }, { status: response.status });
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

