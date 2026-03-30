import {
  serial,
  pgTable,
  pgEnum,
  text,
  timestamp,
  varchar,
  integer,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["user", "admin"]);
export const chatRoleEnum = pgEnum("chat_role", ["system", "user", "assistant"]);
export const analysisStatusEnum = pgEnum("analysis_status", [
  "pending",
  "analyzing",
  "completed",
  "failed",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: text("passwordHash"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: roleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** AI 对话会话 */
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  title: varchar("title", { length: 200 }).default("新对话").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** AI 对话消息 */
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("sessionId").notNull(),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** 图表分析记录 */
export const chartAnalyses = pgTable("chart_analyses", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  imageUrl: text("imageUrl").notNull(),
  imageKey: varchar("imageKey", { length: 500 }).notNull(),
  analysisResult: text("analysisResult"),
  timeframe: varchar("timeframe", { length: 20 }),
  patterns: text("patterns"),
  keyLevels: text("keyLevels"),
  status: analysisStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** 交易计划 */
export const tradingPlans = pgTable("trading_plans", {
  id: serial("id").primaryKey(),
  userId: integer("userId").notNull(),
  planDate: varchar("planDate", { length: 10 }).notNull(),
  content: text("content").notNull(),
  marketType: varchar("marketType", { length: 20 }),
  bias: varchar("bias", { length: 20 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** 系统配置 */
export const systemConfig = pgTable("system_config", {
  id: serial("id").primaryKey(),
  configKey: varchar("configKey", { length: 100 }).notNull().unique(),
  configValue: text("configValue").notNull(),
  description: varchar("description", { length: 500 }),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
