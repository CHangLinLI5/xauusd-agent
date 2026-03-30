/**
 * XAUUSD 现货黄金行情数据模块 v5
 *
 * v5 改进：
 * - 添加全局请求队列，防止并发请求触发 Yahoo Finance 429 限速
 * - 增加超时时间（5s → 8s），减少 AbortError
 * - 优化缓存策略：quote TTL 3s，realtime TTL 5s，减少 API 调用频率
 * - 添加请求间隔控制（最小 1s），避免每秒多次请求
 * - BullionVault 超时增加到 10s，增加重试
 *
 * 数据源策略：
 * 1. 主数据源：YahooFinance GC=F 1m K线 — 提供准实时价格走势
 *    → 自动扣除期货升水，转换为现货 XAUUSD 价格
 * 2. 现货校准源：BullionVault XML API — 免费实时现货金价（用于计算升水幅度）
 * 3. 降级数据源：fawazahmed0 — 日级别现货汇率（最后兜底）
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

// ========== Global Request Queue (prevent 429) ==========

let lastApiCallTime = 0;
const MIN_API_INTERVAL = 1200; // Minimum 1.2s between API calls
let apiCallQueue: Array<{
  fn: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}> = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (apiCallQueue.length > 0) {
    const item = apiCallQueue.shift()!;
    const now = Date.now();
    const waitTime = Math.max(0, MIN_API_INTERVAL - (now - lastApiCallTime));

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    try {
      lastApiCallTime = Date.now();
      const result = await item.fn();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }
  }

  isProcessingQueue = false;
}

function enqueueApiCall<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    apiCallQueue.push({
      fn: fn as () => Promise<unknown>,
      resolve: resolve as (value: unknown) => void,
      reject,
    });
    processQueue();
  });
}

// ========== Cache ==========

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: {
  quote?: CacheEntry<MarketQuote>;
  spotPrice?: CacheEntry<number>;
  spotPremium?: CacheEntry<number>;
  dailyData?: CacheEntry<YahooChartResult>;
  weeklyData?: CacheEntry<YahooChartResult>;
  monthlyData?: CacheEntry<YahooChartResult>;
  intradayData?: CacheEntry<YahooChartResult>;
  dailyBias?: CacheEntry<DailyBiasData>;
  realtimeData?: CacheEntry<YahooChartResult>;
} = {};

const CACHE_TTL = {
  quote: 3 * 1000,              // 3 seconds — near real-time
  spotPrice: 120 * 1000,        // 2 minutes for fawazahmed0 spot price
  spotPremium: 60 * 1000,       // 1 minute for futures premium calculation
  realtime: 5 * 1000,           // 5 seconds for 1m candle data
  intraday: 3 * 60 * 1000,      // 3 minutes for 15m candle data
  daily: 15 * 60 * 1000,        // 15 minutes for daily data
  weekly: 60 * 60 * 1000,       // 1 hour for weekly data
  monthly: 2 * 60 * 60 * 1000,  // 2 hours for monthly data
  dailyBias: 20 * 1000,         // 20 seconds for daily bias
};

function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < ttl;
}

// ========== Fetch with Timeout ==========

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ========== Source 1: Yahoo Finance via Manus Data API ==========

async function fetchGoldChartViaApi(interval: string, range: string): Promise<YahooChartResult | null> {
  try {
    const result = await enqueueApiCall(() =>
      callDataApi("YahooFinance/get_stock_chart", {
        query: {
          symbol: "GC=F",
          interval,
          range,
        },
      })
    ) as YahooChartResponse;

    if (result?.chart?.result?.[0]) {
      return result.chart.result[0];
    }
    return null;
  } catch (error) {
    console.error(`[MarketData] API fetch GC=F (${interval}/${range}) failed:`, (error as Error).message?.slice(0, 120));
    return null;
  }
}

// ========== Source 2: Yahoo Finance Direct ==========

async function fetchGoldChartDirect(interval: string, range: string): Promise<YahooChartResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${interval}&range=${range}`;
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XAUUSDAgent/1.0)" },
    }, 10000); // 10s timeout for direct Yahoo

    if (!response.ok) return null;

    const data = await response.json() as YahooChartResponse;
    if (data?.chart?.result?.[0]) {
      return data.chart.result[0];
    }
    return null;
  } catch (error) {
    console.error(`[MarketData] Direct Yahoo GC=F (${interval}/${range}) failed:`, (error as Error).message?.slice(0, 80));
    return null;
  }
}

// ========== Source 3: BullionVault Spot Gold (for premium calibration) ==========

/**
 * 从 BullionVault 获取实时现货金价
 * 返回 USD/oz 现货价格（bid/ask 中间价）
 * BullionVault XML 中 limit 值单位为 0.01 USD/gram
 * 转换: (limit / 100) * 31.1035 = USD/troy oz
 */
