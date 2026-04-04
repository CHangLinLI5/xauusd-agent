/**
 * 流式聊天 SSE 端点
 * 绕过 tRPC 直接用 Express 实现 Server-Sent Events
 */

import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { sdk } from "./_core/sdk";
import { COOKIE_NAME } from "@shared/const";
import { addChatMessage, getSessionMessages, createChatSession, getUserChatSessions } from "./db";
import { buildMarketContext } from "./marketContext";
import { nowChinaISO } from "./timeUtils";
import { XAUUSD_CHAT_SYSTEM_PROMPT } from "./prompts";
import { invokeCustomLLMStream } from "./customLlm";
import type { Message } from "./_core/llm";
import type { User } from "../drizzle/schema";

/**
 * 从请求中提取已认证用户
 */
async function getAuthUser(req: Request): Promise<User | null> {
  try {
    return await sdk.authenticateRequest(req);
  } catch {
    // In production, do not allow JWT-only fallback
    const allowFallback =
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_JWT_FALLBACK === "true";

    if (!allowFallback) return null;

    // Dev-only fallback: try session JWT directly (with limited 'user' role)
    try {
      const cookies = parseCookieHeader(req.headers.cookie || "");
      const sessionCookie = cookies[COOKIE_NAME];
      if (sessionCookie) {
        const session = await sdk.verifySession(sessionCookie);
        if (session) {
          return {
            id: 1,
            openId: session.openId,
            name: session.name || "Dev User",
            email: null,
            loginMethod: "dev",
            role: "user",
            passwordHash: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSignedIn: new Date(),
          } as User;
        }
      }
    } catch {
      // silent
    }
    return null;
  }
}

export function registerStreamRoutes(app: Express) {
  /**
   * POST /api/chat/stream
   * Body: { sessionId: number, content: string }
   * Response: SSE stream with tokens
   */
  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    const user = await getAuthUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { sessionId, content } = req.body;
    if (!sessionId || !content) {
      res.status(400).json({ error: "Missing sessionId or content" });
      return;
    }

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    try {
      // Save user message
      await addChatMessage(sessionId, "user", content);
      const history = await getSessionMessages(sessionId);

      // Build enhanced system prompt
      const marketContext = await buildMarketContext();
      const conversationCount = history.filter((m) => m.role === "user").length;
      const timeContext = `\n\n---\n当前北京时间: ${nowChinaISO()}\n对话第${conversationCount}轮。${conversationCount >= 3 ? "聊了好几轮了，别重复前面说过的，直接回答问题。" : ""}`;
      const systemPrompt = XAUUSD_CHAT_SYSTEM_PROMPT + marketContext + timeContext;

      const messages: Message[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({
          role: m.role as "system" | "user" | "assistant",
          content: m.content,
        })),
      ];

      // Stream tokens
      let fullContent = "";
      const stream = invokeCustomLLMStream({
        messages,
        maxTokens: 2048,
        temperature: 0.8,
      });

      for await (const token of stream) {
        fullContent += token;
        // Send SSE event
        res.write(`data: ${JSON.stringify({ token })}\n\n`);
      }

      // Filter out thinking/reasoning text that may leak from LLM
      const cleanedContent = fullContent
        .replace(/^Crafting trading advice[.\s]*/i, "")
        .replace(/^Analyzing the (market|data|chart|price)[.\s]*/i, "")
        .replace(/^Let me (think|analyze|consider|review)[.\s]*/i, "")
        .replace(/^Thinking about[.\s]*/i, "")
        .replace(/^Processing[.\s]*/i, "")
        .replace(/^Generating[.\s]*/i, "")
        .replace(/^Formulating[.\s]*/i, "")
        .replace(/^Preparing[.\s]*/i, "")
        .trim();

      // Save complete assistant message (cleaned)
      await addChatMessage(sessionId, "assistant", cleanedContent);

      // Send done event with cleaned content
      res.write(`data: ${JSON.stringify({ done: true, content: cleanedContent })}\n\n`);
      res.end();
    } catch (error) {
      console.error("[StreamChat] Error:", error);
      res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
      res.end();
    }
  });
}
