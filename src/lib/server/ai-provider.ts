/**
 * 大模型服务商选择（仅服务端使用）。所有 /api/* 的 AI 接口都经这里发请求，
 * 以后换服务商或模型只改这一处。
 *
 * 优先级：
 * 1. AI_PROVIDER 显式指定（deepseek | siliconflow | openai）
 * 2. 配置了 DEEPSEEK_API_KEY → DeepSeek 官方接口（默认）
 * 3. 旧配置兼容：SILICONFLOW_API_KEY（或未指定服务商时的 OPENAI_API_KEY）→ SiliconFlow
 * 4. AI_PROVIDER=openai 且配置了 OPENAI_API_KEY → OpenAI
 *
 * DeepSeek 默认模型 deepseek-v4-pro（官方旗舰）；可用 DEEPSEEK_MODEL 覆盖，
 * 例如 deepseek-flash（DeepSeek-V4.1-Flash，更快更便宜）。
 */

export type AiProviderName = "deepseek" | "siliconflow" | "openai";

export interface AiProvider {
  name: AiProviderName;
  url: string;
  apiKey: string;
  model: string;
}

export function resolveAiProvider(): AiProvider | null {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const siliconflowKey = process.env.SILICONFLOW_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  const deepseek = (): AiProvider | null =>
    deepseekKey
      ? {
          name: "deepseek",
          url: "https://api.deepseek.com/chat/completions",
          apiKey: deepseekKey,
          model: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro",
        }
      : null;

  const siliconflow = (): AiProvider | null => {
    // 历史兼容：未指定服务商时，OPENAI_API_KEY 曾被当作 SiliconFlow 的密钥使用
    const key = siliconflowKey || (explicit !== "openai" ? openaiKey : undefined);
    return key
      ? {
          name: "siliconflow",
          url: "https://api.siliconflow.cn/v1/chat/completions",
          apiKey: key,
          model: process.env.SILICONFLOW_MODEL?.trim() || "deepseek-ai/DeepSeek-V3",
        }
      : null;
  };

  const openai = (): AiProvider | null =>
    openaiKey
      ? {
          name: "openai",
          url: "https://api.openai.com/v1/chat/completions",
          apiKey: openaiKey,
          model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        }
      : null;

  if (explicit === "deepseek") return deepseek();
  if (explicit === "siliconflow") return siliconflow();
  if (explicit === "openai") return openai();
  return deepseek() ?? siliconflow();
}

/** AI 未配置时给前端的提示文案 */
export const AI_NOT_CONFIGURED_MESSAGE = "AI 功能未配置。请在环境变量中设置 DEEPSEEK_API_KEY（DeepSeek 官方）。";

export interface ChatOptions {
  system: string;
  user: string;
  temperature: number;
  stream?: boolean;
  /**
   * 要求返回 JSON。只有 OpenAI 会加 response_format；DeepSeek / SiliconFlow 不强制，
   * 由各接口从回答文本里提取 JSON（兼容所有模型）。
   */
  json?: boolean;
}

/** 发一次 OpenAI 兼容的 chat/completions 请求，返回原始 Response */
export function chatCompletion(provider: AiProvider, opts: ChatOptions): Promise<Response> {
  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    temperature: opts.temperature,
  };
  if (opts.stream) body.stream = true;
  if (opts.json && provider.name === "openai") body.response_format = { type: "json_object" };

  return fetch(provider.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });
}
