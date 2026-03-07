import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

interface WeeklyReflectionEntry {
  date: string;
  emotionScore: number;
  studyHours: number;
  readingHours: number;
  journalText: string;
}

interface WeeklyReflectionPayload {
  weekRange: {
    start: string;
    end: string;
  };
  summary: {
    averageMood: number;
    totalStudyHours: number;
    totalReadingHours: number;
    entries: number;
  };
  entries: WeeklyReflectionEntry[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePayload(value: unknown): WeeklyReflectionPayload | null {
  if (!isRecord(value) || !isRecord(value.weekRange) || !isRecord(value.summary) || !Array.isArray(value.entries)) {
    return null;
  }

  if (
    typeof value.weekRange.start !== "string" ||
    typeof value.weekRange.end !== "string" ||
    typeof value.summary.averageMood !== "number" ||
    typeof value.summary.totalStudyHours !== "number" ||
    typeof value.summary.totalReadingHours !== "number" ||
    typeof value.summary.entries !== "number"
  ) {
    return null;
  }

  const entries: WeeklyReflectionEntry[] = [];

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
    weekRange: {
      start: value.weekRange.start,
      end: value.weekRange.end,
    },
    summary: {
      averageMood: value.summary.averageMood,
      totalStudyHours: value.summary.totalStudyHours,
      totalReadingHours: value.summary.totalReadingHours,
      entries: value.summary.entries,
    },
    entries,
  };
}

function extractResponseText(value: unknown): string {
  // 适配标准 OpenAI/硅基流动返回格式
  if (isRecord(value) && Array.isArray(value.choices)) {
    const content = value.choices[0]?.message?.content;
    if (typeof content === "string") return content.trim();
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

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log("当前的 Key 是:", apiKey?.substring(0, 8) + "...");
  if (!apiKey) {
    return NextResponse.json({
      reflection: null,
      available: false,
      message: "AI reflection is optional. Add OPENAI_API_KEY to .env.local to enable it.",
    });
  }

  let body: unknown;

  try {
    body = await request.json();
    //console.log("接收到的原始数据:", JSON.stringify(body, null, 2));
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const payload = parsePayload(body)||body;

  //if (!payload) {
  //  return NextResponse.json({ message: "Invalid weekly data payload." }, { status: 400 });
  //}

  const prompt = [
    "Analyze the user's weekly personal growth data and provide a thoughtful reflection including:",
    "- emotional trends",
    "- learning consistency",
    "- personal insights",
    "- gentle advice for next week",
    "",
    "Write in warm, concise, encouraging language.",
    "Use short sections with clear headings and practical suggestions.",
    "",
    "Weekly data:",
    JSON.stringify(payload, null, 2),
    "",
    "IMPORTANT: Please provide the final reflection in Chinese (Simplified)." // 输出中文
  ].join("\n");

  try {
    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-ai/DeepSeek-V3",
        // 适配标准 Chat Completion 格式
        messages: [
          {
            role: "system",
            content: "You are a compassionate personal growth coach helping users reflect on habits and emotions."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7
      }),
    });
        

    const json = (await response.json()) as unknown;

    if (!response.ok) {
      const message =
        isRecord(json) && typeof json.error === "object" && json.error && "message" in json.error
          ? String((json.error as { message?: unknown }).message ?? "OpenAI request failed.")
          : "OpenAI request failed.";

      return NextResponse.json({ message }, { status: response.status });
    }

    const reflection = extractResponseText(json);

    if (!reflection) {
      return NextResponse.json({
        reflection: null,
        available: true,
        message: "No reflection text returned. Please try again.",
      });
    }

    return NextResponse.json({
      reflection,
      available: true,
    });
  } catch {
    return NextResponse.json(
      {
        message: "Failed to generate AI reflection. Please try again.",
      },
      { status: 500 },
    );
  }
}