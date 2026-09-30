import { NextRequest, NextResponse } from "next/server";

import { AI_NOT_CONFIGURED_MESSAGE, chatCompletion, resolveAiProvider } from "@/lib/server/ai-provider";
import { guardApiRequest } from "@/lib/server/api-guard";

export const runtime = "nodejs";
// 快速模型失败时会退回深度推理模型，可能要两三分钟：放宽函数最长执行时间（Vercel 上限内）
export const maxDuration = 300;

/**
 * 周末 / 假期计划：根据本周任务、待办、习惯、目标、在读的书和用户已定的安排，
 * 给一段连续休息日排出精确到时间的计划。
 * 只接收计划相关的标题文字，不涉及日记内容，因此不需要日记授权。
 */

type Pace = "relaxed" | "balanced" | "full";

interface PlanRequest {
  block: { name: string; dates: Array<{ date: string; weekday: string }> };
  pace: Pace;
  fixed: string;
  context: {
    tasks: Array<{ id: string; text: string; goal?: string }>;
    todos: Array<{ id: string; text: string; urgent: boolean; important: boolean; due?: string }>;
    habits: Array<{ id: string; name: string; target: string; weeklyDays: number }>;
    goals: Array<{ id: string; title: string; progress: number; deadline?: string }>;
    reading: Array<{ title: string; progress: number }>;
  };
}

const SYSTEM = `你是一位懂得张弛有度的生活规划助手，帮用户安排周末或法定假期，排出精确到时间的计划表。
你只输出 JSON，不要任何解释或 Markdown。格式：
{
  "summary": "一句话概括这段休息日的安排思路（25 字以内）",
  "days": [
    { "date": "yyyy-MM-dd", "items": [ { "start": "HH:mm", "end": "HH:mm", "title": "简短具体的事项", "kind": "类型", "refId": "关联 id（可选）" } ] }
  ]
}
规则：
1. days 必须覆盖给定的每一个日期，按日期顺序；每天的 items 按开始时间排序，时间不能重叠，范围 07:00–23:30。
2. kind 只能是：fixed（用户已定的安排）、task（本周任务）、todo（待办）、habit（习惯）、goal（推进目标）、reading（阅读）、rest（休息/放松/出游）、life（吃饭、家务、采购等生活事务）。
3. 条目对应用户提供的任务 / 待办 / 习惯 / 目标时，refId 填对应 id；其它情况不要填 refId，不要编造 id。
4. 用户写的「已定安排」必须放进计划，kind=fixed，时间按用户说的；没说时间就放在合理的位置，其它事项避开它。
5. 节奏：
   - 轻松：起床约 9:30，每天专注类事项（任务、待办、目标、学习）合计不超过 2.5 小时，留大段休息；
   - 平衡：起床约 9:00，专注类合计约 4 小时，上午做需要专注的事，下午穿插生活事务和休息；
   - 充实：起床约 8:00，专注类合计约 6 小时，但每 90 分钟要有休息。
6. 每天都要有早餐、午饭（可含午休）、晚饭，写成 life 或 rest；晚上 21:30 以后只放放松的事。
7. 优先级：重要且紧急的待办和有截止日期的尽量排在第一天；然后是本周任务、重要不紧急的待办、推进目标的具体动作；不重要的待办可以不排。
8. 习惯按每周目标天数安排在合适的日子，标题写上时长或次数；有在读的书就安排阅读。
9. 3 天及以上的假期：至少留一整天或两个半天完全用来休息、出门或见人，不要每天排满；最后一天晚上安排一小段整理下周事项，帮助回到工作状态。
10. 标题要具体、简短（18 字以内），比如「背雅思单词 40 分钟」「读《博弈论》第 3 章」，不要写「学习」这种空泛的词。`;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max).filter(isRecord) : []);

