/**
 * XAUUSD 现货黄金行情数据模块
 *
 * 数据源策略（多源融合 + 优雅降级）：
 * 1. 主数据源：fawazahmed0 Currency API — 免费、无需 API Key、提供真实 XAU/USD 现货汇率
 * 2. 辅助数据源：YahooFinance GC=F（COMEX 黄金期货）— 提供日内 OHLCV 和多周期 K 线数据
 *
 * 降级策略：
 * - 当 GC=F 不可用（限速等）时，仅用现货价格也能返回有效报价
 * - 关键位和 Bias 在无 GC=F 数据时使用基于现货价格的估算值
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
  dailyBias?: CacheEntry<DailyBiasData>;
} = {};

const CACHE_TTL = {
  quote: 5 * 1000,            // 5 seconds for real-time quote
  spotPrice: 60 * 1000,       // 1 minute for spot price
  intraday: 2 * 60 * 1000,    // 2 minutes for intraday data
  daily: 10 * 60 * 1000,      // 10 minutes for daily data
  weekly: 60 * 60 * 1000,     // 1 hour for weekly data
  monthly: 2 * 60 * 60 * 1000, // 2 hours for monthly data
  dailyBias: 30 * 1000,       // 30 seconds for daily bias
};

function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < ttl;
}

// ========== Spot Price Source (fawazahmed0 Currency API) ==========

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
    } catch {
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

  // Case 1: Both available — full calibration
  if (futuresData && spotPrice && spotPrice > 1000) {
    const meta = futuresData.meta;
    const quotes = futuresData.indicators.quote[0];
    const closes = quotes.close.filter((c): c is number => c !== null);
    const futuresPrice = meta.regularMarketPrice;
    const calibrationRatio = spotPrice / futuresPrice;

    const prevFuturesClose = closes.length >= 2 ? closes[closes.length - 2]! : meta.chartPreviousClose;
    const prevClose = round2(prevFuturesClose * calibrationRatio);
    const change = spotPrice - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const high = calibrateToSpot(meta.regularMarketDayHigh, spotPrice, futuresPrice);
    const low = calibrateToSpot(meta.regularMarketDayLow, spotPrice, futuresPrice);

    const opens = quotes.open.filter((o): o is number => o !== null);
    const rawOpen = opens.length > 0 ? opens[opens.length - 1]! : futuresPrice;
    const open = calibrateToSpot(rawOpen, spotPrice, futuresPrice);

    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(spotPrice),
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

  // Case 2: Only spot price available (GC=F rate limited)
  if (spotPrice && spotPrice > 1000) {
    // Use spot price as the main price, estimate OHLC based on typical daily range (~0.5-1%)
    const typicalRange = spotPrice * 0.005; // 0.5% typical daily range
    const prevQuote = (cache as { quote?: CacheEntry<MarketQuote> }).quote?.data;

    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(spotPrice),
      change: prevQuote ? round2(spotPrice - prevQuote.open) : 0,
      changePercent: prevQuote && prevQuote.open > 0 ? round2(((spotPrice - prevQuote.open) / prevQuote.open) * 100) : 0,
      high: prevQuote?.high && prevQuote.high > spotPrice ? round2(prevQuote.high) : round2(spotPrice + typicalRange * 0.3),
      low: prevQuote?.low && prevQuote.low < spotPrice && prevQuote.low > 1000 ? round2(prevQuote.low) : round2(spotPrice - typicalRange * 0.7),
      open: prevQuote?.open && prevQuote.open > 1000 ? round2(prevQuote.open) : round2(spotPrice),
      timestamp: new Date().toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    return quoteData;
  }

  // Case 3: Only futures data available (fawazahmed0 failed)
  if (futuresData) {
    const meta = futuresData.meta;
    const quotes = futuresData.indicators.quote[0];
    const closes = quotes.close.filter((c): c is number => c !== null);
    const prevClose = closes.length >= 2 ? closes[closes.length - 2]! : meta.chartPreviousClose;
    const change = meta.regularMarketPrice - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const opens = quotes.open.filter((o): o is number => o !== null);
    const rawOpen = opens.length > 0 ? opens[opens.length - 1]! : meta.regularMarketPrice;

    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(meta.regularMarketPrice),
      change: round2(change),
      changePercent: round2(changePercent),
      high: round2(meta.regularMarketDayHigh),
      low: round2(meta.regularMarketDayLow),
      open: round2(rawOpen),
      timestamp: new Date(meta.regularMarketTime * 1000).toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    return quoteData;
  }

  // Case 4: Both failed — return cached or throw
  const cachedQuote = (cache as { quote?: CacheEntry<MarketQuote> }).quote;
  if (cachedQuote?.data) {
    return cachedQuote.data;
  }
  throw new Error("No market data available from any source");
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
 */
