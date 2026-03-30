/**
 * XAUUSD 现货黄金行情数据模块 v3
 *
 * 数据源策略（多源融合 + 快速降级）：
 * 1. 主数据源：YahooFinance GC=F 1m/1d — 提供准实时 COMEX 黄金期货价格 + 日内 OHLCV
 * 2. 备用数据源：YahooFinance GC=F 直连 — 绕过代理网关
 * 3. 降级数据源：fawazahmed0 Currency API — 免费日级别现货汇率（仅作最后兜底）
 *
 * 优化点：
 * - 缓存 TTL 从 5s 降至 2s，确保价格刷新更快
 * - 后台预热间隔从 30s 降至 10s
 * - 增加请求超时控制（5s），避免单次请求阻塞
 * - 1m 级别数据替代 1d 级别，获取更精确的日内 OHLC
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
  realtimeData?: CacheEntry<YahooChartResult>;
} = {};

const CACHE_TTL = {
  quote: 2 * 1000,             // 2 seconds — near real-time
  spotPrice: 60 * 1000,        // 1 minute for spot price (daily rate, no need to refresh often)
  realtime: 3 * 1000,          // 3 seconds for 1m candle data
  intraday: 2 * 60 * 1000,     // 2 minutes for 15m candle data
  daily: 10 * 60 * 1000,       // 10 minutes for daily data
  weekly: 60 * 60 * 1000,      // 1 hour for weekly data
  monthly: 2 * 60 * 60 * 1000, // 2 hours for monthly data
  dailyBias: 15 * 1000,        // 15 seconds for daily bias
};

function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < ttl;
}

// ========== Fetch with Timeout ==========

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000): Promise<Response> {
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
    console.error(`[MarketData] API fetch GC=F (${interval}/${range}) failed:`, error);
    return null;
  }
}

// ========== Source 2: Yahoo Finance Direct ==========

async function fetchGoldChartDirect(interval: string, range: string): Promise<YahooChartResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=${interval}&range=${range}`;
    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; XAUUSDAgent/1.0)" },
    }, 5000);

    if (!response.ok) return null;

    const data = await response.json() as YahooChartResponse;
    if (data?.chart?.result?.[0]) {
      return data.chart.result[0];
    }
    return null;
  } catch (error) {
    console.error(`[MarketData] Direct Yahoo GC=F (${interval}/${range}) failed:`, error);
    return null;
  }
}

// ========== Source 3: fawazahmed0 Spot Price (daily rate fallback) ==========

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
      const response = await fetchWithTimeout(url, {}, 5000);
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

/**
 * 多源获取 GC=F 数据：先尝试 Manus API，失败则直连 Yahoo
 */
async function fetchGoldChart(interval: string, range: string): Promise<YahooChartResult | null> {
  // Try Manus Data API first (usually faster due to caching)
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

  // Primary: use 1m candle data for most real-time price
  const realtimeData = await getRealtimeData();

  if (realtimeData) {
    const meta = realtimeData.meta;
    const quotes = realtimeData.indicators.quote[0];
    const closes = quotes.close.filter((c): c is number => c !== null);
    const opens = quotes.open.filter((o): o is number => o !== null);
    const highs = quotes.high.filter((h): h is number => h !== null);
    const lows = quotes.low.filter((l): l is number => l !== null);

    // Use the latest available price
    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    // Calculate today's OHLC from 1m candles for accuracy
    const todayOpen = opens.length > 0 ? opens[0]! : price;
    const todayHigh = highs.length > 0 ? Math.max(meta.regularMarketDayHigh, ...highs) : meta.regularMarketDayHigh;
    const todayLow = lows.length > 0 ? Math.min(...lows.filter(l => l > 1000), meta.regularMarketDayLow) : meta.regularMarketDayLow;

    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(price),
      change: round2(change),
      changePercent: round2(changePercent),
      high: round2(todayHigh),
      low: round2(todayLow > 1000 ? todayLow : price),
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

  // Last resort: fawazahmed0 spot price
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
 * 计算关键位
 * 基于多周期数据计算支撑阻力位和箱体
 * 当 GC=F 不可用时，基于现货价格生成估算关键位
 */
export async function calculateKeyLevels(): Promise<KeyLevels> {
  const [dailyData, intradayData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
  ]);

  // If we have daily data, use full calculation
  if (dailyData) {
    const quotes = dailyData.indicators.quote[0];
    const highs = quotes.high.filter((h): h is number => h !== null);
    const lows = quotes.low.filter((l): l is number => l !== null);
    const closes = quotes.close.filter((c): c is number => c !== null);

    if (highs.length >= 5 && lows.length >= 5) {
      const boxTop = round2(Math.max(...highs.slice(-5)));
      const boxBottom = round2(Math.min(...lows.slice(-5)));

      const lastHigh = highs[highs.length - 1]!;
      const lastLow = lows[lows.length - 1]!;
      const lastClose = closes[closes.length - 1]!;
      const pivot = (lastHigh + lastLow + lastClose) / 3;

      const resistance1 = round2(2 * pivot - lastLow);
      const resistance2 = round2(pivot + (lastHigh - lastLow));
      const support1 = round2(2 * pivot - lastHigh);
      const support2 = round2(pivot - (lastHigh - lastLow));

      // Enhance with intraday data if available
      if (intradayData) {
        const intradayQuotes = intradayData.indicators.quote[0];
        const intradayHighs = intradayQuotes.high.filter((h): h is number => h !== null);
        const intradayLows = intradayQuotes.low.filter((l): l is number => l !== null && l > 1000);

        if (intradayHighs.length > 0 && intradayLows.length > 0) {
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

  // Last resort: use cached quote price
  if (cache.quote?.data && cache.quote.data.price > 1000) {
    return estimateKeyLevels(cache.quote.data.price);
  }

  return getDefaultKeyLevels();
}

/**
 * 基于价格估算关键位（当 GC=F 不可用时的降级方案）
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
    const closes = dailyData.indicators.quote[0].close
      .filter((c): c is number => c !== null);

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
  const summary = `XAUUSD ${price.toFixed(2)}，日内${changeDir} ${changeAbs} (${changePctAbs}%)。` +
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
 * v3: 缩短预热间隔至 10s，优先加载 1m 实时数据
 */
export function startCacheWarming() {
  // Immediate warm-up: fetch real-time quote first
  getRealQuote()
    .then((q) => console.log(`[MarketData] Initial quote: $${q.price}`))
    .catch(() => console.log("[MarketData] Initial quote fetch failed, will retry"));

  // Staggered warm-up for daily/intraday data (non-blocking)
  setTimeout(() => {
    getDailyData().catch(() => {});
    getIntradayData().catch(() => {});
  }, 3000);

  // Regular refresh: every 10 seconds for quote, less often for daily data
  warmingInterval = setInterval(async () => {
    try {
      await getRealQuote();
    } catch {
      // silent
    }
    // Refresh daily/intraday only if cache expired
    try {
      if (!isCacheValid(cache.dailyData, CACHE_TTL.daily)) {
        await getDailyData();
      }
      if (!isCacheValid(cache.intradayData, CACHE_TTL.intraday)) {
        await getIntradayData();
      }
    } catch {
      // silent
    }
  }, 10 * 1000);

  console.log("[MarketData] Background cache warming started (10s interval, multi-source with fast degradation)");
}

export function stopCacheWarming() {
  if (warmingInterval) {
    clearInterval(warmingInterval);
    warmingInterval = null;
  }
}
