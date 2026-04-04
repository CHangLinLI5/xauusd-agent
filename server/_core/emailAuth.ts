/**
 * 邮箱+密码认证模块
 *
 * 提供注册、登录、修改昵称、修改密码、交易偏好等功能
 * 使用 bcryptjs 进行密码哈希
 * 复用现有 JWT session 签发机制
 * v2: 使用数据库持久化凭证，支持跨设备登录
 */
import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";

// ========== In-memory credential store (DB-less fallback) ==========

interface UserCredential {
  openId: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

interface TradingPreferences {
  defaultLotSize: string;
  maxDailyLoss: string;
  riskRewardRatio: string;
  maxOpenPositions: string;
  preferredSession: string;
  stopLossPoints: string;
}

const credentialStore = new Map<string, UserCredential>(); // key = email (lowercase), fallback only
const preferencesStore = new Map<string, TradingPreferences>(); // key = openId

// ========== Helpers ==========

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOpenId(email: string): string {
  return `email-${Buffer.from(email).toString("base64url").slice(0, 32)}`;
}

function validateInput(email: string, password: string): string | null {
  if (!email || !EMAIL_REGEX.test(email)) {
    return "请输入有效的邮箱地址";
  }
  if (!password || password.length < 6) {
    return "密码长度至少 6 位";
  }
  if (password.length > 128) {
    return "密码长度不能超过 128 位";
  }
  return null;
}

// ========== Credential Storage (DB-first, memory fallback) ==========

async function getCredentialByEmail(
  email: string
): Promise<UserCredential | undefined> {
  // Try database first
  const dbUser = await db.getUserByEmail(normalizeEmail(email));
  if (dbUser && dbUser.passwordHash) {
    return {
      openId: dbUser.openId,
      email: dbUser.email || email,
      passwordHash: dbUser.passwordHash,
      name: dbUser.name || email.split("@")[0] || "Trader",
      createdAt: dbUser.createdAt,
    };
  }

  // Fallback to memory
  return credentialStore.get(normalizeEmail(email));
}

async function getCredentialByOpenId(
  openId: string
): Promise<UserCredential | undefined> {
  // Try database first
  const dbUser = await db.getUserByOpenId(openId);
  if (dbUser && dbUser.passwordHash) {
    return {
      openId: dbUser.openId,
      email: dbUser.email || "",
      passwordHash: dbUser.passwordHash,
      name: dbUser.name || "Trader",
      createdAt: dbUser.createdAt,
    };
  }

  // Fallback to memory
  const entries = Array.from(credentialStore.values());
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]!.openId === openId) return entries[i];
  }
  return undefined;
}

async function saveCredential(cred: UserCredential): Promise<void> {
  // Save to memory as fallback
  credentialStore.set(normalizeEmail(cred.email), cred);

  // Save to database (passwordHash included)
  try {
    await db.upsertUser({
      openId: cred.openId,
      name: cred.name,
      email: normalizeEmail(cred.email),
      passwordHash: cred.passwordHash,
      loginMethod: "email",
      role: "user",
      lastSignedIn: new Date(),
    });
  } catch (err) {
    console.warn("[EmailAuth] DB save credential failed:", err);
  }
}

// ========== Auth Middleware Helper ==========

async function getAuthenticatedUser(
  req: Request
): Promise<{ openId: string; name: string } | null> {
  try {
    const cookieHeader = req.headers.cookie || "";
    const cookies = cookieHeader.split(";").reduce(
      (acc, c) => {
        const [key, ...val] = c.trim().split("=");
        if (key) acc[key] = val.join("=");
        return acc;
      },
      {} as Record<string, string>
    );

    const sessionCookie = cookies[COOKIE_NAME];
    if (!sessionCookie) return null;

    const session = await sdk.verifySession(sessionCookie);
    return session;
  } catch {
    return null;
  }
}

// ========== Route Registration ==========

