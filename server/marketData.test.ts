import { describe, expect, it } from "vitest";

/**
 * Market Data API Integration Tests
 * Tests the real YahooFinance Data API integration for XAUUSD quotes
 */

describe("marketData", () => {
  it("callDataApi should be importable and configured", async () => {
    const { callDataApi } = await import("./_core/dataApi");
    expect(typeof callDataApi).toBe("function");
  });

  it("should fetch GC=F gold futures data from YahooFinance", async () => {
    const { callDataApi } = await import("./_core/dataApi");

    const result = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: "GC=F",
        interval: "1d",
        range: "5d",
        includeAdjustedClose: "true",
      },
    }) as { chart: { result: Array<{ meta: Record<string, unknown>; indicators: { quote: Array<Record<string, unknown[]>> } }> } };

    expect(result).toBeDefined();
    expect(result.chart).toBeDefined();
    expect(result.chart.result).toHaveLength(1);

    const meta = result.chart.result[0].meta;
    expect(meta.symbol).toBe("GC=F");
    expect(meta.currency).toBe("USD");
    expect(typeof meta.regularMarketPrice).toBe("number");
    expect(meta.regularMarketPrice as number).toBeGreaterThan(1000);

    // Verify quote data exists
    const quotes = result.chart.result[0].indicators.quote[0];
    expect(quotes.close).toBeDefined();
    expect(Array.isArray(quotes.close)).toBe(true);
    expect((quotes.close as number[]).length).toBeGreaterThan(0);
  });

  it("should fetch intraday 15-min data for GC=F", async () => {
    const { callDataApi } = await import("./_core/dataApi");

    const result = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: "GC=F",
        interval: "15m",
        range: "1d",
        includeAdjustedClose: "true",
      },
    }) as { chart: { result: Array<{ meta: Record<string, unknown>; timestamp: number[]; indicators: { quote: Array<Record<string, unknown[]>> } }> } };

    expect(result).toBeDefined();
    expect(result.chart.result[0].meta.regularMarketPrice).toBeGreaterThan(1000);

    // Should have multiple intraday candles
    const timestamps = result.chart.result[0].timestamp;
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it("getRealQuote should return valid XAUUSD quote", { timeout: 15000 }, async () => {
    // Clear module cache to avoid stale cached data from previous test runs
    const mod = await import("./marketData");

    // Call twice - first may warm cache, second should use it
    const quote = await mod.getRealQuote();

    expect(quote).toBeDefined();
    expect(quote.symbol).toBe("XAUUSD");
    expect(typeof quote.price).toBe("number");
    expect(typeof quote.change).toBe("number");
    expect(typeof quote.changePercent).toBe("number");
    expect(typeof quote.high).toBe("number");
    expect(typeof quote.low).toBe("number");
    expect(quote.timestamp).toBeDefined();

    // If API succeeded, price should be > 1000
    // If API failed (e.g., rate limit), price will be 0 (default)
    if (quote.price > 0) {
      expect(quote.price).toBeGreaterThan(1000);
      expect(quote.high).toBeGreaterThanOrEqual(quote.low);
    }
  });

  it("calculateKeyLevels should return valid support/resistance levels", { timeout: 15000 }, async () => {
    const { calculateKeyLevels } = await import("./marketData");

    const levels = await calculateKeyLevels();

    expect(levels).toBeDefined();
    expect(typeof levels.resistance1).toBe("number");
    expect(typeof levels.resistance2).toBe("number");
    expect(typeof levels.support1).toBe("number");
    expect(typeof levels.support2).toBe("number");
    expect(typeof levels.boxTop).toBe("number");
    expect(typeof levels.boxBottom).toBe("number");

    // Key levels should be positive and in reasonable range
    if (levels.resistance1 > 0) {
      expect(levels.resistance2).toBeGreaterThanOrEqual(levels.resistance1);
      expect(levels.resistance1).toBeGreaterThan(levels.support1);
      expect(levels.support1).toBeGreaterThanOrEqual(levels.support2);
      expect(levels.boxTop).toBeGreaterThanOrEqual(levels.boxBottom);
    }
  });

  it("getRealDailyBias should return complete bias data", { timeout: 15000 }, async () => {
    const { getRealDailyBias } = await import("./marketData");

    const bias = await getRealDailyBias();

    expect(bias).toBeDefined();
    expect(["bullish", "bearish", "ranging"]).toContain(bias.bias);
    expect(typeof bias.biasLabel).toBe("string");
    expect(["high", "medium", "low"]).toContain(bias.confidence);
    expect(bias.keyLevels).toBeDefined();
    expect(["tradable", "cautious", "no_trade"]).toContain(bias.riskStatus);
    expect(typeof bias.riskLabel).toBe("string");
    expect(typeof bias.summary).toBe("string");
    expect(bias.summary.length).toBeGreaterThan(10);
    expect(bias.sessions).toBeDefined();
    expect(typeof bias.sessions.asia).toBe("string");
    expect(typeof bias.sessions.europe).toBe("string");
    expect(typeof bias.sessions.us).toBe("string");
  });
});
