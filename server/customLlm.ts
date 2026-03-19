import { ENV } from "./_core/env";
import { invokeLLM, type Message, type InvokeResult } from "./_core/llm";

/**
 * 自定义 LLM 调用模块
 * 优先使用用户提供的 GPT-5.4 API，如果未配置则 fallback 到内置 LLM
 */

function hasCustomLlm(): boolean {
  return !!(ENV.customLlmApiUrl && ENV.customLlmApiKey);
}

export async function invokeCustomLLM(params: {
  messages: Message[];
  maxTokens?: number;
}): Promise<InvokeResult> {
  if (hasCustomLlm()) {
    const response = await fetch(ENV.customLlmApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.customLlmApiKey}`,
      },
      body: JSON.stringify({
        model: ENV.customLlmModel,
        messages: params.messages.map((m) => {
          if (typeof m.content === "string") {
            return { role: m.role, content: m.content };
          }
          return { role: m.role, content: m.content };
        }),
        max_tokens: params.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CustomLLM] API error:", response.status, errorText);
      // Fallback to built-in LLM
      console.log("[CustomLLM] Falling back to built-in LLM");
      return invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
    }

    return (await response.json()) as InvokeResult;
  }

  // No custom LLM configured, use built-in
  return invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
}

/**
 * 调用自定义 LLM 并支持图片输入（用于图表分析）
 */
export async function invokeCustomLLMWithImage(params: {
  messages: Message[];
  imageUrl: string;
  maxTokens?: number;
}): Promise<InvokeResult> {
  const messagesWithImage: Message[] = params.messages.map((m, i) => {
    if (i === params.messages.length - 1 && m.role === "user") {
      return {
        role: m.role as "user",
        content: [
          { type: "text" as const, text: typeof m.content === "string" ? m.content : "" },
          {
            type: "image_url" as const,
            image_url: { url: params.imageUrl, detail: "high" as const },
          },
        ],
      };
    }
    return m;
  });

  if (hasCustomLlm()) {
    const response = await fetch(ENV.customLlmApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.customLlmApiKey}`,
      },
      body: JSON.stringify({
        model: ENV.customLlmModel,
        messages: messagesWithImage.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: params.maxTokens ?? 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[CustomLLM] Vision API error:", response.status, errorText);
      return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
    }

    return (await response.json()) as InvokeResult;
  }

  return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
}

/**
 * 提取 LLM 响应文本
 */
export function extractContent(result: InvokeResult): string {
  const content = result.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c) => c.type === "text")
      .map((c) => (c as { type: "text"; text: string }).text)
      .join("");
  }
  return "";
}
