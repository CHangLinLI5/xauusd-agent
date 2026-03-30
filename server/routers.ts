import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  createChatSession,
  getUserChatSessions,
  deleteChatSession,
  addChatMessage,
  getSessionMessages,
  createChartAnalysis,
  updateChartAnalysis,
  getUserChartAnalyses,
  getChartAnalysisById,
  createTradingPlan,
  getTodayPlan,
  getUserTradingPlans,
  getConfig,
  setConfig,
  getAllConfigs,
} from "./db";
import { nowChinaISO, todayChinaDate, formatTimeShortCN as fmtTimeCN } from "./timeUtils";
import { invokeCustomLLM, invokeCustomLLMWithImage, extractContent } from "./customLlm";
import {
  XAUUSD_CHAT_SYSTEM_PROMPT,
  CHART_ANALYSIS_PROMPT,
  TRADING_PLAN_PROMPT,
  NEWS_SUMMARY_PROMPT,
  DAILY_BIAS_PROMPT,
} from "./prompts";
import { getMockQuote, getMockDailyBias } from "./mockData";
import { getRealQuote, getRealDailyBias } from "./marketData";
import { buildMarketContext } from "./marketContext";
import { storagePut, storagePutWithBase64, getLocalFileAsDataUrl } from "./storage";
import { getGoldNews } from "./newsService";
import { getEconomicCalendar } from "./calendarService";
import { TRPCError } from "@trpc/server";
import type { Message } from "./_core/llm";

