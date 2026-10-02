import { NextRequest, NextResponse } from "next/server";

import { AI_NOT_CONFIGURED_MESSAGE, chatCompletion, resolveAiProvider, visionModelFor } from "@/lib/server/ai-provider";
import { guardApiRequest } from "@/lib/server/api-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 金句识图：从书摘截图（微信读书分享卡、书页照片、Kindle 截图等）里提取摘抄语句、书名、作者。
 * 图片只用于这一次识别，服务端不保存。
 */

// 前端会先把图片压到长边 1600px 以内；这里再兜一道大小上限（data URL 字符数）
const MAX_IMAGE_CHARS = 6_000_000;
const IMAGE_RE = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

const PROMPT = `这是一张书摘图片（可能是微信读书 / 得到 / Kindle 的分享卡片、书页照片或截图）。
请提取其中的摘抄内容，只输出 JSON，不要任何解释：
{ "quotes": [ { "text": "摘抄的原文", "book": "书名", "author": "作者" } ] }
要求：
1. text 逐字照录原文，保留原标点；排版造成的换行要合并成连贯的句子，段落之间用换行分隔。
2. book 只写书名，去掉前面的「/」「——」「《》」等符号；书名后面跟着的章节名（如「· 论独处」）不要放进书名。
3. author 只写作者姓名，去掉「[法]」「（美）」这类国籍标注和「著」「译」等字样。
4. 忽略与摘抄无关的内容：分享者昵称、头像、「摘录于 某日期」、App 名称（如「微信读书」）、二维码、页码、按钮文字。
5. 图里有多段互不相连的摘抄时，拆成多条；同一段话不要拆开。
6. 看不出书名或作者时留空字符串，不要猜。图里没有可摘抄的文字时返回 { "quotes": [] }。`;

export async function POST(request: NextRequest) {
  const guardError = await guardApiRequest(request);
  if (guardError) return guardError;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "请求格式无效。" }, { status: 400 });
  }
  const image = typeof body === "object" && body !== null ? (body as { image?: unknown }).image : null;
  if (typeof image !== "string" || image.length > MAX_IMAGE_CHARS || !IMAGE_RE.test(image)) {
    return NextResponse.json({ message: "图片格式不支持或太大，请换一张 PNG / JPG 图片。" }, { status: 400 });
  }

  const provider = resolveAiProvider();
  if (!provider) return NextResponse.json({ available: false, message: AI_NOT_CONFIGURED_MESSAGE, quotes: [] });
  const vision = visionModelFor(provider);
  if (!vision) return NextResponse.json({ available: false, message: "当前配置的 AI 服务不支持识图。", quotes: [] });

  try {
    const resp = await chatCompletion(vision, {
      system: "你是一个精确的书摘识别助手，只做文字提取，不改写、不补全原文。",
      user: PROMPT,
      images: [image],
      temperature: 0,
      json: true,
    });
    if (!resp.ok) {
      console.error("[quote-ocr] API error", resp.status, await resp.text());
      return NextResponse.json({ available: true, message: "识别服务暂时不可用，请稍后重试。", quotes: [] }, { status: 502 });
    }
    const json = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = (json.choices?.[0]?.message?.content ?? "").replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    } catch {
      console.error("[quote-ocr] JSON parse failed:", raw.slice(0, 300));
      return NextResponse.json({ available: true, message: "没能读懂这张图，换一张清晰些的试试。", quotes: [] }, { status: 502 });
    }
    const list = Array.isArray((parsed as { quotes?: unknown }).quotes) ? (parsed as { quotes: unknown[] }).quotes : [];
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const quotes = list
      .filter((q): q is Record<string, unknown> => typeof q === "object" && q !== null)
      .map((q) => ({ text: str(q.text, 2000), book: str(q.book, 80), author: str(q.author, 60) }))
      .filter((q) => q.text)
      .slice(0, 10);
    return NextResponse.json({ available: true, quotes });
  } catch (err) {
    console.error("[quote-ocr] fetch error:", err);
    return NextResponse.json({ available: true, message: "网络错误，请稍后重试。", quotes: [] }, { status: 503 });
  }
}
