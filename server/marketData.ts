/**
 * 真实行情数据模块
 * 通过 YahooFinance Data API 获取 GC=F (COMEX Gold Futures) 数据
 * 作为 XAUUSD 现货黄金的近似行情
 */
import { callDataApi } from "./_core/dataApi";
import { ENV } from "./_core/env";
import type { MarketQuote } from "./mockData";

// ========== Types ==========

interface YahooChartMeta {
  symbol: string;
  currency: string;
  regularMarketPrice: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  chartPreviousClose: number;
  regularMarketVolume: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  regularMarketTime: number;
  [key: string]: unknown;
}

interface YahooQuoteData {
  open: (number | null)[];
  high: (number | null)[];
  low: (number | null)[];
  close: (number | null)[];
  volume: (number | null)[];
}

interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp: number[];
  indicators: {
    quote: YahooQuoteData[];
  };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[];
    error: unknown;
  };
}

interface KeyLevels {
  resistance1: number;
  resistance2: number;
  support1: number;
  support2: number;
  boxTop: number;
  boxBottom: number;
}

interface DailyBiasData {
  bias: "bullish" | "bearish" | "ranging";
  biasLabel: string;
  confidence: "high" | "medium" | "low";
  keyLevels: KeyLevels;
  riskStatus: "tradable" | "cautious" | "no_trade";
  riskLabel: string;
  summary: string;
  sessions: {
    asia: string;
    europe: string;
    us: string;
  };
}

// ========== Cache ==========

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: {
  quote?: CacheEntry<MarketQuote>;
  dailyData?: CacheEntry<YahooChartResult>;
  weeklyData?: CacheEntry<YahooChartResult>;
  monthlyData?: CacheEntry<YahooChartResult>;
  intradayData?: CacheEntry<YahooChartResult>;
} = {};

const CACHE_TTL = {
  quote: 30 * 1000,        // 30 seconds for real-time quote (Data API latency ~800ms)
  intraday: 3 * 60 * 1000, // 3 minutes for intraday data
  daily: 15 * 60 * 1000,   // 15 minutes for daily data
  weekly: 60 * 60 * 1000,  // 1 hour for weekly data
  monthly: 2 * 60 * 60 * 1000, // 2 hours for monthly data
};

function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < ttl;
}

// ========== API Calls ==========

async function fetchGoldChart(interval: string, range: string): Promise<YahooChartResult | null> {
  try {
    const result = await callDataApi("YahooFinance/get_stock_chart", {
      query: {
        symbol: "GC=F",
        interval,
        range,
      },
    }) as YahooChartResponse;

    if (result?.chart?.result?.[0]) {
      return result.chart.result[0];
    }
    return null;
  } catch (error) {
    console.error(`[MarketData] Failed to fetch GC=F (${interval}/${range}):`, error);
    return null;
  }
}

// ========== Real-time Quote ==========

export async function getRealQuote(): Promise<MarketQuote> {
  if (isCacheValid(cache.quote, CACHE_TTL.quote)) {
    return cache.quote.data;
  }

  // If Forge API is not configured, throw so callers fall back to mock data
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("Forge API not configured – use mock data");
  }

  const data = await fetchGoldChart("1d", "5d");
  if (!data) {
    console.warn("[MarketData] Falling back to cached or default quote");
    return (cache.quote as CacheEntry<MarketQuote> | undefined)?.data ?? getDefaultQuote();
  }

  const meta = data.meta;
  const quotes = data.indicators.quote[0];
  const closes = quotes.close.filter((c): c is number => c !== null);
  const prevClose = closes.length >= 2 ? closes[closes.length - 2]! : meta.chartPreviousClose;
  const currentPrice = meta.regularMarketPrice;
  const change = currentPrice - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  // Get today's open from the last candle
  const opens = quotes.open.filter((o): o is number => o !== null);
  const todayOpen = opens.length > 0 ? opens[opens.length - 1]! : currentPrice;

  const quoteData: MarketQuote = {
    symbol: "XAUUSD",
    price: round2(currentPrice),
    change: round2(change),
    changePercent: round2(changePercent),
    high: round2(meta.regularMarketDayHigh),
    low: round2(meta.regularMarketDayLow),
    open: round2(todayOpen),
    timestamp: new Date(meta.regularMarketTime * 1000).toISOString(),
  };

  cache.quote = { data: quoteData, timestamp: Date.now() };
  return quoteData;
}

// ========== Key Levels Calculation ==========

async function getIntradayData(): Promise<YahooChartResult | null> {
  if (isCacheValid(cache.intradayData, CACHE_TTL.intraday)) {
    return cache.intradayData.data;
  }
  const data = await fetchGoldChart("15m", "2d");
  if (data) {
    cache.intradayData = { data, timestamp: Date.now() };
  }
  return data;
}

