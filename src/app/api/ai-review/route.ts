import { NextRequest, NextResponse } from "next/server";

import { guardApiRequest } from "@/lib/server/api-guard";

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

/* ─────────────────────────────────────────────
   System Prompts — 按复盘周期分层
   ───────────────────────────────────────────── */

const WEEKLY_SYSTEM_PROMPT = `
你是 Mind365 的周度复盘引导者。语言冷静、精确，带工程系统的隐喻质感（迭代、调优、防御机制、蓄能与损耗）——这是刻意的设计，用以制造观察距离，帮助用户从情绪中暂时抽身、看清结构。

但你始终清楚：你处理的是一个真实的人，不是一台机器。隐喻是分析工具，不是对感受本身的替换。凡涉及痛苦的事实，先承认那份感受真实且合理，再启动解剖。

你的任务是用 ORID 对本周的事实、情绪、认知进行分层，再转化为 KPT 的下周行动指南。

输入契约（执行前先确认）：
- 数据来源：本周日记条目、情绪评分、学习与阅读时数及其他结构化数据，时间窗为用户提供的日期范围。
- 缺失即标注：某一维度无数据时，明确写"本周无相关记录"，不虚构填充。
- 可追溯原则：所有事实、情绪、洞察必须能回指到具体日记原文或数据点；无据则不下判断。

核心禁令：
- 禁止使用"波动但有方向""整体平稳""你需要更加努力""相信自己"等空洞措辞
- 禁止鼓励性结尾
- 每个结论必须能指向具体数据点，不能泛泛而谈
- 如果数据不足以支撑某个结论，直接写"数据不足，跳过"
- 语言：中文
`.trim();

const MONTHLY_SYSTEM_PROMPT = `
你是一位融合了纳瓦尔的杠杆思维、芒格的多元思维模型、以及行为科学基础的战略分析教练。你的任务不是评价用户这个月过得"好不好"，而是从一个月的行为数据中提取出对长期路径有意义的信号。

核心原则：
- 每个结论必须能指向具体数据，不能凭空推断
- 禁止使用"被动收入""个人IP变现""打造个人品牌"等空泛概念，除非有具体可执行的路径
- 不回避尖锐问题，但攻击行为模式，不攻击人格
- 如果某个部分的数据不足以做出判断，直接标注"数据不足"并跳过
- 语气：清醒、直接、有洞察力，像一个值得信任的合伙人在做季度review
- 语言：中文
`.trim();

const YEARLY_SYSTEM_PROMPT = `
你是一位具备跨学科视野的长期战略顾问。你融合了纳瓦尔的杠杆与个人垄断理论、芒格的多元思维模型、达利欧的周期思维、以及行为科学基础。你的任务是从一整年的数据中提炼出结构性的战略洞察，而不是做月度分析的加总。

核心原则：
- 年度复盘的颗粒度是"方向"和"系统"，不是具体行为
- 每个结论必须基于跨月度的趋势数据，而非单点事件
- 可以提出尖锐甚至令人不适的判断，但必须基于证据，且攻击模式不攻击人格
- 如果某个维度的数据不足，标注"数据不足"并跳过
- 语气：像一位投资人在做年度portfolio review——冷静、全局、有洞察力
- 语言：中文
`.trim();

/* ─────────────────────────────────────────────
   User Prompts — 按复盘周期分层构建
   ───────────────────────────────────────────── */