async function getCalibrationRatio(): Promise<number> {
  const spotPrice = await fetchSpotGoldPrice();
  if (!spotPrice || spotPrice <= 1000) return 1;

  const futuresData = cache.dailyData?.data ?? await fetchGoldChart("1d", "5d");
  if (!futuresData) return 1;

  const futuresPrice = futuresData.meta.regularMarketPrice;
  if (futuresPrice <= 1000) return 1;

  return spotPrice / futuresPrice;
}

/**
 * 计算关键位
 * 基于多周期数据计算支撑阻力位和箱体，并校准到现货价格
 * 当 GC=F 不可用时，基于现货价格生成估算关键位
 */
export async function calculateKeyLevels(): Promise<KeyLevels> {
  const [dailyData, intradayData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
  ]);

  // If we have daily data, use full calculation
  if (dailyData) {
    const ratio = await getCalibrationRatio();
    const quotes = dailyData.indicators.quote[0];
    const highs = quotes.high.filter((h): h is number => h !== null);
    const lows = quotes.low.filter((l): l is number => l !== null);
    const closes = quotes.close.filter((c): c is number => c !== null);

    if (highs.length >= 5 && lows.length >= 5) {
      const recentHighs = highs.slice(-10);
      const recentLows = lows.slice(-10);

      const boxTop = round2(Math.max(...recentHighs.slice(-5)) * ratio);
      const boxBottom = round2(Math.min(...recentLows.slice(-5)) * ratio);

      const lastHigh = highs[highs.length - 1]!;
      const lastLow = lows[lows.length - 1]!;
      const lastClose = closes[closes.length - 1]!;
      const pivot = (lastHigh + lastLow + lastClose) / 3;

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
  }

  // Fallback: estimate key levels from spot price
  const spotPrice = await fetchSpotGoldPrice();
  if (spotPrice && spotPrice > 1000) {
    return estimateKeyLevels(spotPrice);
  }

  // Last resort: use cached quote price
  if (cache.quote?.data && cache.quote.data.price > 1000) {
    return estimateKeyLevels(cache.quote.data.price);
  }

  return getDefaultKeyLevels();
}

/**
 * 基于现货价格估算关键位（当 GC=F 不可用时的降级方案）
 * 使用典型的日内波动幅度来估算
 */
function estimateKeyLevels(price: number): KeyLevels {
  const dailyRange = price * 0.008; // ~0.8% typical daily range for gold
  const halfRange = dailyRange / 2;

  return {
    resistance1: round2(price + halfRange),
    resistance2: round2(price + dailyRange),
    support1: round2(price - halfRange),
    support2: round2(price - dailyRange),
    boxTop: round2(price + halfRange * 0.6),
    boxBottom: round2(price - halfRange * 0.6),
  };
}

// ========== Daily Bias ==========

/**
 * 基于真实数据计算今日偏向
 * 当 GC=F 不可用时，基于现货价格和缓存数据给出基本判断
 */
