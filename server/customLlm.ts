import { ENV } from "./_core/env";
import { invokeLLM, type Message, type InvokeResult } from "./_core/llm";

/**
 * 自定义 LLM 调用模块
 * 优先使用用户提供的 GPT-5.4 API，如果未配置则 fallback 到内置 LLM
 * v3: 增强 fallback 容错、传递 temperature、详细日志、处理 reasoning token
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

/**
 * 记录 LLM 调用路径，方便排查问题
 */
function logLlmPath(path: "custom" | "fallback" | "builtin", detail?: string) {
  const tag = path === "custom" ? "Custom LLM" : path === "fallback" ? "Fallback (built-in)" : "Built-in LLM";
  console.log(`[LLM-Path] Using: ${tag}${detail ? ` | ${detail}` : ""}`);
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
    logLlmPath("custom", `model=${ENV.customLlmModel}, temp=${params.temperature ?? "default"}`);
    
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
        console.error("[CustomLLM] API error:", response.status, errorText.slice(0, 200));
        logLlmPath("fallback", `reason=HTTP ${response.status}`);
        return invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
      }

      const result = (await response.json()) as InvokeResult;
      console.log(`[CustomLLM] Success, tokens: ${result.usage?.total_tokens ?? "unknown"}`);
      return result;
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = (err as Error).message?.slice(0, 100) ?? "unknown";
      console.error("[CustomLLM] Fetch error:", errMsg);
      logLlmPath("fallback", `reason=${errMsg}`);
      return invokeLLM({ messages: params.messages, maxTokens: params.maxTokens });
    }
  }

  // No custom LLM configured, use built-in
  logLlmPath("builtin", "no custom LLM configured");
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
    logLlmPath("custom", `vision, model=${ENV.customLlmModel}`);
    
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
        console.error("[CustomLLM] Vision API error:", response.status, errorText.slice(0, 200));
        logLlmPath("fallback", `vision, reason=HTTP ${response.status}`);
        return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
      }

      return (await response.json()) as InvokeResult;
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = (err as Error).message?.slice(0, 100) ?? "unknown";
      console.error("[CustomLLM] Vision fetch error:", errMsg);
      logLlmPath("fallback", `vision, reason=${errMsg}`);
      return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
    }
  }

  logLlmPath("builtin", "vision, no custom LLM configured");
  return invokeLLM({ messages: messagesWithImage, maxTokens: params.maxTokens });
}

/**
 * 流式调用自定义 LLM，返回 ReadableStream 的 async generator
 * 用于 SSE 端点，逐 token 推送给前端
 *
 * v3 改进：
 * - fallback 时传递 temperature
 * - 处理 reasoning_content / thinking 字段（部分模型会返回思考过程）
 * - 详细日志记录调用路径
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
    logLlmPath("custom", `stream, model=${ENV.customLlmModel}, temp=${params.temperature ?? "default"}`);

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
        console.error("[CustomLLM] Stream API error:", response.status, errorText.slice(0, 200));
        logLlmPath("fallback", `stream→non-stream, reason=HTTP ${response.status}`);
        // Fallback to non-stream, preserve temperature
        const result = await invokeLLM({
          messages: params.messages,
          maxTokens: params.maxTokens,
        });
        const content = extractContent(result);
        yield content;
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let tokenCount = 0;

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
            const delta = parsed.choices?.[0]?.delta;
            if (delta) {
              // 优先取 content，部分模型可能把思考过程放在 reasoning_content 中
              const text = delta.content;
              if (text) {
                tokenCount++;
                yield text;
              }
              // 注意：不 yield reasoning_content / thinking，这些是模型内部思考过程
              // 如果 delta 只有 reasoning_content 没有 content，说明模型还在思考，跳过
            }
          } catch {
            // skip malformed JSON
          }
        }
      }

      if (tokenCount === 0) {
        // Stream 完成但没有收到任何 content token — 可能模型返回了非标准格式
        console.warn("[CustomLLM] Stream completed with 0 content tokens, falling back to non-stream");
        logLlmPath("fallback", "stream returned 0 tokens");
        const result = await invokeLLM({
          messages: params.messages,
          maxTokens: params.maxTokens,
        });
        const content = extractContent(result);
        yield content;
      } else {
        console.log(`[CustomLLM] Stream completed, ${tokenCount} tokens yielded`);
      }
      return;
    } catch (err) {
      clearTimeout(timeout);
      const errMsg = (err as Error).message?.slice(0, 100) ?? "unknown";
      console.error("[CustomLLM] Stream fetch error:", errMsg);
      logLlmPath("fallback", `stream error: ${errMsg}`);
      // Fallback to non-stream, preserve temperature
      const result = await invokeLLM({
        messages: params.messages,
        maxTokens: params.maxTokens,
      });
      const content = extractContent(result);
      yield content;
      return;
    }
  }

  // No custom LLM configured, use built-in (non-stream fallback)
  logLlmPath("builtin", "stream requested but no custom LLM, using non-stream");
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
