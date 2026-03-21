/**
 * In-memory fallback store for when DATABASE_URL is not configured.
 * Provides the same interface as db.ts functions but stores data in memory.
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
  // Remove associated messages
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
  // Update session timestamp
  const session = sessions.find((s) => s.id === sessionId);
  if (session) session.updatedAt = new Date();
}

export function memGetSessionMessages(sessionId: number) {
  return messages
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
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