function parseRequest(raw: unknown): PlanRequest | null {
  if (!isRecord(raw) || !isRecord(raw.block) || !isRecord(raw.context)) return null;
  const pace = raw.pace;
  if (pace !== "relaxed" && pace !== "balanced" && pace !== "full") return null;
  const dates = list(raw.block.dates, 16)
    .map((d) => ({ date: str(d.date, 10), weekday: str(d.weekday, 4) }))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date));
  if (dates.length === 0) return null;
  const ctx = raw.context;
  return {
    block: { name: str(raw.block.name, 30) || "周末", dates },
    pace,
    fixed: str(raw.fixed, 500),
    context: {
      tasks: list(ctx.tasks, 20).map((t) => ({ id: str(t.id, 64), text: str(t.text, 80), ...(t.goal ? { goal: str(t.goal, 40) } : {}) })),
      todos: list(ctx.todos, 25).map((t) => ({
        id: str(t.id, 64),
        text: str(t.text, 80),
        urgent: t.urgent === true,
        important: t.important === true,
        ...(t.due ? { due: str(t.due, 10) } : {}),
      })),
      habits: list(ctx.habits, 12).map((h) => ({
        id: str(h.id, 64),
        name: str(h.name, 30),
        target: str(h.target, 20),
        weeklyDays: typeof h.weeklyDays === "number" ? h.weeklyDays : 7,
      })),
      goals: list(ctx.goals, 8).map((g) => ({
        id: str(g.id, 64),
        title: str(g.title, 40),
        progress: typeof g.progress === "number" ? g.progress : 0,
        ...(g.deadline ? { deadline: str(g.deadline, 10) } : {}),
      })),
      reading: list(ctx.reading, 3).map((b) => ({ title: str(b.title, 40), progress: typeof b.progress === "number" ? b.progress : 0 })),
    },
  };
}

function buildPrompt(req: PlanRequest): string {
  const pace = { relaxed: "轻松", balanced: "平衡", full: "充实" }[req.pace];
  const { tasks, todos, habits, goals, reading } = req.context;
  const lines = [
    `休息日：${req.block.name}，共 ${req.block.dates.length} 天：${req.block.dates.map((d) => `${d.date}（${d.weekday}）`).join("、")}`,
    `想过得：${pace}`,
    `已定安排：${req.fixed || "无"}`,
    "",
    `本周未完成的任务：${tasks.length ? "" : "无"}`,
    ...tasks.map((t) => `- [${t.id}] ${t.text}${t.goal ? `（目标：${t.goal}）` : ""}`),
    `未完成的待办：${todos.length ? "" : "无"}`,
    ...todos.map((t) => `- [${t.id}] ${t.text}（${t.important ? "重要" : "不重要"}${t.urgent ? "·紧急" : ""}${t.due ? `·截止 ${t.due}` : ""}）`),
    `习惯：${habits.length ? "" : "无"}`,
    ...habits.map((h) => `- [${h.id}] ${h.name}，每天 ${h.target}，每周 ${h.weeklyDays} 天`),
    `进行中的目标：${goals.length ? "" : "无"}`,
    ...goals.map((g) => `- [${g.id}] ${g.title}，进度 ${g.progress}%${g.deadline ? `，截止 ${g.deadline}` : ""}`),
    `在读的书：${reading.length ? reading.map((b) => `《${b.title}》读到 ${b.progress}%`).join("、") : "无"}`,
  ];
  return lines.join("\n");
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

  const req = parseRequest(rawBody);
  if (!req) return NextResponse.json({ message: "参数格式无效。" }, { status: 400 });

  const provider = resolveAiProvider();
  if (!provider) {
    return NextResponse.json({ available: false, message: AI_NOT_CONFIGURED_MESSAGE, data: null }, { status: 200 });
  }

  // 排计划是结构化任务，用快速模型（默认 deepseek-flash，可用 DEEPSEEK_FAST_MODEL 覆盖）：
  // 深度推理模型排一个 7 天长假要两三分钟，快速模型只要几十秒。快速模型调用失败时退回默认模型。
  const fast =
    provider.name === "deepseek" ? { ...provider, model: process.env.DEEPSEEK_FAST_MODEL?.trim() || "deepseek-flash" } : provider;
  const opts = { system: SYSTEM, user: buildPrompt(req), temperature: 0.6, json: true };

  try {
    let resp = await chatCompletion(fast, opts);
    if (!resp.ok && fast !== provider) {
      console.error("[rest-plan] fast model failed, falling back", resp.status, await resp.text());
      resp = await chatCompletion(provider, opts);
    }
    if (!resp.ok) {
      console.error("[rest-plan] API error", resp.status, await resp.text());
      return NextResponse.json({ available: true, message: "AI 服务暂时不可用，请稍后重试。", data: null }, { status: 502 });
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = json.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    // 模型偶尔会在 JSON 前后带说明文字：截取最外层的大括号
    const body = cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1);
    let parsed: unknown;
    try {
      parsed = JSON.parse(body);
    } catch {
      console.error("[rest-plan] JSON parse failed:", cleaned.slice(0, 500));
      return NextResponse.json({ available: true, message: "AI 输出解析失败，请重试。", data: null }, { status: 502 });
    }
    return NextResponse.json({ available: true, data: parsed });
  } catch (err) {
    console.error("[rest-plan] fetch error:", err);
    return NextResponse.json({ available: true, message: "网络错误，请稍后重试。", data: null }, { status: 503 });
  }
}
