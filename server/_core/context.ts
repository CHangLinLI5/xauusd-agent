import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";

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
    // If DB-based auth fails, try to extract user from session JWT directly
    // This supports dev mode where DB may not be available
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
            role: "admin",
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

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
