import { eq, desc, and, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import {
  InsertUser,
  users,
  chatSessions,
  chatMessages,
  chartAnalyses,
  tradingPlans,
  systemConfig,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import {
  memCreateChatSession,
  memGetUserChatSessions,
  memDeleteChatSession,
  memAddChatMessage,
  memGetSessionMessages,
  memCreateChartAnalysis,
  memUpdateChartAnalysis,
  memGetUserChartAnalyses,
  memGetChartAnalysisById,
  memCreateTradingPlan,
  memGetTodayPlan,
  memGetUserTradingPlans,
  memGetConfig,
  memSetConfig,
  memGetAllConfigs,
} from "./memoryStore";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(pool);
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

    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      (values as any)[field] = normalized;
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
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // PostgreSQL upsert using ON CONFLICT
    await db
      .insert(users)
      .values(values)
      .onConflictDoUpdate({
        target: users.openId,
        set: { ...updateSet, updatedAt: new Date() },
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

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/**
 * 根据邮箱查找用户（用于登录验证）
 */
export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Chat Sessions (with memory fallback) ==========

export async function createChatSession(userId: number, title?: string) {
  const db = await getDb();
  if (!db) {
    return memCreateChatSession(userId, title);
  }
  const result = await db
    .insert(chatSessions)
    .values({
      userId,
      title: title ?? "新对话",
    })
    .returning({ id: chatSessions.id });
  return { id: result[0].id };
}

export async function getUserChatSessions(userId: number) {
  const db = await getDb();
  if (!db) return memGetUserChatSessions(userId);
  return db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt));
}

export async function deleteChatSession(sessionId: number, userId: number) {
  const db = await getDb();
  if (!db) {
    memDeleteChatSession(sessionId, userId);
    return;
  }
  await db.delete(chatMessages).where(eq(chatMessages.sessionId, sessionId));
  await db
    .delete(chatSessions)
    .where(
      and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId))
    );
}

// ========== Chat Messages (with memory fallback) ==========

export async function addChatMessage(
  sessionId: number,
  role: "system" | "user" | "assistant",
  content: string
) {
  const db = await getDb();
  if (!db) {
    memAddChatMessage(sessionId, role, content);
    return;
  }
  await db.insert(chatMessages).values({ sessionId, role, content });
}

export async function getSessionMessages(sessionId: number) {
  const db = await getDb();
  if (!db) return memGetSessionMessages(sessionId);
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(chatMessages.createdAt);
}

// ========== Chart Analyses (with memory fallback) ==========

export async function createChartAnalysis(
  userId: number,
  imageUrl: string,
  imageKey: string
) {
  const db = await getDb();
  if (!db) {
    return memCreateChartAnalysis(userId, imageUrl, imageKey);
  }
  const result = await db
    .insert(chartAnalyses)
    .values({
      userId,
      imageUrl,
      imageKey,
      status: "pending",
    })
    .returning({ id: chartAnalyses.id });
  return { id: result[0].id };
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
  if (!db) {
    memUpdateChartAnalysis(id, data);
    return;
  }
  await db.update(chartAnalyses).set(data).where(eq(chartAnalyses.id, id));
}

export async function getUserChartAnalyses(userId: number) {
  const db = await getDb();
  if (!db) return memGetUserChartAnalyses(userId);
  return db
    .select()
    .from(chartAnalyses)
    .where(eq(chartAnalyses.userId, userId))
    .orderBy(desc(chartAnalyses.createdAt));
}

export async function getChartAnalysisById(id: number) {
  const db = await getDb();
  if (!db) return memGetChartAnalysisById(id);
  const result = await db
    .select()
    .from(chartAnalyses)
    .where(eq(chartAnalyses.id, id))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Trading Plans (with memory fallback) ==========

export async function createTradingPlan(
  userId: number,
  planDate: string,
  content: string,
  marketType?: string,
  bias?: string
) {
  const db = await getDb();
  if (!db) {
    return memCreateTradingPlan(userId, planDate, content, marketType, bias);
  }
  const result = await db
    .insert(tradingPlans)
    .values({
      userId,
      planDate,
      content,
      marketType,
      bias,
    })
    .returning({ id: tradingPlans.id });
  return { id: result[0].id };
}

export async function getTodayPlan(userId: number, planDate: string) {
  const db = await getDb();
  if (!db) return memGetTodayPlan(userId, planDate);
  const result = await db
    .select()
    .from(tradingPlans)
    .where(
      and(
        eq(tradingPlans.userId, userId),
        eq(tradingPlans.planDate, planDate)
      )
    )
    .orderBy(desc(tradingPlans.createdAt))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserTradingPlans(userId: number) {
  const db = await getDb();
  if (!db) return memGetUserTradingPlans(userId);
  return db
    .select()
    .from(tradingPlans)
    .where(eq(tradingPlans.userId, userId))
    .orderBy(desc(tradingPlans.createdAt));
}

// ========== System Config (with memory fallback) ==========

export async function getConfig(key: string): Promise<string | undefined> {
  const db = await getDb();
  if (!db) return memGetConfig(key);
  const result = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.configKey, key))
    .limit(1);
  return result.length > 0 ? result[0].configValue : undefined;
}

export async function setConfig(
  key: string,
  value: string,
  description?: string
) {
  const db = await getDb();
  if (!db) {
    memSetConfig(key, value, description);
    return;
  }
  await db
    .insert(systemConfig)
    .values({ configKey: key, configValue: value, description })
    .onConflictDoUpdate({
      target: systemConfig.configKey,
      set: { configValue: value, description, updatedAt: new Date() },
    });
}

export async function getAllConfigs() {
  const db = await getDb();
  if (!db) return memGetAllConfigs();
  return db.select().from(systemConfig);
}