// Temporary in-memory cache for base64 data URLs (used between upload and analyze)
const chartDataUrlCache = new Map<number, string>();

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN" });
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ========== AI Chat ==========
  chat: router({
    sessions: protectedProcedure.query(({ ctx }) => getUserChatSessions(ctx.user.id)),

    createSession: protectedProcedure
      .input(z.object({ title: z.string().optional() }))
      .mutation(({ ctx, input }) => createChatSession(ctx.user.id, input.title)),

    deleteSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .mutation(({ ctx, input }) => deleteChatSession(input.sessionId, ctx.user.id)),

    messages: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(({ input }) => getSessionMessages(input.sessionId)),

    send: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          content: z.string().min(1).max(5000),
        })
      )
      .mutation(async ({ ctx, input }) => {
        await addChatMessage(input.sessionId, "user", input.content);
        const history = await getSessionMessages(input.sessionId);

        // 获取实时行情数据注入到系统提示词中
        const marketContext = await buildMarketContext();

        // 构建增强的系统提示词：基础提示 + 实时数据 + 对话感知指令
        const conversationCount = history.filter((m) => m.role === "user").length;
        const now = new Date();
        const timeContext = `\n\n---\n**当前时间**: ${nowChinaISO()} (北京时间)\n**本次对话轮次**: 第${conversationCount}轮\n**对话指引**: ${
          conversationCount === 1
            ? "这是用户的第一个问题，给出全面但简洁的分析。"
            : conversationCount <= 3
              ? "用户已经有了基础了解，聚焦于新的角度和变化，不要重复之前已经分析过的内容。如果市场数据没变，从不同维度（形态、时间、情绪、资金流）切入。"
              : "深度对话阶段，用户对市场已有充分了解。只回答具体问题，极度简洁，像交易员之间的对话。避免任何重复内容。"
        }`;

        const systemPrompt = XAUUSD_CHAT_SYSTEM_PROMPT + marketContext + timeContext;

        const messages: Message[] = [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
        ];

        // 使用适度的 temperature 提升回复多样性
        const result = await invokeCustomLLM({
          messages,
          maxTokens: 4096,
          temperature: 0.7,
        });
        const assistantContent = extractContent(result);
        await addChatMessage(input.sessionId, "assistant", assistantContent);
        return { content: assistantContent };
      }),
  }),

  // ========== Chart Analysis ==========
  chart: router({
    list: protectedProcedure.query(({ ctx }) => getUserChartAnalyses(ctx.user.id)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getChartAnalysisById(input.id)),

    upload: protectedProcedure
      .input(
        z.object({
          imageBase64: z.string(),
          mimeType: z.string().default("image/png"),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const buffer = Buffer.from(input.imageBase64, "base64");
        const ext = input.mimeType.includes("png") ? "png" : "jpg";
        const key = `charts/${ctx.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { url, dataUrl } = await storagePutWithBase64(key, buffer, input.mimeType);
        const { id } = await createChartAnalysis(ctx.user.id, url, key);
        // Cache the base64 data URL in memory for the upcoming analyze call
        chartDataUrlCache.set(id, dataUrl);
        // Auto-expire cache after 10 minutes
        setTimeout(() => chartDataUrlCache.delete(id), 10 * 60 * 1000);
        return { id, imageUrl: url };
      }),

    analyze: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const analysis = await getChartAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        await updateChartAnalysis(input.id, { status: "analyzing" });

        // Get the image URL for LLM vision analysis
        // Priority: in-memory cached data URL > reconstruct from local file > original URL
        let imageUrlForLlm = analysis.imageUrl;

        // Check in-memory cache first (from recent upload)
        const cachedDataUrl = chartDataUrlCache.get(input.id);
        if (cachedDataUrl) {
          imageUrlForLlm = cachedDataUrl;
          chartDataUrlCache.delete(input.id); // Clean up after use
        } else if (imageUrlForLlm.startsWith("/uploads/")) {
          const mimeType = imageUrlForLlm.endsWith(".png") ? "image/png" : "image/jpeg";
          const dataUrl = getLocalFileAsDataUrl(analysis.imageKey, mimeType);
          if (dataUrl) {
            imageUrlForLlm = dataUrl;
          }
        }

        console.log(`[ChartAnalysis] Analyzing id=${input.id}, imageUrl type: ${imageUrlForLlm.startsWith("data:") ? "base64" : "url"}, length: ${imageUrlForLlm.length}`);

        const messages: Message[] = [
          { role: "system", content: CHART_ANALYSIS_PROMPT },
          { role: "user", content: "请分析这张XAUUSD交易图表，识别所有关键形态、支撑阻力位和交易信号。" },
        ];

        try {
          const result = await invokeCustomLLMWithImage({
            messages,
            imageUrl: imageUrlForLlm,
            maxTokens: 4096,
            temperature: 0.5,
          });
          const content = extractContent(result);
          await updateChartAnalysis(input.id, { analysisResult: content, status: "completed" });
          return { analysisResult: content };
        } catch (error) {
          console.error("[ChartAnalysis] Analysis failed:", error);
          const errMsg = `分析失败: ${error instanceof Error ? error.message : "未知错误"}。请检查 LLM API 是否支持图片分析（Vision）功能。`;
          await updateChartAnalysis(input.id, { analysisResult: errMsg, status: "failed" });
          return { analysisResult: errMsg };
        }
      }),
  }),

  // ========== Trading Plan ==========
  plan: router({
    today: protectedProcedure.query(async ({ ctx }) => {
      const today = todayChinaDate();
      return getTodayPlan(ctx.user.id, today);
    }),

    list: protectedProcedure.query(({ ctx }) => getUserTradingPlans(ctx.user.id)),

    generate: protectedProcedure.mutation(async ({ ctx }) => {
      const today = todayChinaDate();

      // 获取完整市场数据
      let quote;
      let biasData;
      try {
        quote = await getRealQuote();
      } catch {
        quote = getMockQuote();
      }
      try {
        biasData = await getRealDailyBias();
      } catch {
        biasData = getMockDailyBias();
      }

      // 使用动态经济日历
      const events = getEconomicCalendar();
      const eventsSummary = events
        .map((e) => {
          
          const timeStrCN = fmtTimeCN(e.time);
          return `- ${timeStrCN} 北京 ${e.name}（${e.impactLabel}影响）${e.forecast ? `预期: ${e.forecast}` : ""} ${e.previous ? `前值: ${e.previous}` : ""}`;
        })
        .join("\n");

      // 构建丰富的市场上下文
      const marketInfo = [
        `## 当前市场数据（${nowChinaISO()} 北京时间）`,
        "",
        `**XAUUSD 现货价格**: ${quote.price}`,
        `**今日开盘**: ${quote.open} | **最高**: ${quote.high} | **最低**: ${quote.low}`,
        `**涨跌**: ${quote.change >= 0 ? "+" : ""}${quote.change} (${quote.change >= 0 ? "+" : ""}${quote.changePercent}%)`,
        "",
        `**今日Bias**: ${biasData.biasLabel}（置信度: ${biasData.confidence}）`,
        `**风控状态**: ${biasData.riskLabel}`,
        `**AI摘要**: ${biasData.summary}`,
        "",
        "**关键位**:",
        `- R2: ${biasData.keyLevels.resistance2} | R1: ${biasData.keyLevels.resistance1}`,
        `- 箱体: ${biasData.keyLevels.boxBottom} - ${biasData.keyLevels.boxTop}`,
        `- S1: ${biasData.keyLevels.support1} | S2: ${biasData.keyLevels.support2}`,
        "",
        "**盘面状态**:",
        `- 亚盘: ${biasData.sessions.asia} | 欧盘: ${biasData.sessions.europe} | 美盘: ${biasData.sessions.us}`,
        "",
        "**本周经济日历**:",
        eventsSummary || "暂无重要数据",
      ].join("\n");

      const messages: Message[] = [
        { role: "system", content: TRADING_PLAN_PROMPT },
        {
          role: "user",
          content: `请生成今日（${today}）的XAUUSD日内交易计划。\n\n${marketInfo}\n\n请基于以上完整数据生成可执行的交易计划，所有价格必须是具体数字。`,
        },
      ];

      const result = await invokeCustomLLM({
        messages,
        maxTokens: 4096,
        temperature: 0.6,
      });
      const content = extractContent(result);

      // 尝试从内容中提取bias信息
      let detectedBias: string | undefined;
      let detectedMarketType: string | undefined;
      if (content.includes("偏多") || content.includes("多头")) detectedBias = "bullish";
      else if (content.includes("偏空") || content.includes("空头")) detectedBias = "bearish";
      else if (content.includes("震荡")) detectedBias = "ranging";

      if (content.includes("单边")) detectedMarketType = "单边";
      else if (content.includes("震荡")) detectedMarketType = "震荡";
      else detectedMarketType = "待定";

      const { id } = await createTradingPlan(
        ctx.user.id,
        today,
        content,
        detectedMarketType,
        detectedBias ?? biasData.bias
      );
      return { id, content, planDate: today, marketType: detectedMarketType, bias: detectedBias ?? biasData.bias };
    }),
  }),

  // ========== Market Data ==========
  market: router({
    quote: publicProcedure.query(async () => {
      try {
        return await getRealQuote();
      } catch (error) {
        console.error("[Market] Real quote failed, using mock:", error);
        return getMockQuote();
      }
    }),

    news: publicProcedure.query(async () => {
      try {
        return await getGoldNews();
      } catch (error) {
        console.error("[Market] News fetch failed:", error);
        const { getMockNews } = await import("./mockData");
        return getMockNews();
      }
    }),

    calendar: publicProcedure.query(() => {
      return getEconomicCalendar();
    }),

    dailyBias: publicProcedure.query(async () => {
      try {
        return await getRealDailyBias();
      } catch (error) {
        console.error("[Market] Real bias failed, using mock:", error);
        return getMockDailyBias();
      }
    }),

    generateBias: protectedProcedure.mutation(async () => {
      let quote;
      try {
        quote = await getRealQuote();
      } catch {
        quote = getMockQuote();
      }
      const events = getEconomicCalendar();
      const highImpactCount = events.filter((e) => e.impact === "high").length;
      const messages: Message[] = [
        { role: "system", content: DAILY_BIAS_PROMPT },
        {
          role: "user",
          content: `当前XAUUSD价格：${quote.price}，今日涨跌：${quote.change}(${quote.changePercent}%)。\n今日有${highImpactCount}个高影响数据。\n请给出今日市场偏向判断。`,
        },
      ];
      const result = await invokeCustomLLM({ messages, maxTokens: 1024, temperature: 0.3 });
      const content = extractContent(result);
      try {
        return JSON.parse(content);
      } catch {
        return getMockDailyBias();
      }
    }),

    newsSummary: protectedProcedure
      .input(z.object({ newsId: z.string() }))
      .mutation(async ({ input }) => {
        // Try real news first, then mock
        let news;
        try {
          const allNews = await getGoldNews();
          news = allNews.find((n) => n.id === input.newsId);
        } catch {
          // ignore
        }
        if (!news) {
          const { getMockNews } = await import("./mockData");
          news = getMockNews().find((n) => n.id === input.newsId);
        }
        if (!news) throw new TRPCError({ code: "NOT_FOUND" });
        const messages: Message[] = [
          { role: "system", content: NEWS_SUMMARY_PROMPT },
          { role: "user", content: `新闻标题：${news.title}\n新闻内容：${news.content}` },
        ];
        const result = await invokeCustomLLM({ messages, maxTokens: 1024, temperature: 0.5 });
        return { summary: extractContent(result) };
      }),
  }),

  // ========== Admin Config ==========
  config: router({
    getAll: adminProcedure.query(() => getAllConfigs()),
    get: adminProcedure
      .input(z.object({ key: z.string() }))
      .query(({ input }) => getConfig(input.key)),
    set: adminProcedure
      .input(z.object({ key: z.string(), value: z.string(), description: z.string().optional() }))
      .mutation(({ input }) => setConfig(input.key, input.value, input.description)),
  }),
});

export type AppRouter = typeof appRouter;