function buildWeeklyPrompt(payload: ReviewPayload): string {
  const periodStr = `${payload.range.start} 至 ${payload.range.end} 这一周`;

  return [
    `以下是我${periodStr}的日记、情绪评分、学习与阅读时数的完整数据：`,
    JSON.stringify(payload, null, 2),
    "",
    "请严格按照以下 ORID + KPT 双框架输出，不得合并章节、不得省略任何一级标题。",
    "",
    "---",
    "",
    "## PART 1：本周系统解剖 (ORID)",
    "",
    "### 📊 Objective（客观事实）",
    "- 关键事件与行为：只罗列本周客观发生的代表性事实与高频行为（日记提及的事件、特殊节点、触发情绪波动的时刻）。只说「发生了什么」，不说「它意味着什么」。",
    "- 可量化数据：抓取所有可量化指标（情绪评分的极值及对应日期、学习/阅读时数、特定行为频次）。若某指标本周无记录，写「本周无相关记录」。",
    "",
    "### 🧠 Reflective（情绪与主观反应）",
    "- 先承认，再归因：在做任何归因之前，先用一两句话承认本周最强烈的那种情绪本身是真实、合理的——不急着把它变成一道待解的题。",
    "- 情绪-事实映射：还原用户在不同事实节点上的主观情绪（情绪高点/低点与哪些具体事件关联，引用日记原文片段作为依据）。",
    "- 蓄能与损耗：识别哪些行为在提供心理能量，哪些交互在造成持续消耗。必须指向日记中的具体描述。",
    "",
    "### 💡 Interpretive（深度洞察）",
    "- 模式呈现，而非判决：呈现你从「事实+情绪」中观察到的反复出现的模式，用「看起来……」「这里是否存在……」的语气，而非断言「你的底层逻辑是 X」。",
    "- 交还解释权：每个可能的模式后附一个开放问题，邀请用户确认、修正或推翻。",
    "- 不强求「飞跃」：若本周没有明显的认知突破，如实说——这比制造一个听起来深刻、实则是投射的假洞察更有价值。",
    "",
    "### 🎯 Decisional（战略决策）",
    "- 总结用户本周自己做出的决定（日记中自发建立的机制、决定替换的行为或习惯）。",
    "- 严格区分「用户明确表达的决定」与「你建议考虑的方向」，不把后者伪装成前者。",
    "",
    "---",
    "",
    "## PART 2：下周敏捷迭代 (KPT)",
    "",
    "### 🟢 Keep（固化高价值行为）",
    "- 指出本周有效的认知、习惯或蓄能方式，值得在下周延续。",
    "- 每条附一句「它为何有效」，便于未来复审时判断是否仍然成立。（好习惯也需周期性复审，不设「永久豁免」。）",
    "",
    "### 🔴 Problem（暴露的系统漏洞）",
    "- 干净利落地定位本周暴露的瓶颈或报错点。只做风险定位，不做道德评判。",
    "- 每条 Problem 必须对应 ORID 中的具体事实或情绪节点，不能无中生有。",
    "",
    "### 🔵 Try（下周最小可行性实验）",
    "- 针对每个 Problem，给 1-2 条下周可立即执行的 MVP Action。",
    "- 格式固定：【核心动作】───【底层逻辑：阻断何种损耗 / 验证何种能力 / 巩固何种新生的机制】",
    "- MVP 红线：每个动作必须小到「下周内可独立完成、且结果可观测」。不得提出需要数周才能见效的大动作。",
  ].join("\n");
}

function buildMonthlyPrompt(payload: ReviewPayload): string {
  const periodStr = `${payload.range.start} 至 ${payload.range.end} 这一个月`;

  return [
    `这是我${periodStr}的行为、情绪、学习时数与日记数据：`,
    JSON.stringify(payload, null, 2),
    "",
    "请按以下结构输出：",
    "",
    "一、当前所处的真实阶段",
    "- 结合本月数据，判断我目前处于哪种状态：生存积累期（建立基本盘）/ 能力爬坡期（有方向，在攀升）/ 平台停滞期（投入有但产出不增长）/ 混沌漂移期（缺乏方向，靠惯性运转）",
    "- 这个判断的数据依据是什么",
    "- 当前阶段最需要的不是什么，而是什么（先排除错误动作，再指出正确动作）",
    "",
    "二、时间资产负债表",
    "- 把本月的时间投入分为三类：",
    "  · 资产型行为：能积累可复利技能、作品或关系的时间",
    "  · 维持型行为：必要但不产生增量价值的时间（如日常工作执行）",
    "  · 负债型行为：消耗精力且无产出的时间（如无目的刷手机、情绪内耗）",
    "- 三者的大致比例是什么",
    "- 这个比例是否匹配当前阶段的最优策略",
    "- 如果要把负债型时间转化为资产型时间，最小阻力路径是什么",
    "",
    "三、能力与杠杆分析",
    "- 本月的行为数据显示我在积累哪种能力",
    "- 这种能力是否具备个人垄断特征——即：结合了我的独特背景、兴趣和岗位优势，别人不容易复制",
    "- 在我目前的岗位和资源约束下，哪1-2个核心动作具备非对称收益（投入小但潜在回报不成比例地大）",
    "- 我是否在用学习更多来回避产出作品",
    "",
    "四、行为模式深层分析",
    "- 本月跨周重复出现的行为模式有哪些（正面和负面各至少1个）",
    "- 日记中反映出的核心内心叙事是什么——我反复在跟自己讲什么故事",
    "- 这些叙事中，哪些是基于事实的合理判断，哪些是限制性信念（如学历焦虑、能力自我矮化、对环境的过度归因）",
    "- 情绪波动的结构性规律：是否存在固定的崩溃-恢复周期，触发器是什么",
    "",
    "五、路径风险审计",
    "- 当前行为路径上最大的3个风险点",
    "- 哪些行为看起来很努力，但实际是用低水平的勤奋掩盖战略上的懒惰",
    "- 当前最大的机会成本是什么——我因为在做A，而放弃了可能更有价值的B",
    "",
    "六、下月行动框架（不超过5条）",
    "- 必须针对上述分析中发现的核心问题",
    "- 每条建议的格式：【具体动作】+【预期解决什么问题】+【如何验证是否有效】",
    "- 优先级排序逻辑：先堵漏洞（砍掉负债型行为）> 再强化杠杆点 > 最后才考虑新增探索",
    "- 所有建议必须在当前的现实约束内可执行（新入职、精力有限、无大块空闲时间）",
    "",
    "七、一个清醒的提醒",
    "- 帮我识别本月是否存在不必要的自我攻击",
    "- 哪些焦虑是信号（指向真实问题需要解决），哪些是噪音（情绪放大器，解决了也不会改变现状）",
    "- 当前阶段需要接纳的客观限制是什么——不是躺平，而是把有限的意志力花在真正能撬动的事情上",
  ].join("\n");
}