async function getDailyData(): Promise<YahooChartResult | null> {
  if (isCacheValid(cache.dailyData, CACHE_TTL.daily)) {
    return cache.dailyData.data;
  }
  const data = await fetchGoldChart("1d", "1mo");
  if (data) {
    cache.dailyData = { data, timestamp: Date.now() };
  }
  return data;
}

async function getWeeklyData(): Promise<YahooChartResult | null> {
  if (isCacheValid(cache.weeklyData, CACHE_TTL.weekly)) {
    return cache.weeklyData.data;
  }
  const data = await fetchGoldChart("1wk", "6mo");
  if (data) {
    cache.weeklyData = { data, timestamp: Date.now() };
  }
  return data;
}

/**
 * 计算关键位
 * 基于多周期数据计算支撑阻力位和箱体
 */
export async function calculateKeyLevels(): Promise<KeyLevels> {
  const [dailyData, intradayData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
  ]);

  if (!dailyData) {
    return getDefaultKeyLevels();
  }

  const quotes = dailyData.indicators.quote[0];
  const highs = quotes.high.filter((h): h is number => h !== null);
  const lows = quotes.low.filter((l): l is number => l !== null);
  const closes = quotes.close.filter((c): c is number => c !== null);

  if (highs.length < 5 || lows.length < 5) {
    return getDefaultKeyLevels();
  }

  // Recent data (last 5-10 days) for box calculation
  const recentHighs = highs.slice(-10);
  const recentLows = lows.slice(-10);
  const recentCloses = closes.slice(-5);

  // Box: recent range
  const boxTop = round2(Math.max(...recentHighs.slice(-5)));
  const boxBottom = round2(Math.min(...recentLows.slice(-5)));

  // Pivot point calculation (classic)
  const lastHigh = highs[highs.length - 1]!;
  const lastLow = lows[lows.length - 1]!;
  const lastClose = closes[closes.length - 1]!;
  const pivot = (lastHigh + lastLow + lastClose) / 3;

  // Resistance and Support levels
  const resistance1 = round2(2 * pivot - lastLow);
  const resistance2 = round2(pivot + (lastHigh - lastLow));
  const support1 = round2(2 * pivot - lastHigh);
  const support2 = round2(pivot - (lastHigh - lastLow));

  // Enhance with intraday data if available
  if (intradayData) {
    const intradayQuotes = intradayData.indicators.quote[0];
    const intradayHighs = intradayQuotes.high.filter((h): h is number => h !== null);
    const intradayLows = intradayQuotes.low.filter((l): l is number => l !== null);

    if (intradayHighs.length > 0 && intradayLows.length > 0) {
      // Use today's intraday high/low for tighter box
      const todayHigh = Math.max(...intradayHighs.slice(-20));
      const todayLow = Math.min(...intradayLows.slice(-20));

      return {
        resistance1: Math.max(resistance1, round2(todayHigh + (todayHigh - todayLow) * 0.382)),
        resistance2,
        support1: Math.min(support1, round2(todayLow - (todayHigh - todayLow) * 0.382)),
        support2,
        boxTop: round2(todayHigh),
        boxBottom: round2(todayLow),
      };
    }
  }

  return { resistance1, resistance2, support1, support2, boxTop, boxBottom };
}

// ========== Daily Bias ==========

/**
 * 基于真实数据计算今日偏向
 */
