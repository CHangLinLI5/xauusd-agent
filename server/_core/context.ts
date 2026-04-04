import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // In production, do NOT elevate privileges or bypass DB auth.
    // Only allow JWT fallback in explicit dev mode.
    const allowFallback =
      !ENV.isProduction &&
      process.env.ALLOW_JWT_FALLBACK === "true";

    if (!allowFallback) {
      // Production or fallback not explicitly enabled: user stays null
      user = null;
    } else {
      // Dev-only fallback: try to extract user from session JWT directly
      try {
        const cookies = parseCookieHeader(opts.req.headers.cookie || "");
        const sessionCookie = cookies[COOKIE_NAME];
        if (sessionCookie) {
          const session = await sdk.verifySession(sessionCookie);
          if (session) {
            user = {
              id: 1,
              openId: session.openId,
              name: session.name || "Dev User",
              email: null,
              loginMethod: "dev",
              role: "user",
              createdAt: new Date(),
              updatedAt: new Date(),
              lastSignedIn: new Date(),
            } as User;
          }
        }
      } catch {
        // Silent fallback
        user = null;
      }
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
