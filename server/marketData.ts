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
 * 计算关键位 v2 - 基于交易体系
 * 
 * 体系逻辑：
 * 1. 箱体 = 筹码密集区（价格反复测试的高低点聚集区域）
 * 2. 支撑阻力 = 多周期高低点（D1级别的前高前低 + 日内级别的关键位）
 * 3. 不使用 Pivot Point 公式，用实际价格行为
 * 
 * 数据源：
 * - D1 K线（1个月）→ 找前高前低、筹码密集区
 * - H4/15m K线（2天）→ 找日内关键位、今日箱体
 * - W1 K线（6个月）→ 找大级别支撑阻力
 */
export async function calculateKeyLevels(): Promise<KeyLevels> {
  const premium = await getFuturesPremium();
  const [dailyData, intradayData, weeklyData] = await Promise.all([
    getDailyData(),
    getIntradayData(),
    getWeeklyData(),
  ]);

  if (dailyData) {
    const quotes = dailyData.indicators.quote[0];
    const highs = quotes.high.filter((h): h is number => h !== null).map(h => h - premium);
    const lows = quotes.low.filter((l): l is number => l !== null).map(l => l - premium);
    const closes = quotes.close.filter((c): c is number => c !== null).map(c => c - premium);

    if (highs.length >= 5 && lows.length >= 5) {
      // === 1. 找筹码密集区画箱体 ===
      // 用最近5-10天的高低点，找价格反复测试的区域
      const recentHighs = highs.slice(-10);
      const recentLows = lows.slice(-10);
      const allPrices = [...recentHighs, ...recentLows].sort((a, b) => a - b);

      // 用价格聚类找密集区：将价格分桶，找最密集的区域
      const bucketSize = 5; // $5 一个桶
      const buckets: Map<number, number> = new Map();
      for (const p of allPrices) {
        const key = Math.round(p / bucketSize) * bucketSize;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }

      // 找最密集的桶作为箱体中心
      let maxCount = 0;
      let densestPrice = allPrices[Math.floor(allPrices.length / 2)]!;
      buckets.forEach((count, price) => {
        if (count > maxCount) {
          maxCount = count;
          densestPrice = price;
        }
      });

      // 箱体 = 密集区上下各扩展一个桶
      let boxTop = densestPrice + bucketSize;
      let boxBottom = densestPrice - bucketSize;

      // 用日内数据修正箱体（如果有的话）
      if (intradayData) {
        const intradayQuotes = intradayData.indicators.quote[0];
        const intradayHighs = intradayQuotes.high.filter((h): h is number => h !== null && h > 1000).map(h => h - premium);
        const intradayLows = intradayQuotes.low.filter((l): l is number => l !== null && l > 1000).map(l => l - premium);

        if (intradayHighs.length > 10 && intradayLows.length > 10) {
          // 今日实际波动区间
          const todayHigh = Math.max(...intradayHighs.slice(-30));
          const todayLow = Math.min(...intradayLows.slice(-30));

          // 如果今日区间在日线箱体内，用今日区间作为日内箱体
          if (todayHigh <= boxTop + 15 && todayLow >= boxBottom - 15) {
            boxTop = round2(todayHigh);
            boxBottom = round2(todayLow);
          }
        }
      }

      // === 2. 找支撑阻力 = 前高前低（D1级别） ===
      // R1 = 最近的前高（价格上方最近的高点）
      // S1 = 最近的前低（价格下方最近的低点）
      const currentPrice = closes[closes.length - 1]!;

      // 找D1级别的摆动高低点（swing high/low）
      const swingHighs: number[] = [];
      const swingLows: number[] = [];
      for (let i = 1; i < highs.length - 1; i++) {
        if (highs[i]! > highs[i - 1]! && highs[i]! > highs[i + 1]!) {
          swingHighs.push(highs[i]!);
        }
        if (lows[i]! < lows[i - 1]! && lows[i]! < lows[i + 1]!) {
          swingLows.push(lows[i]!);
        }
      }

      // R1 = 当前价格上方最近的摆动高点
      const resistances = swingHighs.filter(h => h > currentPrice).sort((a, b) => a - b);
      const supports = swingLows.filter(l => l < currentPrice).sort((a, b) => b - a);

      let resistance1 = resistances[0] ?? round2(boxTop + 10);
      let resistance2 = resistances[1] ?? round2(resistance1 + 15);
      let support1 = supports[0] ?? round2(boxBottom - 10);
      let support2 = supports[1] ?? round2(support1 - 15);

      // === 3. 用周线数据补充大级别支撑阻力 ===
      if (weeklyData) {
        const wQuotes = weeklyData.indicators.quote[0];
        const wHighs = wQuotes.high.filter((h): h is number => h !== null).map(h => h - premium);
        const wLows = wQuotes.low.filter((l): l is number => l !== null).map(l => l - premium);

        // 周线级别的前高前低，作为 R2/S2
        const wSwingHighs = wHighs.filter(h => h > currentPrice).sort((a, b) => a - b);
        const wSwingLows = wLows.filter(l => l < currentPrice).sort((a, b) => b - a);

        if (wSwingHighs.length > 0) resistance2 = round2(wSwingHighs[0]!);
        if (wSwingLows.length > 0) support2 = round2(wSwingLows[0]!);
      }

      return {
        resistance1: round2(resistance1),
        resistance2: round2(resistance2),
        support1: round2(support1),
        support2: round2(support2),
        boxTop: round2(boxTop),
        boxBottom: round2(boxBottom),
      };
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
  // 即使是 fallback，也用合理的日内波幅估算
  // 黄金日均波幅约 $25-40，取 $30 作为基准
  const avgDailyRange = 30;
  const halfRange = avgDailyRange / 2;

  return {
    resistance1: round2(price + halfRange),
    resistance2: round2(price + avgDailyRange),
    support1: round2(price - halfRange),
    support2: round2(price - avgDailyRange),
    boxTop: round2(price + halfRange * 0.5),
    boxBottom: round2(price - halfRange * 0.5),
  };
}

// ========== Daily Bias v2 ==========

/**
 * 日内偏向判断 v2 - 基于交易体系
 * 
 * 体系优先级：基本面 > 时间 > 多周期共振 > 关键位 > 图形确认
 * 
 * 1. 基本面：检查经济日历，数据前后降低置信度
 * 2. 时间：亚盘定区间、欧盘起方向、美盘出主趋势
 * 3. 多周期：W1→D1定大方向，H4→H1定日内
 * 4. 关键位：价格在箱体中的位置、离支撑阻力的距离
 */
export async function getRealDailyBias(): Promise<DailyBiasData> {
  if (isCacheValid(cache.dailyBias, CACHE_TTL.dailyBias)) {
    return cache.dailyBias.data;
  }

  const [quote, keyLevels, dailyData, weeklyData] = await Promise.all([
    getRealQuote().catch(() => null),
    calculateKeyLevels(),
    getDailyData(),
    getWeeklyData(),
  ]);

  // 获取经济日历事件
  let calendarEvents: Array<{ time: string; impact: string; name: string }> = [];
  try {
    const { getEconomicCalendar } = await import("./calendarService");
    calendarEvents = getEconomicCalendar();
  } catch { /* silent */ }

  const price = quote?.price ?? cache.quote?.data?.price ?? 0;
  const premium = await getFuturesPremium();

  let bias: "bullish" | "bearish" | "ranging" = "ranging";
  let biasLabel = "震荡";
  let confidence: "high" | "medium" | "low" = "medium";

  // === 多维度打分 ===
  let bullishScore = 0;
  let bearishScore = 0;
  let hasData = false;

  // --- 维度 1: 多周期趋势（权重最高） ---
  if (dailyData) {
    hasData = true;
    const closes = dailyData.indicators.quote[0].close
      .filter((c): c is number => c !== null)
      .map(c => c - premium);

    if (closes.length >= 5) {
      // D1 趋势：5日方向
      const d1Trend = closes[closes.length - 1]! - closes[closes.length - 5]!;
      // D1 短期：3日方向
      const d1Short = closes[closes.length - 1]! - closes[Math.max(0, closes.length - 3)]!;

      // D1 方向权重 3分
      if (d1Trend > 5) bullishScore += 3;
      else if (d1Trend < -5) bearishScore += 3;
      else { bullishScore += 1; bearishScore += 1; } // 无明确方向

      // D1 短期加速确认 1.5分
      if (d1Short > 3 && d1Trend > 0) bullishScore += 1.5;
      else if (d1Short < -3 && d1Trend < 0) bearishScore += 1.5;
    }
  }

  // W1 趋势（大方向）
  if (weeklyData) {
    const wCloses = weeklyData.indicators.quote[0].close
      .filter((c): c is number => c !== null)
      .map(c => c - premium);

    if (wCloses.length >= 3) {
      const w1Trend = wCloses[wCloses.length - 1]! - wCloses[wCloses.length - 3]!;
      // W1 方向权重 2分（大方向确认）
      if (w1Trend > 10) bullishScore += 2;
      else if (w1Trend < -10) bearishScore += 2;
      else { bullishScore += 0.5; bearishScore += 0.5; }
    }
  }

  // --- 维度 2: 当日动能 ---
  if (quote) {
    hasData = true;
    // 当日涨跌幅度 1.5分
    if (quote.changePercent > 0.3) bullishScore += 1.5;
    else if (quote.changePercent < -0.3) bearishScore += 1.5;
    else if (quote.change > 0) bullishScore += 0.5;
    else bearishScore += 0.5;
  }

  // --- 维度 3: 价格与箱体的关系 ---
  const boxRange = keyLevels.boxTop - keyLevels.boxBottom;
  if (boxRange > 0 && price > 0) {
    const priceInBox = (price - keyLevels.boxBottom) / boxRange;

    if (price > keyLevels.boxTop) {
      // 突破箱体上沿，偏多信号
      bullishScore += 2;
    } else if (price < keyLevels.boxBottom) {
      // 跌破箱体下沿，偏空信号
      bearishScore += 2;
    } else if (priceInBox > 0.8) {
      // 箱体上沿，有压力
      bearishScore += 0.5;
    } else if (priceInBox < 0.2) {
      // 箱体下沿，有支撑
      bullishScore += 0.5;
    }
  }

  // --- 维度 4: 离关键位的距离 ---
  if (price > 0) {
    const distToR1 = keyLevels.resistance1 - price;
    const distToS1 = price - keyLevels.support1;

    // 离阻力近（<10点），谨慎追多
    if (distToR1 < 10 && distToR1 > 0) bearishScore += 0.5;
    // 离支撑近（<10点），谨慎追空
    if (distToS1 < 10 && distToS1 > 0) bullishScore += 0.5;
  }

  // === 计算偏向 ===
  const totalScore = bullishScore + bearishScore;
  if (totalScore > 0 && hasData) {
    const bullishRatio = bullishScore / totalScore;

    if (bullishRatio > 0.65) {
      bias = "bullish";
      biasLabel = "偏多";
      confidence = bullishRatio > 0.78 ? "high" : "medium";
    } else if (bullishRatio < 0.35) {
      bias = "bearish";
      biasLabel = "偏空";
      confidence = bullishRatio < 0.22 ? "high" : "medium";
    } else {
      bias = "ranging";
      biasLabel = "震荡";
      confidence = "medium";
    }
  } else if (quote) {
    // 没有K线数据，只能用当日涨跌，置信度低
    if (quote.changePercent > 0.3) {
      bias = "bullish"; biasLabel = "偏多"; confidence = "low";
    } else if (quote.changePercent < -0.3) {
      bias = "bearish"; biasLabel = "偏空"; confidence = "low";
    } else {
      bias = "ranging"; biasLabel = "震荡"; confidence = "low";
    }
  }

  // === 基本面修正：数据前后降低置信度 ===
  const now = new Date();
  const highImpactEvents = calendarEvents.filter(e => e.impact === "high");
  const hasUpcomingData = highImpactEvents.some(e => {
    const eventTime = new Date(e.time);
    const diffMin = (eventTime.getTime() - now.getTime()) / 60000;
    return diffMin >= -15 && diffMin <= 60; // 数据前60分钟到数据后15分钟
  });

  if (hasUpcomingData && confidence === "high") {
    confidence = "medium"; // 数据前后不给高置信度
  }

  // === 风控状态：基于经济日历 + 盘面时段 ===
  const utcHour = now.getUTCHours();
  let riskStatus: "tradable" | "cautious" | "no_trade" = "tradable";
  let riskLabel = "可交易";

  // 检查是否接近高影响数据发布
  const nearHighImpact = highImpactEvents.some(e => {
    const eventTime = new Date(e.time);
    const diffMin = (eventTime.getTime() - now.getTime()) / 60000;
    return diffMin >= 0 && diffMin <= 30;
  });

  const justAfterHighImpact = highImpactEvents.some(e => {
    const eventTime = new Date(e.time);
    const diffMin = (now.getTime() - eventTime.getTime()) / 60000;
    return diffMin >= 0 && diffMin <= 10;
  });

  if (nearHighImpact) {
    riskStatus = "no_trade";
    riskLabel = "数据前禁入";
  } else if (justAfterHighImpact) {
    riskStatus = "cautious";
    riskLabel = "数据后·观察方向";
  } else if (utcHour >= 22 || utcHour < 0) {
    riskStatus = "cautious";
    riskLabel = "流动性低";
  }

  // === 盘面时段 ===
  const sessions = {
    asia: utcHour >= 0 && utcHour < 8 ? "可交易" : "已收盘",
    europe: utcHour >= 7 && utcHour < 16 ? "可交易" : "已收盘",
    us: utcHour >= 13 && utcHour < 22 ? "可交易" : "已收盘",
  };

  // === 生成摘要 ===
  const changeDir = quote && quote.change >= 0 ? "上涨" : "下跌";
  const changeAbs = quote ? Math.abs(quote.change).toFixed(2) : "0.00";
  const changePctAbs = quote ? Math.abs(quote.changePercent).toFixed(2) : "0.00";

  let positionDesc = "箱体内";
  if (price > keyLevels.boxTop) positionDesc = "突破箱体上沿";
  else if (price < keyLevels.boxBottom) positionDesc = "跌破箱体下沿";
  else if (boxRange > 0) {
    const pct = ((price - keyLevels.boxBottom) / boxRange * 100).toFixed(0);
    positionDesc = `箱体内${pct}%位置`;
  }

  const summary = `XAUUSD ${price.toFixed(2)}，日内${changeDir}${changeAbs}(${changePctAbs}%)。` +
    `${positionDesc}，箱体${keyLevels.boxBottom.toFixed(0)}-${keyLevels.boxTop.toFixed(0)}。` +
    `${bias === "bullish" ? `偏多，上看${keyLevels.resistance1.toFixed(0)}` :
      bias === "bearish" ? `偏空，下看${keyLevels.support1.toFixed(0)}` :
      `震荡，等待方向`}。` +
    (riskStatus !== "tradable" ? `风控: ${riskLabel}` : "");

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