export async function getRealDailyBias(): Promise<DailyBiasData> {
  // If Forge API is not configured, throw so callers fall back to mock data
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("Forge API not configured \u2013 use mock data");
  }

  const [quote, keyLevels, dailyData] = await Promise.all([
    getRealQuote(),
    calculateKeyLevels(),
    getDailyData(),
  ]);

  // Determine bias based on price action
  let bias: "bullish" | "bearish" | "ranging" = "ranging";
  let biasLabel = "震荡";
  let confidence: "high" | "medium" | "low" = "medium";

  if (dailyData) {
    const closes = dailyData.indicators.quote[0].close.filter((c): c is number => c !== null);
    if (closes.length >= 5) {
      const recent5 = closes.slice(-5);
      const recent3 = closes.slice(-3);

      // 5-day trend
      const trend5 = recent5[recent5.length - 1]! - recent5[0]!;
      // 3-day trend
      const trend3 = recent3[recent3.length - 1]! - recent3[0]!;
      // Price vs box midpoint
      const boxMid = (keyLevels.boxTop + keyLevels.boxBottom) / 2;
      const priceVsBox = quote.price - boxMid;

      // Multi-factor bias determination
      let bullishScore = 0;
      let bearishScore = 0;

      if (trend5 > 0) bullishScore += 2; else bearishScore += 2;
      if (trend3 > 0) bullishScore += 1.5; else bearishScore += 1.5;
      if (quote.change > 0) bullishScore += 1; else bearishScore += 1;
      if (priceVsBox > 0) bullishScore += 1; else bearishScore += 1;

      // Price near resistance → less bullish; near support → less bearish
      const rangeSize = keyLevels.resistance1 - keyLevels.support1;
      if (rangeSize > 0) {
        const pricePosition = (quote.price - keyLevels.support1) / rangeSize;
        if (pricePosition > 0.8) bearishScore += 0.5; // Near resistance
        if (pricePosition < 0.2) bullishScore += 0.5; // Near support
      }

      const totalScore = bullishScore + bearishScore;
      const bullishRatio = bullishScore / totalScore;

      if (bullishRatio > 0.65) {
        bias = "bullish";
        biasLabel = "偏多";
        confidence = bullishRatio > 0.8 ? "high" : "medium";
      } else if (bullishRatio < 0.35) {
        bias = "bearish";
        biasLabel = "偏空";
        confidence = bullishRatio < 0.2 ? "high" : "medium";
      } else {
        bias = "ranging";
        biasLabel = "震荡";
        confidence = "medium";
      }
    }
  }

  // Determine risk status based on time
  const now = new Date();
  const utcHour = now.getUTCHours();
  let riskStatus: "tradable" | "cautious" | "no_trade" = "tradable";
  let riskLabel = "可交易";

  // Simplified session-based risk
  // Major data releases typically at 12:30-14:00 UTC (US session)
  if (utcHour >= 12 && utcHour <= 14) {
    riskStatus = "cautious";
    riskLabel = "数据时段·谨慎";
  }

  // Session status
  const sessions = {
    asia: utcHour >= 0 && utcHour < 8 ? "活跃" : "已收",
    europe: utcHour >= 7 && utcHour < 16 ? "活跃" : "已收",
    us: utcHour >= 13 && utcHour < 22 ? "活跃" : "已收",
  };

  // Determine tradability per session
  const sessionStatus = {
    asia: sessions.asia === "活跃" ? "可交易" : "已收盘",
    europe: sessions.europe === "活跃" ? "可交易" : "已收盘",
    us: sessions.us === "活跃" ? "可交易" : "已收盘",
  };

  // Generate summary
  const changeDir = quote.change >= 0 ? "上涨" : "下跌";
  const summary = `XAUUSD 当前 ${quote.price.toFixed(2)}，日内${changeDir} ${Math.abs(quote.change).toFixed(2)} (${Math.abs(quote.changePercent).toFixed(2)}%)。` +
    `箱体区间 ${keyLevels.boxBottom.toFixed(0)}-${keyLevels.boxTop.toFixed(0)}，` +
    `${bias === "bullish" ? "关注上方阻力 " + keyLevels.resistance1.toFixed(0) + " 突破情况" : 
      bias === "bearish" ? "关注下方支撑 " + keyLevels.support1.toFixed(0) + " 支撑力度" : 
      "价格在箱体内震荡，等待方向选择"}`;

  return {
    bias,
    biasLabel,
    confidence,
    keyLevels,
    riskStatus,
    riskLabel,
    summary,
    sessions: sessionStatus,
  };
}

// ========== Helpers ==========

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getDefaultQuote(): MarketQuote {
  return {
    symbol: "XAUUSD",
    price: 0,
    change: 0,
    changePercent: 0,
    high: 0,
    low: 0,
    open: 0,
    timestamp: new Date().toISOString(),
  };
}

function getDefaultKeyLevels(): KeyLevels {
  return {
    resistance1: 0,
    resistance2: 0,
    support1: 0,
    support2: 0,
    boxTop: 0,
    boxBottom: 0,
  };
}

// ========== Background Cache Warming ==========

let warmingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 后台预热缓存：服务器启动时预加载数据，并定期后台刷新
 * 这样用户请求时总是命中缓存，不用等待外部API
 */
export function startCacheWarming() {
  // Immediate warm-up
  warmCache();
  // Refresh every 25 seconds (just under quote TTL of 30s)
  warmingInterval = setInterval(warmCache, 25 * 1000);
  console.log("[MarketData] Background cache warming started (25s interval)");
}

async function warmCache() {
  try {
    await getRealQuote();
  } catch (e) {
    // silent - cache warming is best-effort
  }
  try {
    // Only refresh daily/intraday if stale (they have longer TTLs)
    if (!isCacheValid(cache.dailyData, CACHE_TTL.daily)) {
      await getDailyData();
    }
    if (!isCacheValid(cache.intradayData, CACHE_TTL.intraday)) {
      await getIntradayData();
    }
  } catch (e) {
    // silent
  }
}

export function stopCacheWarming() {
  if (warmingInterval) {
    clearInterval(warmingInterval);
    warmingInterval = null;
  }
}