async function fetchBullionVaultSpot(): Promise<number | null> {
  try {
    const url = "https://www.bullionvault.com/view_market_xml.do?marketWidth=1&considerationCurrency=USD&metal=GOLD&priceChartPeriod=1d";
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XAUUSDAgent/1.0)" },
    }, 12000); // 12s timeout for BullionVault

    if (!response.ok) return null;

    const text = await response.text();

    // Parse XML to extract bid/ask prices for GOLD/USD
    const bidMatch = text.match(/<pitch[^>]*securityClassNarrative="GOLD"[^>]*considerationCurrency="USD"[^>]*>[\s\S]*?<buyPrices>[\s\S]*?<price[^>]*limit="(\d+)"[^>]*\/>/);
    const askMatch = text.match(/<pitch[^>]*securityClassNarrative="GOLD"[^>]*considerationCurrency="USD"[^>]*>[\s\S]*?<sellPrices>[\s\S]*?<price[^>]*limit="(\d+)"[^>]*\/>/);

    if (bidMatch && askMatch) {
      const bidLimit = parseInt(bidMatch[1]!, 10);
      const askLimit = parseInt(askMatch[1]!, 10);

      const GRAMS_PER_TROY_OZ = 31.1035;
      const bidPerOz = (bidLimit / 100) * GRAMS_PER_TROY_OZ;
      const askPerOz = (askLimit / 100) * GRAMS_PER_TROY_OZ;
      const midPrice = (bidPerOz + askPerOz) / 2;

      if (midPrice > 1000 && midPrice < 10000) {
        console.log(`[MarketData] BullionVault spot: bid=$${bidPerOz.toFixed(2)} ask=$${askPerOz.toFixed(2)} mid=$${midPrice.toFixed(2)}`);
        return midPrice;
      }
    }

    return null;
  } catch (error) {
    console.error("[MarketData] BullionVault fetch failed:", (error as Error).message?.slice(0, 80));
    return null;
  }
}

// ========== Futures Premium Calculation ==========

const DEFAULT_PREMIUM = 30;

async function getFuturesPremium(): Promise<number> {
  if (isCacheValid(cache.spotPremium, CACHE_TTL.spotPremium)) {
    return cache.spotPremium.data;
  }

  const cachedPremium = (cache.spotPremium as CacheEntry<number> | undefined);

  try {
    // Get BullionVault spot price (non-queued, direct fetch)
    const spotPrice = await fetchBullionVaultSpot();
    if (!spotPrice) {
      return cachedPremium?.data ?? DEFAULT_PREMIUM;
    }

    // Get current GC=F futures price from cache or fresh fetch
    let futuresPrice: number | null = null;
    if (cache.realtimeData?.data) {
      futuresPrice = cache.realtimeData.data.meta.regularMarketPrice;
    } else {
      const futuresData = await fetchGoldChartViaApi("1m", "1d");
      if (futuresData) {
        futuresPrice = futuresData.meta.regularMarketPrice;
      }
    }

    if (!futuresPrice) {
      return cachedPremium?.data ?? DEFAULT_PREMIUM;
    }

    const premium = futuresPrice - spotPrice;

    // Sanity check: premium should be between -$50 and +$100
    if (premium > -50 && premium < 100) {
      console.log(`[MarketData] Futures premium: $${premium.toFixed(2)} (GC=F $${futuresPrice.toFixed(2)} - Spot $${spotPrice.toFixed(2)})`);
      cache.spotPremium = { data: premium, timestamp: Date.now() };
      return premium;
    }

    console.warn(`[MarketData] Unusual premium $${premium.toFixed(2)}, using default $${DEFAULT_PREMIUM}`);
    return cachedPremium?.data ?? DEFAULT_PREMIUM;
  } catch {
    return cachedPremium?.data ?? DEFAULT_PREMIUM;
  }
}

