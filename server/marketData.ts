/**
 * XAUUSD 现货黄金行情数据模块
 *
 * 数据源策略（多源融合）：
 * 1. 主数据源：fawazahmed0 Currency API — 免费、无需 API Key、提供真实 XAU/USD 现货汇率
 * 2. 辅助数据源：YahooFinance GC=F（COMEX 黄金期货）— 提供日内 OHLCV 和多周期 K 线数据
 *
 * 现货价格以 fawazahmed0 为基准；日内高低开收、多周期数据仍使用 GC=F，
 * 但通过现货/期货价差比例进行校准，使前端展示的始终是近似现货价格。
 */
import { callDataApi } from "./_core/dataApi";
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
  spotPrice?: CacheEntry<number>;
  dailyData?: CacheEntry<YahooChartResult>;
  weeklyData?: CacheEntry<YahooChartResult>;
  monthlyData?: CacheEntry<YahooChartResult>;
  intradayData?: CacheEntry<YahooChartResult>;
} = {};

const CACHE_TTL = {
  quote: 5 * 1000,            // 5 seconds for real-time quote
  spotPrice: 60 * 1000,       // 1 minute for spot price (fawazahmed0 updates daily, but we cache short)
  intraday: 2 * 60 * 1000,    // 2 minutes for intraday data
  daily: 10 * 60 * 1000,      // 10 minutes for daily data
  weekly: 60 * 60 * 1000,     // 1 hour for weekly data
  monthly: 2 * 60 * 60 * 1000, // 2 hours for monthly data
};

function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < ttl;
}

// ========== Spot Price Source (fawazahmed0 Currency API) ==========

/**
 * 从 fawazahmed0 Currency API 获取 XAU/USD 现货价格
 * 该 API 免费、无需 Key，每日更新，提供真实的外汇市场现货汇率
 * 使用多个 CDN 端点做容灾
 */
async function fetchSpotGoldPrice(): Promise<number | null> {
  if (isCacheValid(cache.spotPrice, CACHE_TTL.spotPrice)) {
    return cache.spotPrice.data;
  }

  const endpoints = [
    "https://latest.currency-api.pages.dev/v1/currencies/xau.json",
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.min.json",
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.json",
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const data = await response.json() as { date?: string; xau?: Record<string, number> };
      const usdPrice = data?.xau?.usd;

      if (typeof usdPrice === "number" && usdPrice > 1000) {
        console.log(`[MarketData] Spot XAU/USD from fawazahmed0: $${usdPrice.toFixed(2)} (date: ${data.date ?? "unknown"})`);
        cache.spotPrice = { data: usdPrice, timestamp: Date.now() };
        return usdPrice;
      }
    } catch (error) {
      // Try next endpoint
      continue;
    }
  }

  console.warn("[MarketData] All fawazahmed0 endpoints failed");
  return cache.spotPrice?.data ?? null;
}

// ========== GC=F Futures Data (Yahoo Finance) ==========

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

// ========== Price Calibration ==========

/**
 * 将期货价格校准为现货价格
 * 使用 spotPrice / futuresPrice 的比率来调整所有 GC=F 数据点
 */
function calibrateToSpot(futuresPrice: number, spotPrice: number, futuresRef: number): number {
  if (futuresRef <= 0 || spotPrice <= 0) return futuresPrice;
  const ratio = spotPrice / futuresRef;
  return round2(futuresPrice * ratio);
}

// ========== Real-time Quote ==========

