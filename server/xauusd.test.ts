import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test Trader",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("XAUUSD Agent API", () => {
  describe("market.quote", () => {
    it("returns XAUUSD quote with required fields", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const quote = await caller.market.quote();

      expect(quote).toBeDefined();
      expect(quote.symbol).toBe("XAUUSD");
      expect(typeof quote.price).toBe("number");
      expect(typeof quote.change).toBe("number");
      expect(typeof quote.changePercent).toBe("number");
      expect(typeof quote.high).toBe("number");
      expect(typeof quote.low).toBe("number");
      expect(typeof quote.open).toBe("number");
      expect(quote.price).toBeGreaterThan(2000);
      expect(quote.price).toBeLessThan(5000);
    });
  });

  describe("market.dailyBias", () => {
    it("returns daily bias with required structure", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const bias = await caller.market.dailyBias();

      expect(bias).toBeDefined();
      expect(["bullish", "bearish", "ranging"]).toContain(bias.bias);
      expect(bias.biasLabel).toBeDefined();
      expect(["high", "medium", "low"]).toContain(bias.confidence);
      expect(bias.keyLevels).toBeDefined();
      expect(typeof bias.keyLevels.resistance1).toBe("number");
      expect(typeof bias.keyLevels.resistance2).toBe("number");
      expect(typeof bias.keyLevels.support1).toBe("number");
      expect(typeof bias.keyLevels.support2).toBe("number");
      expect(typeof bias.keyLevels.boxTop).toBe("number");
      expect(typeof bias.keyLevels.boxBottom).toBe("number");
      expect(["tradable", "cautious", "no_trade"]).toContain(bias.riskStatus);
      expect(bias.riskLabel).toBeDefined();
      expect(bias.sessions).toBeDefined();
    });
  });

  describe("market.news", () => {
    it("returns news array with required fields", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const news = await caller.market.news();

      expect(Array.isArray(news)).toBe(true);
      expect(news.length).toBeGreaterThan(0);

      const item = news[0]!;
      expect(item.id).toBeDefined();
      expect(item.title).toBeDefined();
      expect(item.source).toBeDefined();
      expect(item.category).toBeDefined();
      expect(["bullish", "bearish", "neutral"]).toContain(item.impact);
      expect(item.impactLabel).toBeDefined();
      expect(item.summary).toBeDefined();
    });
  });

  describe("market.calendar", () => {
    it("returns economic calendar events", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const events = await caller.market.calendar();

      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);

      const event = events[0]!;
      expect(event.id).toBeDefined();
      expect(event.name).toBeDefined();
      expect(event.time).toBeDefined();
      expect(["high", "medium", "low"]).toContain(event.importance);
    });
  });

  describe("config (admin only)", () => {
    it("rejects non-admin users", async () => {
      const caller = appRouter.createCaller(createAuthContext("user"));

      await expect(caller.config.getAll()).rejects.toThrow();
    });
  });

  describe("auth.me", () => {
    it("returns null for unauthenticated users", async () => {
      const caller = appRouter.createCaller(createPublicContext());
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });

    it("returns user for authenticated users", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      const result = await caller.auth.me();
      expect(result).toBeDefined();
      expect(result?.openId).toBe("test-user-123");
      expect(result?.name).toBe("Test Trader");
    });
  });
});