export function registerEmailAuthRoutes(app: Express) {
  console.log("[EmailAuth] Email auth routes enabled at /api/email-auth/*");

  /**
   * POST /api/email-auth/register
   * Body: { email, password, name? }
   */
  app.post("/api/email-auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body ?? {};

      const error = validateInput(email, password);
      if (error) {
        res.status(400).json({ ok: false, error });
        return;
      }

      const normalizedEmail = normalizeEmail(email);

      const existing = await getCredentialByEmail(normalizedEmail);
      if (existing) {
        res.status(409).json({ ok: false, error: "该邮箱已注册，请直接登录" });
        return;
      }

      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const openId = generateOpenId(normalizedEmail);
      const displayName =
        name?.trim() || normalizedEmail.split("@")[0] || "Trader";

      await saveCredential({
        openId,
        email: normalizedEmail,
        passwordHash,
        name: displayName,
        createdAt: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.json({
        ok: true,
        user: { openId, name: displayName, email: normalizedEmail },
      });
    } catch (error) {
      console.error("[EmailAuth] Register failed:", error);
      res.status(500).json({ ok: false, error: "注册失败，请稍后重试" });
    }
  });

  /**
   * POST /api/email-auth/login
   * Body: { email, password }
   */
  app.post("/api/email-auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body ?? {};

      const error = validateInput(email, password);
      if (error) {
        res.status(400).json({ ok: false, error });
        return;
      }

      const normalizedEmail = normalizeEmail(email);

      const cred = await getCredentialByEmail(normalizedEmail);
      if (!cred) {
        res.status(401).json({ ok: false, error: "邮箱未注册，请先注册" });
        return;
      }

      const isValid = await bcrypt.compare(password, cred.passwordHash);
      if (!isValid) {
        res.status(401).json({ ok: false, error: "密码错误" });
        return;
      }

      try {
        await db.upsertUser({
          openId: cred.openId,
          lastSignedIn: new Date(),
        });
      } catch {
        // Ignore DB errors
      }

      const sessionToken = await sdk.createSessionToken(cred.openId, {
        name: cred.name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      res.json({
        ok: true,
        user: { openId: cred.openId, name: cred.name, email: cred.email },
      });
    } catch (error) {
      console.error("[EmailAuth] Login failed:", error);
      res.status(500).json({ ok: false, error: "登录失败，请稍后重试" });
    }
  });

  /**
   * POST /api/email-auth/update-profile
   * Body: { name }
   * Requires authentication
   */
  app.post(
    "/api/email-auth/update-profile",
    async (req: Request, res: Response) => {
      try {
        const session = await getAuthenticatedUser(req);
        if (!session) {
          res.status(401).json({ ok: false, error: "请先登录" });
          return;
        }

        const { name } = req.body ?? {};
        if (!name || typeof name !== "string" || !name.trim()) {
          res.status(400).json({ ok: false, error: "昵称不能为空" });
          return;
        }

        const trimmedName = name.trim();
        if (trimmedName.length > 50) {
          res
            .status(400)
            .json({ ok: false, error: "昵称不能超过 50 个字符" });
          return;
        }

        // Update credential store (memory)
        const cred = await getCredentialByOpenId(session.openId);
        if (cred) {
          cred.name = trimmedName;
          credentialStore.set(normalizeEmail(cred.email), cred);
        }

        // Update DB
        try {
          await db.upsertUser({
            openId: session.openId,
            name: trimmedName,
          });
        } catch {
          console.warn("[EmailAuth] DB update-profile skipped");
        }

        // Re-issue session token with new name
        const sessionToken = await sdk.createSessionToken(session.openId, {
          name: trimmedName,
          expiresInMs: ONE_YEAR_MS,
        });

        const cookieOptions = getSessionCookieOptions(req);
        res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        res.json({ ok: true, name: trimmedName });
      } catch (error) {
        console.error("[EmailAuth] Update profile failed:", error);
        res.status(500).json({ ok: false, error: "更新失败，请重试" });
      }
    }
  );

  /**
   * POST /api/email-auth/change-password
   * Body: { oldPassword, newPassword }
   * Requires authentication
   */
  app.post(
    "/api/email-auth/change-password",
    async (req: Request, res: Response) => {
      try {
        const session = await getAuthenticatedUser(req);
        if (!session) {
          res.status(401).json({ ok: false, error: "请先登录" });
          return;
        }

        const { oldPassword, newPassword } = req.body ?? {};

        if (!oldPassword || typeof oldPassword !== "string") {
          res.status(400).json({ ok: false, error: "请输入当前密码" });
          return;
        }
        if (
          !newPassword ||
          typeof newPassword !== "string" ||
          newPassword.length < 6
        ) {
          res.status(400).json({ ok: false, error: "新密码长度至少 6 位" });
          return;
        }
        if (newPassword.length > 128) {
          res
            .status(400)
            .json({ ok: false, error: "新密码长度不能超过 128 位" });
          return;
        }

        // Find credential by openId
        const cred = await getCredentialByOpenId(session.openId);
        if (!cred) {
          res
            .status(404)
            .json({ ok: false, error: "用户凭证未找到，可能需要重新注册" });
          return;
        }

        // Verify old password
        const isValid = await bcrypt.compare(oldPassword, cred.passwordHash);
        if (!isValid) {
          res.status(401).json({ ok: false, error: "当前密码错误" });
          return;
        }

        // Hash new password and update
        const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
        cred.passwordHash = newHash;
        credentialStore.set(normalizeEmail(cred.email), cred);

        // Persist to database
        try {
          await db.upsertUser({
            openId: session.openId,
            passwordHash: newHash,
          });
        } catch {
          console.warn("[EmailAuth] DB change-password skipped");
        }

        res.json({ ok: true, message: "密码已更新" });
      } catch (error) {
        console.error("[EmailAuth] Change password failed:", error);
        res.status(500).json({ ok: false, error: "修改密码失败，请重试" });
      }
    }
  );

  /**
   * GET /api/email-auth/preferences
   * Get trading preferences for authenticated user
   */
  app.get(
    "/api/email-auth/preferences",
    async (req: Request, res: Response) => {
      try {
        const session = await getAuthenticatedUser(req);
        if (!session) {
          res.status(401).json({ ok: false, error: "请先登录" });
          return;
        }

        // Try loading from DB config first
        let prefs: TradingPreferences | undefined;
        try {
          const stored = await db.getConfig(`user_prefs_${session.openId}`);
          if (stored) {
            prefs = JSON.parse(stored);
          }
        } catch {
          // ignore
        }

        if (!prefs) {
          prefs = preferencesStore.get(session.openId) || {
            defaultLotSize: "0.1",
            maxDailyLoss: "2",
            riskRewardRatio: "1:2",
            maxOpenPositions: "3",
            preferredSession: "us",
            stopLossPoints: "100",
          };
        }

        res.json({ ok: true, preferences: prefs });
      } catch (error) {
        console.error("[EmailAuth] Get preferences failed:", error);
        res.status(500).json({ ok: false, error: "获取偏好失败" });
      }
    }
  );

  /**
   * POST /api/email-auth/update-preferences
   * Body: { preferences: { ... } }
   * Requires authentication
   */
  app.post(
    "/api/email-auth/update-preferences",
    async (req: Request, res: Response) => {
      try {
        const session = await getAuthenticatedUser(req);
        if (!session) {
          res.status(401).json({ ok: false, error: "请先登录" });
          return;
        }

        const { preferences } = req.body ?? {};
        if (!preferences || typeof preferences !== "object") {
          res.status(400).json({ ok: false, error: "无效的偏好数据" });
          return;
        }

        // Validate and sanitize preferences
        const sanitized: TradingPreferences = {
          defaultLotSize: String(preferences.defaultLotSize || "0.1").slice(
            0,
            10
          ),
          maxDailyLoss: String(preferences.maxDailyLoss || "2").slice(0, 10),
          riskRewardRatio: String(
            preferences.riskRewardRatio || "1:2"
          ).slice(0, 10),
          maxOpenPositions: String(
            preferences.maxOpenPositions || "3"
          ).slice(0, 10),
          preferredSession: String(
            preferences.preferredSession || "us"
          ).slice(0, 20),
          stopLossPoints: String(preferences.stopLossPoints || "100").slice(
            0,
            10
          ),
        };

        preferencesStore.set(session.openId, sanitized);

        // Persist to system config
        try {
          await db.setConfig(
            `user_prefs_${session.openId}`,
            JSON.stringify(sanitized),
            "Trading preferences"
          );
        } catch {
          // Memory-only is fine
        }

        res.json({ ok: true, preferences: sanitized });
      } catch (error) {
        console.error("[EmailAuth] Update preferences failed:", error);
        res.status(500).json({ ok: false, error: "保存偏好失败" });
      }
    }
  );

  /**
   * GET /api/email-auth/available
   * Check if email auth is available
   */
  app.get("/api/email-auth/available", (_req: Request, res: Response) => {
    res.json({ available: true });
  });
}