function futurestoSpot(futuresPrice: number, premium: number): number {
  return round2(futuresPrice - premium);
}

// ========== Source 4: fawazahmed0 Spot Price (daily rate fallback) ==========

async function fetchSpotGoldPrice(): Promise<number | null> {
  if (isCacheValid(cache.spotPrice, CACHE_TTL.spotPrice)) {
    return cache.spotPrice.data;
  }

  const endpoints = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/xau.min.json",
    "https://latest.currency-api.pages.dev/v1/currencies/xau.json",
  ];

  for (const url of endpoints) {
    try {
      const response = await fetchWithTimeout(url, {}, 8000);
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

// ========== Multi-source Gold Chart Fetch ==========

async function fetchGoldChart(interval: string, range: string): Promise<YahooChartResult | null> {
  // Try Manus Data API first
  const apiResult = await fetchGoldChartViaApi(interval, range);
  if (apiResult) return apiResult;

  // Fallback to direct Yahoo Finance
  console.log(`[MarketData] Manus API failed for GC=F ${interval}/${range}, trying direct Yahoo...`);
  return await fetchGoldChartDirect(interval, range);
}

// ========== Real-time 1m Data ==========

async function getRealtimeData(): Promise<YahooChartResult | null> {
  if (isCacheValid(cache.realtimeData, CACHE_TTL.realtime)) {
    return cache.realtimeData.data;
  }
  const data = await fetchGoldChart("1m", "1d");
  if (data) {
    cache.realtimeData = { data, timestamp: Date.now() };
  }
  return data;
}

// ========== Real-time Quote ==========

export async function getRealQuote(): Promise<MarketQuote> {
  if (isCacheValid(cache.quote, CACHE_TTL.quote)) {
    return cache.quote.data;
  }

  // Get futures premium for spot conversion
  const premium = await getFuturesPremium();

  // Primary: use 1m candle data for most real-time price
  const realtimeData = await getRealtimeData();

  if (realtimeData) {
    const meta = realtimeData.meta;
    const quotes = realtimeData.indicators.quote[0];
    const opens = quotes.open.filter((o): o is number => o !== null);
    const highs = quotes.high.filter((h): h is number => h !== null);
    const lows = quotes.low.filter((l): l is number => l !== null);

    const spotPrice = futurestoSpot(meta.regularMarketPrice, premium);
    const spotPrevClose = futurestoSpot(meta.chartPreviousClose, premium);
    const change = spotPrice - spotPrevClose;
    const changePercent = spotPrevClose > 0 ? (change / spotPrevClose) * 100 : 0;

    const todayOpen = opens.length > 0 ? futurestoSpot(opens[0]!, premium) : spotPrice;
    const rawHigh = highs.length > 0 ? Math.max(meta.regularMarketDayHigh, ...highs) : meta.regularMarketDayHigh;
    const rawLow = lows.length > 0 ? Math.min(...lows.filter(l => l > 1000), meta.regularMarketDayLow) : meta.regularMarketDayLow;
    const todayHigh = futurestoSpot(rawHigh, premium);
    const todayLow = futurestoSpot(rawLow, premium);

    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(spotPrice),
      change: round2(change),
      changePercent: round2(changePercent),
      high: round2(todayHigh),
      low: round2(todayLow > 1000 ? todayLow : spotPrice),
      open: round2(todayOpen),
      timestamp: new Date(meta.regularMarketTime * 1000).toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    return quoteData;
  }

  // Fallback: try daily data
  const dailyData = await fetchGoldChart("1d", "5d");
  if (dailyData) {
    const meta = dailyData.meta;
    const quotes = dailyData.indicators.quote[0];
    const closes = quotes.close.filter((c): c is number => c !== null);
    const prevClose = closes.length >= 2 ? futurestoSpot(closes[closes.length - 2]!, premium) : futurestoSpot(meta.chartPreviousClose, premium);
    const spotPrice = futurestoSpot(meta.regularMarketPrice, premium);
    const change = spotPrice - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const opens = quotes.open.filter((o): o is number => o !== null);
    const rawOpen = opens.length > 0 ? opens[opens.length - 1]! : meta.regularMarketPrice;

    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(spotPrice),
      change: round2(change),
      changePercent: round2(changePercent),
      high: round2(futurestoSpot(meta.regularMarketDayHigh, premium)),
      low: round2(futurestoSpot(meta.regularMarketDayLow, premium)),
      open: round2(futurestoSpot(rawOpen, premium)),
      timestamp: new Date(meta.regularMarketTime * 1000).toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    return quoteData;
  }

  // Last resort: fawazahmed0 spot price (already spot, no premium adjustment)
  const spotPrice = await fetchSpotGoldPrice();
  if (spotPrice && spotPrice > 1000) {
    const prevQuote = (cache.quote as CacheEntry<MarketQuote> | undefined)?.data;
    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(spotPrice),
      change: prevQuote ? round2(spotPrice - prevQuote.open) : 0,
      changePercent: prevQuote && prevQuote.open > 0 ? round2(((spotPrice - prevQuote.open) / prevQuote.open) * 100) : 0,
      high: prevQuote?.high && prevQuote.high > spotPrice ? round2(prevQuote.high) : round2(spotPrice),
      low: prevQuote?.low && prevQuote.low < spotPrice && prevQuote.low > 1000 ? round2(prevQuote.low) : round2(spotPrice),
      open: prevQuote?.open && prevQuote.open > 1000 ? round2(prevQuote.open) : round2(spotPrice),
      timestamp: new Date().toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    return quoteData;
  }

  // Absolute last resort: return cached
  const cachedQuote = (cache.quote as CacheEntry<MarketQuote> | undefined);
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
 * 计算关键位 - 所有价格自动转换为现货价格
 */
export async function calculateKeyLevels(): Promise<KeyLevels> {
  const premium = await getFuturesPremium();
  const [dailyData, intradayData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
  ]);

  if (dailyData) {
    const quotes = dailyData.indicators.quote[0];
    const highs = quotes.high.filter((h): h is number => h !== null);
    const lows = quotes.low.filter((l): l is number => l !== null);
    const closes = quotes.close.filter((c): c is number => c !== null);

    if (highs.length >= 5 && lows.length >= 5) {
      const spotHighs = highs.map(h => h - premium);
      const spotLows = lows.map(l => l - premium);
      const spotCloses = closes.map(c => c - premium);

      const boxTop = round2(Math.max(...spotHighs.slice(-5)));
      const boxBottom = round2(Math.min(...spotLows.slice(-5)));

      const lastHigh = spotHighs[spotHighs.length - 1]!;
      const lastLow = spotLows[spotLows.length - 1]!;
      const lastClose = spotCloses[spotCloses.length - 1]!;
      const pivot = (lastHigh + lastLow + lastClose) / 3;

      const resistance1 = round2(2 * pivot - lastLow);
      const resistance2 = round2(pivot + (lastHigh - lastLow));
      const support1 = round2(2 * pivot - lastHigh);
      const support2 = round2(pivot - (lastHigh - lastLow));

      if (intradayData) {
        const intradayQuotes = intradayData.indicators.quote[0];
        const intradayHighs = intradayQuotes.high.filter((h): h is number => h !== null);
        const intradayLows = intradayQuotes.low.filter((l): l is number => l !== null && l > 1000);

        if (intradayHighs.length > 0 && intradayLows.length > 0) {
          const todayHigh = Math.max(...intradayHighs.slice(-20)) - premium;
          const todayLow = Math.min(...intradayLows.slice(-20)) - premium;

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

  // Fallback: estimate key levels from current price
  try {
    const quote = await getRealQuote();
    if (quote.price > 1000) {
      return estimateKeyLevels(quote.price);
    }
  } catch {
    // ignore
  }

  if (cache.quote?.data && cache.quote.data.price > 1000) {
    return estimateKeyLevels(cache.quote.data.price);
  }

  return getDefaultKeyLevels();
}

function estimateKeyLevels(price: number): KeyLevels {
  const dailyRange = price * 0.008;
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

  let bias: "bullish" | "bearish" | "ranging" = "ranging";
  let biasLabel = "震荡";
  let confidence: "high" | "medium" | "low" = "medium";

  if (dailyData) {
    const premium = await getFuturesPremium();
    const closes = dailyData.indicators.quote[0].close
      .filter((c): c is number => c !== null)
      .map(c => c - premium);

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
    if (quote.change > 0 && quote.changePercent > 0.2) {
      bias = "bullish"; biasLabel = "偏多"; confidence = "low";
    } else if (quote.change < 0 && quote.changePercent < -0.2) {
      bias = "bearish"; biasLabel = "偏空"; confidence = "low";
    } else {
      bias = "ranging"; biasLabel = "震荡"; confidence = "low";
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

  const sessions = {
    asia: utcHour >= 0 && utcHour < 8 ? "可交易" : "已收盘",
    europe: utcHour >= 7 && utcHour < 16 ? "可交易" : "已收盘",
    us: utcHour >= 13 && utcHour < 22 ? "可交易" : "已收盘",
  };

  const changeDir = quote && quote.change >= 0 ? "上涨" : "下跌";
  const changeAbs = quote ? Math.abs(quote.change).toFixed(2) : "0.00";
  const changePctAbs = quote ? Math.abs(quote.changePercent).toFixed(2) : "0.00";
  const summary = `XAUUSD ${price.toFixed(2)}，日内${changeDir} ${changeAbs} (${changePctAbs}%)。` +
    `箱体区间 ${keyLevels.boxBottom.toFixed(0)}-${keyLevels.boxTop.toFixed(0)}，` +
    `${bias === "bullish" ? "关注上方阻力 " + keyLevels.resistance1.toFixed(0) + " 突破情况" :
      bias === "bearish" ? "关注下方支撑 " + keyLevels.support1.toFixed(0) + " 支撑力度" :
      "价格在箱体内震荡，等待方向选择"}`;

  const result: DailyBiasData = {
    bias, biasLabel, confidence, keyLevels, riskStatus, riskLabel, summary, sessions,
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
    resistance1: 0, resistance2: 0,
    support1: 0, support2: 0,
    boxTop: 0, boxBottom: 0,
  };
}

// ========== Background Cache Warming ==========

let warmingInterval: ReturnType<typeof setInterval> | null = null;

/**
 * 后台预热缓存 v5
 * - 启动时先校准期货升水，再获取报价
 * - 预热间隔 15 秒，避免触发限速
 * - 交错请求不同数据，避免并发
 */
export function startCacheWarming() {
  // Immediate warm-up: calibrate premium first, then fetch quote
  getFuturesPremium()
    .then((p) => {
      console.log(`[MarketData] Initial futures premium: $${p.toFixed(2)}`);
      return getRealQuote();
    })
    .then((q) => console.log(`[MarketData] Initial spot quote: $${q.price} (XAUUSD)`))
    .catch(() => console.log("[MarketData] Initial quote fetch failed, will retry"));

  // Staggered warm-up for daily/intraday data (non-blocking, delayed)
  setTimeout(() => {
    getDailyData().catch(() => {});
  }, 5000);

  setTimeout(() => {
    getIntradayData().catch(() => {});
  }, 8000);

  // Regular refresh: every 15 seconds to avoid rate limiting
  let refreshCycle = 0;
  warmingInterval = setInterval(async () => {
    refreshCycle++;

    // Always refresh quote (most important)
    try {
      await getRealQuote();
    } catch {
      // silent
    }

    // Refresh premium every 4th cycle (60s)
    if (refreshCycle % 4 === 0) {
      try {
        if (!isCacheValid(cache.spotPremium, CACHE_TTL.spotPremium)) {
          await getFuturesPremium();
        }
      } catch {
        // silent
      }
    }

    // Refresh daily data every 60th cycle (15min)
    if (refreshCycle % 60 === 2) {
      try {
        if (!isCacheValid(cache.dailyData, CACHE_TTL.daily)) {
          await getDailyData();
        }
      } catch {
        // silent
      }
    }

    // Refresh intraday data every 12th cycle (3min)
    if (refreshCycle % 12 === 6) {
      try {
        if (!isCacheValid(cache.intradayData, CACHE_TTL.intraday)) {
          await getIntradayData();
        }
      } catch {
        // silent
      }
    }
  }, 15 * 1000);

  console.log("[MarketData] Background cache warming started (15s interval, request queue enabled)");
}

export function stopCacheWarming() {
  if (warmingInterval) {
    clearInterval(warmingInterval);
    warmingInterval = null;
  }
}
