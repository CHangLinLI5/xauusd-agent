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
import { invokeCustomLLM, invokeCustomLLMWithImage, extractContent } from "./customLlm";
import {
  XAUUSD_CHAT_SYSTEM_PROMPT,
  CHART_ANALYSIS_PROMPT,
  TRADING_PLAN_PROMPT,
  NEWS_SUMMARY_PROMPT,
  DAILY_BIAS_PROMPT,
} from "./prompts";
import { getMockNews, getMockEconomicCalendar, getMockQuote, getMockDailyBias } from "./mockData";
import { getRealQuote, getRealDailyBias } from "./marketData";
import { buildMarketContext } from "./marketContext";
import { storagePut } from "./storage";
import { TRPCError } from "@trpc/server";
import type { Message } from "./_core/llm";

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
        const systemPrompt = XAUUSD_CHAT_SYSTEM_PROMPT + marketContext;

        const messages: Message[] = [
          { role: "system", content: systemPrompt },
          ...history.map((m) => ({
            role: m.role as "system" | "user" | "assistant",
            content: m.content,
          })),
        ];
        const result = await invokeCustomLLM({ messages, maxTokens: 4096 });
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
        const { url } = await storagePut(key, buffer, input.mimeType);
        const { id } = await createChartAnalysis(ctx.user.id, url, key);
        analyzeChart(id, url).catch((err) =>
          console.error("[ChartAnalysis] Background analysis failed:", err)
        );
        return { id, imageUrl: url };
      }),

    analyze: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const analysis = await getChartAnalysisById(input.id);
        if (!analysis) throw new TRPCError({ code: "NOT_FOUND" });
        await updateChartAnalysis(input.id, { status: "analyzing" });
        const messages: Message[] = [
          { role: "system", content: CHART_ANALYSIS_PROMPT },
          { role: "user", content: "请分析这张XAUUSD交易图表，识别所有关键形态、支撑阻力位和交易信号。" },
        ];
        const result = await invokeCustomLLMWithImage({
          messages,
          imageUrl: analysis.imageUrl,
          maxTokens: 4096,
        });
        const content = extractContent(result);
        await updateChartAnalysis(input.id, { analysisResult: content, status: "completed" });
        return { analysisResult: content };
      }),
  }),

  // ========== Trading Plan ==========
  plan: router({
    today: protectedProcedure.query(async ({ ctx }) => {
      const today = new Date().toISOString().split("T")[0];
      return getTodayPlan(ctx.user.id, today!);
    }),

    list: protectedProcedure.query(({ ctx }) => getUserTradingPlans(ctx.user.id)),

    generate: protectedProcedure.mutation(async ({ ctx }) => {
      const today = new Date().toISOString().split("T")[0]!;
      let quote;
      try {
        quote = await getRealQuote();
      } catch {
        quote = getMockQuote();
      }
      const events = getMockEconomicCalendar();
      const eventsSummary = events
        .map((e) => `${e.time.split("T")[1]?.slice(0, 5)} - ${e.name} (${e.importance})`)
        .join("\n");
      const messages: Message[] = [
        { role: "system", content: TRADING_PLAN_PROMPT },
        {
          role: "user",
          content: `请生成今日（${today}）的XAUUSD交易计划。\n\n当前市场信息：\n- XAUUSD 当前价格：${quote.price}\n- 今日开盘：${quote.open}\n- 今日最高：${quote.high}\n- 今日最低：${quote.low}\n- 涨跌：${quote.change} (${quote.changePercent}%)\n\n今日重要经济数据：\n${eventsSummary}\n\n请根据以上信息生成完整的交易计划。`,
        },
      ];
      const result = await invokeCustomLLM({ messages, maxTokens: 4096 });
      const content = extractContent(result);
      const { id } = await createTradingPlan(ctx.user.id, today, content);
      return { id, content, planDate: today };
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
    news: publicProcedure.query(() => getMockNews()),
    calendar: publicProcedure.query(() => getMockEconomicCalendar()),
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
      const events = getMockEconomicCalendar();
      const messages: Message[] = [
        { role: "system", content: DAILY_BIAS_PROMPT },
        {
          role: "user",
          content: `当前XAUUSD价格：${quote.price}，今日涨跌：${quote.change}(${quote.changePercent}%)。\n今日有${events.filter((e) => e.importance === "high").length}个高影响数据。\n请给出今日市场偏向判断。`,
        },
      ];
      const result = await invokeCustomLLM({ messages, maxTokens: 1024 });
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
        const news = getMockNews().find((n) => n.id === input.newsId);
        if (!news) throw new TRPCError({ code: "NOT_FOUND" });
        const messages: Message[] = [
          { role: "system", content: NEWS_SUMMARY_PROMPT },
          { role: "user", content: `新闻标题：${news.title}\n新闻内容：${news.content}` },
        ];
        const result = await invokeCustomLLM({ messages, maxTokens: 1024 });
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

// Background chart analysis
async function analyzeChart(analysisId: number, imageUrl: string) {
  try {
    await updateChartAnalysis(analysisId, { status: "analyzing" });
    const messages: Message[] = [
      { role: "system", content: CHART_ANALYSIS_PROMPT },
      { role: "user", content: "请分析这张XAUUSD交易图表，识别所有关键形态、支撑阻力位和交易信号。" },
    ];
    const result = await invokeCustomLLMWithImage({ messages, imageUrl, maxTokens: 4096 });
    const content = extractContent(result);
    await updateChartAnalysis(analysisId, { analysisResult: content, status: "completed" });
  } catch (error) {
    console.error("[ChartAnalysis] Failed:", error);
    await updateChartAnalysis(analysisId, { status: "failed", analysisResult: "分析失败，请重试" });
  }
}
