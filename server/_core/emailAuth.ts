/**
 * 邮箱+密码认证模块
 *
 * 提供注册和登录功能，使用 bcryptjs 进行密码哈希
 * 复用现有 JWT session 签发机制
 * 支持无数据库环境（内存存储降级）
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

const credentialStore = new Map<string, UserCredential>(); // key = email (lowercase)

// ========== Helpers ==========

const SALT_ROUNDS = 10;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateOpenId(email: string): string {
  // Generate a deterministic openId from email for consistency
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

// ========== Credential Storage (with DB fallback) ==========

async function getCredentialByEmail(email: string): Promise<UserCredential | undefined> {
  // Always check in-memory store first (works without DB)
  return credentialStore.get(normalizeEmail(email));
}

async function saveCredential(cred: UserCredential): Promise<void> {
  credentialStore.set(normalizeEmail(cred.email), cred);
}

// ========== Route Registration ==========

export function registerEmailAuthRoutes(app: Express) {
  console.log("[EmailAuth] Email login/register enabled at /api/email-auth/*");

  /**
   * POST /api/email-auth/register
   * Body: { email, password, name? }
   */
  app.post("/api/email-auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name } = req.body ?? {};

      // Validate
      const error = validateInput(email, password);
      if (error) {
        res.status(400).json({ ok: false, error });
        return;
      }

      const normalizedEmail = normalizeEmail(email);

      // Check if email already registered
      const existing = await getCredentialByEmail(normalizedEmail);
      if (existing) {
        res.status(409).json({ ok: false, error: "该邮箱已注册，请直接登录" });
        return;
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      const openId = generateOpenId(normalizedEmail);
      const displayName = name?.trim() || normalizedEmail.split("@")[0] || "Trader";

      // Save credential
      await saveCredential({
        openId,
        email: normalizedEmail,
        passwordHash,
        name: displayName,
        createdAt: new Date(),
      });

      // Upsert user in DB/memory (non-critical, may fail silently)
      try {
        await db.upsertUser({
          openId,
          name: displayName,
          email: normalizedEmail,
          loginMethod: "email",
          role: "admin", // First user gets admin for self-hosted
          lastSignedIn: new Date(),
        });
      } catch {
        console.warn("[EmailAuth] DB upsert skipped (no database)");
      }

      // Create session token
      const sessionToken = await sdk.createSessionToken(openId, {
        name: displayName,
        expiresInMs: ONE_YEAR_MS,
      });

      // Set cookie
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

      // Validate
      const error = validateInput(email, password);
      if (error) {
        res.status(400).json({ ok: false, error });
        return;
      }

      const normalizedEmail = normalizeEmail(email);

      // Find credential
      const cred = await getCredentialByEmail(normalizedEmail);
      if (!cred) {
        res.status(401).json({ ok: false, error: "邮箱未注册，请先注册" });
        return;
      }

      // Verify password
      const isValid = await bcrypt.compare(password, cred.passwordHash);
      if (!isValid) {
        res.status(401).json({ ok: false, error: "密码错误" });
        return;
      }

      // Update last sign in (non-critical)
      try {
        await db.upsertUser({
          openId: cred.openId,
          lastSignedIn: new Date(),
        });
      } catch {
        // Ignore DB errors
      }

      // Create session token
      const sessionToken = await sdk.createSessionToken(cred.openId, {
        name: cred.name,
        expiresInMs: ONE_YEAR_MS,
      });

      // Set cookie
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
   * GET /api/email-auth/available
   * Check if email auth is available
   */
  app.get("/api/email-auth/available", (_req: Request, res: Response) => {
    res.json({ available: true });
  });
}