export async function getRealQuote(): Promise<MarketQuote> {
  if (isCacheValid(cache.quote, CACHE_TTL.quote)) {
    return cache.quote.data;
  }

  // Fetch both spot price and futures data in parallel
  const [spotPrice, futuresData] = await Promise.all([
    fetchSpotGoldPrice(),
    fetchGoldChart("1d", "5d"),
  ]);

  if (!futuresData) {
    console.warn("[MarketData] Falling back to cached or default quote");
    return (cache.quote as CacheEntry<MarketQuote> | undefined)?.data ?? getDefaultQuote();
  }

  const meta = futuresData.meta;
  const quotes = futuresData.indicators.quote[0];
  const closes = quotes.close.filter((c): c is number => c !== null);
  const futuresPrice = meta.regularMarketPrice;

  // Determine the display price: prefer spot, fallback to futures
  let displayPrice: number;
  let calibrationRatio = 1;

  if (spotPrice && spotPrice > 1000) {
    displayPrice = spotPrice;
    calibrationRatio = spotPrice / futuresPrice;
  } else {
    displayPrice = futuresPrice;
  }

  // Calculate change from previous close (calibrated)
  const prevFuturesClose = closes.length >= 2 ? closes[closes.length - 2]! : meta.chartPreviousClose;
  const prevClose = calibrationRatio !== 1 ? round2(prevFuturesClose * calibrationRatio) : prevFuturesClose;
  const change = displayPrice - prevClose;
  const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

  // Calibrate high/low/open
  const high = calibrationRatio !== 1
    ? calibrateToSpot(meta.regularMarketDayHigh, displayPrice, futuresPrice)
    : round2(meta.regularMarketDayHigh);
  const low = calibrationRatio !== 1
    ? calibrateToSpot(meta.regularMarketDayLow, displayPrice, futuresPrice)
    : round2(meta.regularMarketDayLow);

  const opens = quotes.open.filter((o): o is number => o !== null);
  const rawOpen = opens.length > 0 ? opens[opens.length - 1]! : futuresPrice;
  const open = calibrationRatio !== 1
    ? calibrateToSpot(rawOpen, displayPrice, futuresPrice)
    : round2(rawOpen);

  const quoteData: MarketQuote = {
    symbol: "XAUUSD",
    price: round2(displayPrice),
    change: round2(change),
    changePercent: round2(changePercent),
    high: round2(high),
    low: round2(low),
    open: round2(open),
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
 * 获取现货/期货校准比率
 * 用于将 GC=F 的关键位数据校准到现货价格水平
 */
async function getCalibrationRatio(): Promise<number> {
  const spotPrice = await fetchSpotGoldPrice();
  if (!spotPrice || spotPrice <= 1000) return 1;

  // Get latest futures price from cache or fetch
  const futuresData = await fetchGoldChart("1d", "5d");
  if (!futuresData) return 1;

  const futuresPrice = futuresData.meta.regularMarketPrice;
  if (futuresPrice <= 1000) return 1;

  return spotPrice / futuresPrice;
}

/**
 * 计算关键位
 * 基于多周期数据计算支撑阻力位和箱体，并校准到现货价格
 */
export async function calculateKeyLevels(): Promise<KeyLevels> {
  const [dailyData, intradayData, ratio] = await Promise.all([
    getDailyData(),
    getIntradayData(),
    getCalibrationRatio(),
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

  // Box: recent range (calibrated to spot)
  const boxTop = round2(Math.max(...recentHighs.slice(-5)) * ratio);
  const boxBottom = round2(Math.min(...recentLows.slice(-5)) * ratio);

  // Pivot point calculation (classic)
  const lastHigh = highs[highs.length - 1]!;
  const lastLow = lows[lows.length - 1]!;
  const lastClose = closes[closes.length - 1]!;
  const pivot = (lastHigh + lastLow + lastClose) / 3;

  // Resistance and Support levels (calibrated to spot)
  const resistance1 = round2((2 * pivot - lastLow) * ratio);
  const resistance2 = round2((pivot + (lastHigh - lastLow)) * ratio);
  const support1 = round2((2 * pivot - lastHigh) * ratio);
  const support2 = round2((pivot - (lastHigh - lastLow)) * ratio);

  // Enhance with intraday data if available
  if (intradayData) {
    const intradayQuotes = intradayData.indicators.quote[0];
    const intradayHighs = intradayQuotes.high.filter((h): h is number => h !== null);
    const intradayLows = intradayQuotes.low.filter((l): l is number => l !== null);

    if (intradayHighs.length > 0 && intradayLows.length > 0) {
      const todayHigh = Math.max(...intradayHighs.slice(-20)) * ratio;
      const todayLow = Math.min(...intradayLows.slice(-20)) * ratio;

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
    const ratio = await getCalibrationRatio();
    const closes = dailyData.indicators.quote[0].close
      .filter((c): c is number => c !== null)
      .map((c) => c * ratio);

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
        if (pricePosition > 0.8) bearishScore += 0.5;
        if (pricePosition < 0.2) bullishScore += 0.5;
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

  const sessionStatus = {
    asia: sessions.asia === "活跃" ? "可交易" : "已收盘",
    europe: sessions.europe === "活跃" ? "可交易" : "已收盘",
    us: sessions.us === "活跃" ? "可交易" : "已收盘",
  };

  // Generate summary
  const changeDir = quote.change >= 0 ? "上涨" : "下跌";
  const summary = `XAUUSD 现货 ${quote.price.toFixed(2)}，日内${changeDir} ${Math.abs(quote.change).toFixed(2)} (${Math.abs(quote.changePercent).toFixed(2)}%)。` +
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
  // Refresh every 15 seconds to avoid API rate limits
  warmingInterval = setInterval(warmCache, 15 * 1000);
  console.log("[MarketData] Background cache warming started (15s interval, multi-source)");
}

async function warmCache() {
  try {
    await getRealQuote();
  } catch (e) {
    // silent - cache warming is best-effort
  }
  try {
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
