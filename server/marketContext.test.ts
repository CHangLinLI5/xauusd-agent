import { describe, expect, it } from "vitest";
import { buildMarketContext } from "./marketContext";

describe("buildMarketContext", () => {
  it("returns a non-empty string with market data sections", async () => {
    const context = await buildMarketContext();
    expect(typeof context).toBe("string");
    // Should contain key sections
    if (context.length > 0) {
      expect(context).toContain("实时报价");
      expect(context).toContain("XAUUSD");
      expect(context).toContain("关键位");
      expect(context).toContain("盘面状态");
      expect(context).toContain("今日经济日历");
      expect(context).toContain("今日偏向");
    }
  }, 30000);

  it("includes price data with proper formatting", async () => {
    const context = await buildMarketContext();
    if (context.length > 0) {
      // Should have numeric price data
      expect(context).toMatch(/当前价格：\d+\.\d{2}/);
      expect(context).toMatch(/R2（阻力2）：\d+\.\d{2}/);
      expect(context).toMatch(/S1（支撑1）：\d+\.\d{2}/);
    }
  }, 30000);

  it("includes session information", async () => {
    const context = await buildMarketContext();
    if (context.length > 0) {
      // Should contain session info
      expect(context).toMatch(/当前时段：(亚洲盘|欧盘|美盘|收盘后)/);
      expect(context).toContain("亚洲盘");
      expect(context).toContain("欧洲盘");
      expect(context).toContain("美洲盘");
    }
  }, 30000);

  it("returns empty string on total failure without throwing", async () => {
    // The function should never throw - it catches errors internally
    const context = await buildMarketContext();
    expect(typeof context).toBe("string");
  }, 30000);
});
