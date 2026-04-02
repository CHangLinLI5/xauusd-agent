import { ENV } from "./_core/env";
import { invokeLLM, type Message, type InvokeResult } from "./_core/llm";

/**
 * 自定义 LLM 调用模块
 * 优先使用用户提供的 GPT-5.4 API，如果未配置则 fallback 到内置 LLM
 * v2: 支持 temperature 参数，提升回复多样性
 */

function hasCustomLlm(): boolean {
  return !!(ENV.customLlmApiUrl && ENV.customLlmApiKey);
}

/**
 * 获取完整的 API URL（自动补全 /chat/completions）
 */
function getApiUrl(): string {
  let url = ENV.customLlmApiUrl.replace(/\/+$/, "");
  if (!url.endsWith("/chat/completions")) {
    url += "/chat/completions";
  }
  return url;
}

export async function invokeCustomLLM(params: {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
}): Promise<InvokeResult> {
  if (hasCustomLlm()) {
    const body: Record<string, unknown> = {
      model: ENV.customLlmModel,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: params.maxTokens ?? 4096,
    };

    // Add temperature if specified
    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }

    const apiUrl = getApiUrl();
    console.log(`[CustomLLM] Calling ${apiUrl} with model ${ENV.customLlmModel}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60s timeout
    
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ENV.customLlmApiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[CustomLLM] API error:", response.status, errorText);
        console.log("[CustomLLM] Falling back to built-in LLM");
        return invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
      }

      const result = (await response.json()) as InvokeResult;
      console.log(`[CustomLLM] Success, tokens: ${result.usage?.total_tokens ?? "unknown"}`);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      console.error("[CustomLLM] Fetch error:", err);
      console.log("[CustomLLM] Falling back to built-in LLM");
      return invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
    }
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
  temperature?: number;
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
    const body: Record<string, unknown> = {
      model: ENV.customLlmModel,
      messages: messagesWithImage.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: params.maxTokens ?? 4096,
    };

    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }

    const apiUrl = getApiUrl();
    console.log(`[CustomLLM] Vision call to ${apiUrl}`);
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000); // 90s timeout for vision
    
    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ENV.customLlmApiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[CustomLLM] Vision API error:", response.status, errorText);
        return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
      }

      return (await response.json()) as InvokeResult;
    } catch (err) {
      clearTimeout(timeout);
      console.error("[CustomLLM] Vision fetch error:", err);
      return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
    }
  }

  return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
}

/**
 * 流式调用自定义 LLM，返回 ReadableStream 的 async generator
 * 用于 SSE 端点，逐 token 推送给前端
 */
export async function* invokeCustomLLMStream(params: {
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
}): AsyncGenerator<string, void, unknown> {
  if (hasCustomLlm()) {
    const body: Record<string, unknown> = {
      model: ENV.customLlmModel,
      messages: params.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: params.maxTokens ?? 2048,
      stream: true,
    };

    if (params.temperature !== undefined) {
      body.temperature = params.temperature;
    }

    const apiUrl = getApiUrl();
    console.log(`[CustomLLM] Stream calling ${apiUrl} with model ${ENV.customLlmModel}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ENV.customLlmApiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        console.error("[CustomLLM] Stream API error:", response.status, errorText);
        // Fallback to non-stream
        const result = await invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
        const content = extractContent(result);
        yield content;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              yield delta;
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
      return;
    } catch (err) {
      clearTimeout(timeout);
      console.error("[CustomLLM] Stream fetch error:", err);
      // Fallback to non-stream
      const result = await invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
      const content = extractContent(result);
      yield content;
      return;
    }
  }

  // No custom LLM configured, use built-in (non-stream fallback)
  const result = await invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
  const content = extractContent(result);
  yield content;
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
