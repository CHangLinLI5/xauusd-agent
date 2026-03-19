import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  chatSessions,
  chatMessages,
  chartAnalyses,
  tradingPlans,
  systemConfig,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ========== Chat Sessions ==========

export async function createChatSession(userId: number, title?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chatSessions).values({
    userId,
    title: title ?? "新对话",
  });
  return { id: Number(result[0].insertId) };
}

export async function getUserChatSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));
}

export async function deleteChatSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  await db
    .delete(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)));
}

// ========== Chat Messages ==========

export async function addChatMessage(sessionId: number, role: "system" | "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(chatMessages).values({ sessionId, role, content });
}

export async function getSessionMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

// ========== Chart Analyses ==========

export async function createChartAnalysis(userId: number, imageUrl: string, imageKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(chartAnalyses).values({
    userId,
    imageUrl,
    imageKey,
    status: "pending",
  });
  return { id: Number(result[0].insertId) };
}

export async function updateChartAnalysis(
  id: number,
  data: {
    analysisResult?: string;
    timeframe?: string;
    patterns?: string;
    keyLevels?: string;
    status?: "pending" | "analyzing" | "completed" | "failed";
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(chartAnalyses).set(data).where(eq(chartAnalyses.id, id));
}

export async function getUserChartAnalyses(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(chartAnalyses)
    .where(eq(chartAnalyses.userId, userId))
    .orderBy(desc(chartAnalyses.createdAt));
}

export async function getChartAnalysisById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(chartAnalyses).where(eq(chartAnalyses.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Trading Plans ==========

export async function createTradingPlan(userId: number, planDate: string, content: string, marketType?: string, bias?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tradingPlans).values({
    userId,
    planDate,
    content,
    marketType,
    bias,
  });
  return { id: Number(result[0].insertId) };
}

export async function getTodayPlan(userId: number, planDate: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(tradingPlans)
    .where(and(eq(tradingPlans.userId, userId), eq(tradingPlans.planDate, planDate)))
    .orderBy(desc(tradingPlans.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserTradingPlans(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tradingPlans)
    .where(eq(tradingPlans.userId, userId))
    .orderBy(desc(tradingPlans.createdAt));
}

// ========== System Config ==========

export async function getConfig(key: string): Promise<string | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.configKey, key))
    .limit(1);
  return result.length > 0 ? result[0].configValue : undefined;
}

export async function setConfig(key: string, value: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db
    .insert(systemConfig)
    .values({ configKey: key, configValue: value, description })
    .onDuplicateKeyUpdate({ set: { configValue: value, description } });
}

export async function getAllConfigs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(systemConfig);
}
