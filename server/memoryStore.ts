/**
 * In-memory fallback store v2
 *
 * v2 改进：
 * - 新增图表分析（Chart Analysis）内存存储
 * - 支持无数据库环境下的完整功能降级
 */

// ========== Chat Sessions ==========

interface MemorySession {
  id: number;
  userId: number;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface MemoryMessage {
  id: number;
  sessionId: number;
  role: "system" | "user" | "assistant";
  content: string;
  createdAt: Date;
}

let sessionIdCounter = 1;
let messageIdCounter = 1;
const sessions: MemorySession[] = [];
const messages: MemoryMessage[] = [];

export function memCreateChatSession(userId: number, title?: string) {
  const session: MemorySession = {
    id: sessionIdCounter++,
    userId,
    title: title ?? "新对话",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  sessions.push(session);
  return { id: session.id };
}

export function memGetUserChatSessions(userId: number) {
  return sessions
    .filter((s) => s.userId === userId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export function memDeleteChatSession(sessionId: number, userId: number) {
  const idx = sessions.findIndex((s) => s.id === sessionId && s.userId === userId);
  if (idx >= 0) sessions.splice(idx, 1);
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sessionId === sessionId) {
      messages.splice(i, 1);
    }
  }
}

export function memAddChatMessage(sessionId: number, role: "system" | "user" | "assistant", content: string) {
  const msg: MemoryMessage = {
    id: messageIdCounter++,
    sessionId,
    role,
    content,
    createdAt: new Date(),
  };
  messages.push(msg);
  const session = sessions.find((s) => s.id === sessionId);
  if (session) session.updatedAt = new Date();
}

export function memGetSessionMessages(sessionId: number) {
  return messages
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// ========== Chart Analyses (NEW in v2) ==========

interface MemoryChartAnalysis {
  id: number;
  userId: number;
  imageUrl: string;
  imageKey: string;
  analysisResult: string | null;
  timeframe: string | null;
  patterns: string | null;
  keyLevels: string | null;
  status: "pending" | "analyzing" | "completed" | "failed";
  createdAt: Date;
  updatedAt: Date;
}

let chartIdCounter = 1;
const chartAnalyses: MemoryChartAnalysis[] = [];

export function memCreateChartAnalysis(userId: number, imageUrl: string, imageKey: string) {
  const analysis: MemoryChartAnalysis = {
    id: chartIdCounter++,
    userId,
    imageUrl,
    imageKey,
    analysisResult: null,
    timeframe: null,
    patterns: null,
    keyLevels: null,
    status: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  chartAnalyses.push(analysis);
  return { id: analysis.id };
}

export function memUpdateChartAnalysis(
  id: number,
  data: {
    analysisResult?: string;
    timeframe?: string;
    patterns?: string;
    keyLevels?: string;
    status?: "pending" | "analyzing" | "completed" | "failed";
  }
) {
  const analysis = chartAnalyses.find((a) => a.id === id);
  if (analysis) {
    if (data.analysisResult !== undefined) analysis.analysisResult = data.analysisResult;
    if (data.timeframe !== undefined) analysis.timeframe = data.timeframe;
    if (data.patterns !== undefined) analysis.patterns = data.patterns;
    if (data.keyLevels !== undefined) analysis.keyLevels = data.keyLevels;
    if (data.status !== undefined) analysis.status = data.status;
    analysis.updatedAt = new Date();
  }
}

export function memGetUserChartAnalyses(userId: number) {
  return chartAnalyses
    .filter((a) => a.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function memGetChartAnalysisById(id: number) {
  return chartAnalyses.find((a) => a.id === id) ?? undefined;
}

// ========== Trading Plans ==========

interface MemoryTradingPlan {
  id: number;
  userId: number;
  planDate: string;
  content: string;
  marketType: string | null;
  bias: string | null;
  createdAt: Date;
}

let planIdCounter = 1;
const tradingPlans: MemoryTradingPlan[] = [];

export function memCreateTradingPlan(
  userId: number,
  planDate: string,
  content: string,
  marketType?: string,
  bias?: string
) {
  const plan: MemoryTradingPlan = {
    id: planIdCounter++,
    userId,
    planDate,
    content,
    marketType: marketType ?? null,
    bias: bias ?? null,
    createdAt: new Date(),
  };
  tradingPlans.push(plan);
  return { id: plan.id };
}

export function memGetTodayPlan(userId: number, planDate: string) {
  const plans = tradingPlans
    .filter((p) => p.userId === userId && p.planDate === planDate)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return plans.length > 0 ? plans[0] : undefined;
}

export function memGetUserTradingPlans(userId: number) {
  return tradingPlans
    .filter((p) => p.userId === userId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

// ========== System Config (in-memory) ==========

const configStore = new Map<string, { configKey: string; configValue: string; description?: string }>();

export function memGetConfig(key: string): string | undefined {
  return configStore.get(key)?.configValue;
}

export function memSetConfig(key: string, value: string, description?: string) {
  configStore.set(key, { configKey: key, configValue: value, description });
}

export function memGetAllConfigs() {
  return Array.from(configStore.values());
}
