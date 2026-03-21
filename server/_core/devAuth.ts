/**
 * 开发模式登录
 * 当 OAuth 未配置时，提供本地开发登录功能
 * 仅在 NODE_ENV !== "production" 时启用
 */
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import * as db from "../db";

const DEV_USER = {
  openId: "dev-user-001",
  name: "开发者",
  email: "dev@xauusd.local",
  loginMethod: "dev",
};

export function registerDevAuthRoutes(app: Express) {
  // Only enable in non-production when OAuth is not configured
  if (ENV.isProduction) {
    console.log("[DevAuth] Production mode – dev login disabled");
    return;
  }

  console.log("[DevAuth] Dev login enabled at /api/dev-login");

  // Dev login endpoint
  app.get("/api/dev-login", async (req: Request, res: Response) => {
    try {
      // Upsert dev user (will silently skip if DB is not available)
      await db.upsertUser({
        openId: DEV_USER.openId,
        name: DEV_USER.name,
        email: DEV_USER.email,
        loginMethod: DEV_USER.loginMethod,
        lastSignedIn: new Date(),
        role: "admin", // Dev user gets admin access
      });

      // Create session token
      const sessionToken = await sdk.createSessionToken(DEV_USER.openId, {
        name: DEV_USER.name,
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      // Redirect to home page
      res.redirect(302, "/");
    } catch (error) {
      console.error("[DevAuth] Login failed:", error);
      res.status(500).json({ error: "Dev login failed", detail: String(error) });
    }
  });

  // Dev login status check
  app.get("/api/dev-auth-available", (_req: Request, res: Response) => {
    res.json({ available: true, user: DEV_USER });
  });
}