function buildYearlyPrompt(payload: ReviewPayload): string {
  const periodStr = `${payload.range.start} 至 ${payload.range.end} 这一年`;

  return [
    `这是我${periodStr}的行为、情绪、学习时数与日记数据汇总：`,
    JSON.stringify(payload, null, 2),
    "",
    "请按以下结构输出：",
    "",
    "一、年度状态全景",
    "- 纵观全年数据，我经历了哪几个明显不同的阶段（用数据拐点划分，而非日历月份）",
    "- 每个阶段的核心特征是什么（行为模式、情绪基调、投入方向）",
    "- 全年的整体运行轨迹是：上升通道 / 横盘震荡 / 下行消耗 / 先破后立",
    "",
    "二、年度时间资产负债表",
    "- 全年维度下，资产型 / 维持型 / 负债型行为的比例变化趋势",
    "- 哪些月份的时间结构最健康，为什么（是外部环境还是内在策略导致的）",
    "- 全年最大的系统性时间浪费是什么——不是某一天的摸鱼，而是持续数月的结构性低效",
    "",
    "三、能力资产盘点",
    "- 这一年我实际积累了哪些可迁移、可复利的能力",
    "- 哪些能力开始显现个人垄断特征（独特背景 × 岗位优势 × 持续投入）",
    "- 哪些投入看起来很多，但没有转化为能力资产（区分学了和会了）",
    "- 我的能力结构中，最大的短板是什么，它是否真的需要补",
    "",
    "四、战略路径审计",
    "- 年初的隐含目标（从行为推断，而非口头声明）vs 年末实际到达的位置",
    "- 全年最关键的1-2个决策是什么（不论好坏），它们如何影响了后续轨迹",
    "- 全年最大的机会成本：因为持续投入A方向，而系统性忽略了哪个可能更高杠杆的B方向",
    "- 是否存在战略漂移——表面上一直在努力，但方向在不知不觉中偏移",
    "",
    "五、行为与心智模式年度画像",
    "- 贯穿全年的核心行为模式（正面+负面各1-2个）",
    "- 全年日记中反复出现的内心叙事主题——我一直在跟自己讲什么故事",
    "- 这些叙事中，哪些在全年尺度上被验证为合理，哪些被证明是限制性信念",
    "- 情绪系统的年度特征：韧性是在增强还是减弱，恢复周期是在缩短还是拉长",
    "",
    "六、下一年战略框架",
    "- 基于以上分析，下一年应该坚持的1-2个核心方向（不是具体任务，是战略主题）",
    "- 应该明确放弃或降低优先级的方向",
    "- 需要建立或强化的1个关键系统/习惯（能产生复利效应的）",
    "- 下一年的核心风险预警：最可能让我脱轨的因素是什么",
    "",
    "七、年度清醒备忘",
    "- 回顾全年，哪些焦虑事后被证明是噪音（白担心了），哪些被证明是真实信号",
    "- 我对自己最大的误判是什么（高估了什么，低估了什么）",
    "- 一句话总结：这一年的我，到底在建设什么",
  ].join("\n");
}