export async function getRealDailyBias(): Promise<DailyBiasData> {
  if (isCacheValid(cache.dailyBias, CACHE_TTL.dailyBias)) {
    return cache.dailyBias.data;
  }

  const [quote, keyLevels, dailyData] = await Promise.all([
    getRealQuote().catch(() => null),
    calculateKeyLevels(),
    getDailyData(),
  ]);

  const price = quote?.price ?? cache.quote?.data?.price ?? 0;

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

      const trend5 = recent5[recent5.length - 1]! - recent5[0]!;
      const trend3 = recent3[recent3.length - 1]! - recent3[0]!;
      const boxMid = (keyLevels.boxTop + keyLevels.boxBottom) / 2;
      const priceVsBox = price - boxMid;

      let bullishScore = 0;
      let bearishScore = 0;

      if (trend5 > 0) bullishScore += 2; else bearishScore += 2;
      if (trend3 > 0) bullishScore += 1.5; else bearishScore += 1.5;
      if (quote && quote.change > 0) bullishScore += 1; else bearishScore += 1;
      if (priceVsBox > 0) bullishScore += 1; else bearishScore += 1;

      const rangeSize = keyLevels.resistance1 - keyLevels.support1;
      if (rangeSize > 0) {
        const pricePosition = (price - keyLevels.support1) / rangeSize;
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
  } else if (quote) {
    // No daily data: simple bias from today's change
    if (quote.change > 0 && quote.changePercent > 0.2) {
      bias = "bullish";
      biasLabel = "偏多";
      confidence = "low";
    } else if (quote.change < 0 && quote.changePercent < -0.2) {
      bias = "bearish";
      biasLabel = "偏空";
      confidence = "low";
    } else {
      bias = "ranging";
      biasLabel = "震荡";
      confidence = "low";
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
    asia: utcHour >= 0 && utcHour < 8 ? "可交易" : "已收盘",
    europe: utcHour >= 7 && utcHour < 16 ? "可交易" : "已收盘",
    us: utcHour >= 13 && utcHour < 22 ? "可交易" : "已收盘",
  };

  // Generate summary
  const changeDir = quote && quote.change >= 0 ? "上涨" : "下跌";
  const changeAbs = quote ? Math.abs(quote.change).toFixed(2) : "0.00";
  const changePctAbs = quote ? Math.abs(quote.changePercent).toFixed(2) : "0.00";
  const summary = `XAUUSD 现货 ${price.toFixed(2)}，日内${changeDir} ${changeAbs} (${changePctAbs}%)。` +
    `箱体区间 ${keyLevels.boxBottom.toFixed(0)}-${keyLevels.boxTop.toFixed(0)}，` +
    `${bias === "bullish" ? "关注上方阻力 " + keyLevels.resistance1.toFixed(0) + " 突破情况" :
      bias === "bearish" ? "关注下方支撑 " + keyLevels.support1.toFixed(0) + " 支撑力度" :
      "价格在箱体内震荡，等待方向选择"}`;

  const result: DailyBiasData = {
    bias,
    biasLabel,
    confidence,
    keyLevels,
    riskStatus,
    riskLabel,
    summary,
    sessions,
  };

  cache.dailyBias = { data: result, timestamp: Date.now() };
  return result;
}

// ========== Helpers ==========

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
 * 分阶段预热：先加载现货价格（快速），再加载 GC=F 数据（可能慢/限速）
 */
export function startCacheWarming() {
  // Immediate warm-up: spot price first (fast and reliable)
  fetchSpotGoldPrice().then(() => {
    console.log("[MarketData] Spot price pre-loaded");
    // Then try GC=F data (may be rate limited)
    getRealQuote().catch(() => console.log("[MarketData] Initial GC=F fetch failed, will retry"));
  });

  // Staggered warm-up for daily/intraday data
  setTimeout(() => {
    getDailyData().catch(() => {});
    getIntradayData().catch(() => {});
  }, 5000);

  // Regular refresh: every 30 seconds (reduced frequency to avoid rate limits)
  warmingInterval = setInterval(async () => {
    try {
      await getRealQuote();
    } catch {
      // silent
    }
    // Only refresh daily/intraday if cache expired
    try {
      if (!isCacheValid(cache.dailyData, CACHE_TTL.daily)) {
        await getDailyData();
      }
    } catch {
      // silent
    }
  }, 30 * 1000);

  console.log("[MarketData] Background cache warming started (30s interval, multi-source with graceful degradation)");
}

export function stopCacheWarming() {
  if (warmingInterval) {
    clearInterval(warmingInterval);
    warmingInterval = null;
  }
}