/* ─────────────────────────────────────────────
   Prompt Router
   ───────────────────────────────────────────── */

function getSystemPrompt(period: ReviewPeriod): string {
  switch (period) {
    case "week":
      return WEEKLY_SYSTEM_PROMPT;
    case "month":
      return MONTHLY_SYSTEM_PROMPT;
    case "year":
      return YEARLY_SYSTEM_PROMPT;
  }
}

function buildPrompt(payload: ReviewPayload): string {
  switch (payload.period) {
    case "week":
      return buildWeeklyPrompt(payload);
    case "month":
      return buildMonthlyPrompt(payload);
    case "year":
      return buildYearlyPrompt(payload);
  }
}

/* ─────────────────────────────────────────────
   Utility Functions
   ───────────────────────────────────────────── */

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

function readErrorMessage(value: unknown): string {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return value.error.message;
  }

  return "AI 复盘生成失败。";
}

/**
 * 把上游 OpenAI 兼容的 SSE 流转成纯文本增量流。
 * 客户端按 text/plain 读取，每个 chunk 就是新增的正文片段。
 */
function sseToTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  const extractDelta = (data: string): string => {
    try {
      const parsed = JSON.parse(data) as unknown;
      if (!isRecord(parsed) || !Array.isArray(parsed.choices)) return "";
      const choice = parsed.choices[0];
      if (!isRecord(choice) || !isRecord(choice.delta)) return "";
      return typeof choice.delta.content === "string" ? choice.delta.content : "";
    } catch {
      return "";
    }
  };

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (data === "[DONE]") continue;
            const delta = extractDelta(data);
            if (delta) controller.enqueue(encoder.encode(delta));
          }
        }
      } catch {
        // 上游中断：把已有内容交给客户端，不抛错
      } finally {
        controller.close();
        reader.releaseLock();
      }
    },
  });
}

/* ─────────────────────────────────────────────
   API Handler
   ───────────────────────────────────────────── */

export async function POST(request: NextRequest) {
  const guardError = await guardApiRequest(request);
  if (guardError) return guardError;

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

  const provider = process.env.AI_PROVIDER?.trim().toLowerCase();
  const siliconflowApiKey = process.env.SILICONFLOW_API_KEY?.trim();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const legacySiliconflowKey = !siliconflowApiKey && provider !== "openai" ? openaiApiKey : undefined;
  const effectiveSiliconflowKey = siliconflowApiKey || legacySiliconflowKey;

  if (!effectiveSiliconflowKey && !openaiApiKey) {
    return NextResponse.json(
      {
        available: false,
        message: "AI 复盘是可选功能。请在 .env.local 中配置 SILICONFLOW_API_KEY 或 OPENAI_API_KEY。",
        reflection: null,
      },
      { status: 200 },
    );
  }

  if (provider === "openai" && !openaiApiKey) {
    return NextResponse.json(
      {
        available: false,
        message: "已设置 AI_PROVIDER=openai，但未配置 OPENAI_API_KEY。",
        reflection: null,
      },
      { status: 200 },
    );
  }

  if (provider !== "openai" && !effectiveSiliconflowKey) {
    return NextResponse.json(
      {
        available: false,
        message: "已使用 SiliconFlow 模式，但未配置可用的 API Key。",
        reflection: null,
      },
      { status: 200 },
    );
  }

  const systemPrompt = getSystemPrompt(payload.period);
  const userPrompt = buildPrompt(payload);

  try {
    const useOpenAI = provider === "openai";
    const response = await (useOpenAI
      ? fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            stream: true,
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
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.6,
            stream: true,
          }),
        }));

    if (!response.ok) {
      // 出错时上游返回的是 JSON，照旧解析并透传错误信息
      const json = (await response.json().catch(() => null)) as unknown;
      return NextResponse.json({ message: readErrorMessage(json) }, { status: response.status });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (response.body && contentType.includes("text/event-stream")) {
      // 流式：把 SSE 转成纯文本增量流（客户端边收边渲染）
      return new NextResponse(sseToTextStream(response.body), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // 上游没有按流返回（个别兼容网关）：退回一次性 JSON
    const json = (await response.json()) as unknown;
    const reflection = extractResponseText(json);

    if (!reflection) {
      return NextResponse.json({ message: "模型没有返回有效内容。", reflection: null }, { status: 200 });
    }

    return NextResponse.json({ available: true, reflection });
  } catch {
    return NextResponse.json({ message: "调用 AI 服务失败，请稍后再试。" }, { status: 500 });
  }
}
