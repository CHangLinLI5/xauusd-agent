/**
 * XAUUSD 现货黄金行情数据模块 v6
 *
 * v6 重大改动：
 * - 数据源完全切换为 Twelve Data XAU/USD 现货
 * - 去掉 Yahoo Finance GC=F 期货、BullionVault、fawazahmed0
 * - 去掉 premium 转换逻辑，直接使用现货价格
 * - 优化请求频率控制（免费版每天 800 次）
 * - 重写 calculateKeyLevels，加严格排序校验
 *
 * 数据源：Twelve Data API (https://api.twelvedata.com)
 * - /price → 实时价格（轻量）
 * - /quote → 完整报价（含 OHLC、52周等）
 * - /time_series → K线数据（1min/15min/1day/1week）
 */
import { ENV } from "./_core/env";
import type { MarketQuote } from "./mockData";
import { getWsPrice, isWsConnected } from "./tdWebSocket";

// ========== Types ==========

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
}

interface TwelveDataTimeSeries {
  meta: {
    symbol: string;
    interval: string;
    currency_base: string;
    currency_quote: string;
    type: string;
  };
  values: TwelveDataCandle[];
  status: string;
}

interface TwelveDataQuote {
  symbol: string;
  name: string;
  exchange: string;
  datetime: string;
  timestamp: number;
  open: string;
  high: string;
  low: string;
  close: string;
  previous_close: string;
  change: string;
  percent_change: string;
  is_market_open: boolean;
  fifty_two_week: {
    low: string;
    high: string;
  };
}

interface TwelveDataPrice {
  price: string;
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

// ========== Config ==========

const TWELVE_DATA_API_KEY = ENV.twelveDataApiKey || process.env.TWELVE_DATA_API_KEY || "f92ddfeaf4fb4a44bbc78eebd0f1801c";
const TWELVE_DATA_BASE = "https://api.twelvedata.com";
const SYMBOL = "XAU/USD";

// ========== Request Queue (rate limiting: 800/day ≈ 1 per 108s, but burst OK) ==========

let dailyApiCalls = 0;
let dailyResetTime = Date.now();
let lastApiCallTime = 0;
const MIN_API_INTERVAL = 500; // 500ms between calls

function checkDailyLimit(): boolean {
  const now = Date.now();
  // Reset counter every 24h
  if (now - dailyResetTime > 24 * 60 * 60 * 1000) {
    dailyApiCalls = 0;
    dailyResetTime = now;
  }
  return dailyApiCalls < 750; // Leave 50 buffer
}

// ========== Cache ==========

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache: {
  quote?: CacheEntry<MarketQuote>;
  price?: CacheEntry<number>;
  dailyCandles?: CacheEntry<TwelveDataCandle[]>;
  weeklyCandles?: CacheEntry<TwelveDataCandle[]>;
  intradayCandles?: CacheEntry<TwelveDataCandle[]>;
  dailyBias?: CacheEntry<DailyBiasData>;
} = {};

const CACHE_TTL = {
  price: 10 * 1000,             // 10 seconds for price
  quote: 10 * 1000,             // 10 seconds for full quote
  intraday: 5 * 60 * 1000,     // 5 minutes for 15m candles
  daily: 30 * 60 * 1000,       // 30 minutes for daily candles
  weekly: 2 * 60 * 60 * 1000,  // 2 hours for weekly candles
  dailyBias: 30 * 1000,        // 30 seconds for daily bias
};

function isCacheValid<T>(entry: CacheEntry<T> | undefined, ttl: number): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.timestamp < ttl;
}

// ========== Fetch with Timeout ==========

async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

// ========== Twelve Data API Calls ==========

async function fetchTwelveData<T>(endpoint: string, params: Record<string, string>): Promise<T | null> {
  if (!checkDailyLimit()) {
    console.warn("[MarketData] Daily API limit approaching, using cache");
    return null;
  }

  // Rate limiting
  const now = Date.now();
  const waitTime = Math.max(0, MIN_API_INTERVAL - (now - lastApiCallTime));
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  const queryParams = new URLSearchParams({
    ...params,
    symbol: SYMBOL,
    apikey: TWELVE_DATA_API_KEY,
  });

  const url = `${TWELVE_DATA_BASE}${endpoint}?${queryParams}`;

  try {
    lastApiCallTime = Date.now();
    dailyApiCalls++;
    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.error(`[MarketData] Twelve Data ${endpoint} failed: ${response.status}`);
      return null;
    }

    const data = await response.json() as T & { code?: number; message?: string; status?: string };

    // Check for API errors
    if (data.code && data.code !== 200) {
      console.error(`[MarketData] Twelve Data error: ${data.message}`);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`[MarketData] Twelve Data ${endpoint} failed:`, (error as Error).message?.slice(0, 100));
    return null;
  }
}

// ========== Data Fetchers ==========

/** 获取实时价格（最轻量，1 credit） */
async function fetchPrice(): Promise<number | null> {
  if (isCacheValid(cache.price, CACHE_TTL.price)) {
    return cache.price.data;
  }

  const data = await fetchTwelveData<TwelveDataPrice>("/price", {});
  if (data?.price) {
    const price = parseFloat(data.price);
    if (price > 1000) {
      cache.price = { data: price, timestamp: Date.now() };
      return price;
    }
  }
  return (cache.price as CacheEntry<number> | undefined)?.data ?? null;
}

/** 获取完整报价（含 OHLC、涨跌等） */
async function fetchQuote(): Promise<TwelveDataQuote | null> {
  const data = await fetchTwelveData<TwelveDataQuote>("/quote", {});
  if (data?.close) {
    return data;
  }
  return null;
}

/** 获取K线数据 */
async function fetchTimeSeries(interval: string, outputsize: number): Promise<TwelveDataCandle[] | null> {
  const data = await fetchTwelveData<TwelveDataTimeSeries>("/time_series", {
    interval,
    outputsize: String(outputsize),
  });
  if (data?.values && data.values.length > 0) {
    return data.values;
  }
  return null;
}

// ========== Cached Data Getters ==========

async function getDailyCandles(): Promise<TwelveDataCandle[] | null> {
  if (isCacheValid(cache.dailyCandles, CACHE_TTL.daily)) {
    return cache.dailyCandles.data;
  }
  const candles = await fetchTimeSeries("1day", 30);
  if (candles) {
    cache.dailyCandles = { data: candles, timestamp: Date.now() };
  }
  return candles ?? cache.dailyCandles?.data ?? null;
}

async function getWeeklyCandles(): Promise<TwelveDataCandle[] | null> {
  if (isCacheValid(cache.weeklyCandles, CACHE_TTL.weekly)) {
    return cache.weeklyCandles.data;
  }
  const candles = await fetchTimeSeries("1week", 26);
  if (candles) {
    cache.weeklyCandles = { data: candles, timestamp: Date.now() };
  }
  return candles ?? cache.weeklyCandles?.data ?? null;
}

async function getIntradayCandles(): Promise<TwelveDataCandle[] | null> {
  if (isCacheValid(cache.intradayCandles, CACHE_TTL.intraday)) {
    return cache.intradayCandles.data;
  }
  const candles = await fetchTimeSeries("15min", 96); // ~24h of 15min candles
  if (candles) {
    cache.intradayCandles = { data: candles, timestamp: Date.now() };
  }
  return candles ?? cache.intradayCandles?.data ?? null;
}

// ========== Real-time Quote ==========

export async function getRealQuote(): Promise<MarketQuote> {
  if (isCacheValid(cache.quote, CACHE_TTL.quote)) {
    return cache.quote.data;
  }

  // Priority 1: WebSocket real-time price (no API cost)
  const wsData = getWsPrice();
  if (wsData && wsData.price > 1000) {
    const prevQuote = (cache.quote as CacheEntry<MarketQuote> | undefined)?.data;
    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(wsData.price),
      change: prevQuote ? round2(wsData.price - prevQuote.open) : 0,
      changePercent: prevQuote && prevQuote.open > 0 ? round2(((wsData.price - prevQuote.open) / prevQuote.open) * 100) : 0,
      high: prevQuote?.high && prevQuote.high > wsData.price ? round2(prevQuote.high) : round2(wsData.price),
      low: prevQuote?.low && prevQuote.low < wsData.price && prevQuote.low > 1000 ? round2(prevQuote.low) : round2(wsData.price),
      open: prevQuote?.open && prevQuote.open > 1000 ? round2(prevQuote.open) : round2(wsData.price),
      timestamp: new Date(wsData.timestamp * 1000).toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    return quoteData;
  }

  // Priority 2: REST API full quote (fallback when WS disconnected)
  const tdQuote = await fetchQuote();
  if (tdQuote) {
    const price = parseFloat(tdQuote.close);
    const open = parseFloat(tdQuote.open);
    const high = parseFloat(tdQuote.high);
    const low = parseFloat(tdQuote.low);
    const prevClose = parseFloat(tdQuote.previous_close);
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(price),
      change: round2(change),
      changePercent: round2(changePercent),
      high: round2(high > 0 ? high : price),
      low: round2(low > 0 ? low : price),
      open: round2(open > 0 ? open : price),
      timestamp: new Date(tdQuote.timestamp * 1000).toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    console.log(`[MarketData] XAU/USD spot: $${price.toFixed(2)} (Twelve Data)`);
    return quoteData;
  }

  // Fallback: lightweight price endpoint
  const price = await fetchPrice();
  if (price && price > 1000) {
    const prevQuote = (cache.quote as CacheEntry<MarketQuote> | undefined)?.data;
    const quoteData: MarketQuote = {
      symbol: "XAUUSD",
      price: round2(price),
      change: prevQuote ? round2(price - prevQuote.open) : 0,
      changePercent: prevQuote && prevQuote.open > 0 ? round2(((price - prevQuote.open) / prevQuote.open) * 100) : 0,
      high: prevQuote?.high && prevQuote.high > price ? round2(prevQuote.high) : round2(price),
      low: prevQuote?.low && prevQuote.low < price && prevQuote.low > 1000 ? round2(prevQuote.low) : round2(price),
      open: prevQuote?.open && prevQuote.open > 1000 ? round2(prevQuote.open) : round2(price),
      timestamp: new Date().toISOString(),
    };

    cache.quote = { data: quoteData, timestamp: Date.now() };
    return quoteData;
  }

  // Last resort: cached
  const cachedQuote = (cache.quote as CacheEntry<MarketQuote> | undefined);
  if (cachedQuote?.data) {
    return cachedQuote.data;
  }
  throw new Error("No market data available");
}

// ========== Key Levels Calculation v3 ==========

/**
 * 计算关键位 v3 - 基于交易体系 + Twelve Data 现货数据
 *
 * 逻辑：
 * 1. 箱体 = 近期日线波动的核心区间（最近3-5天的重叠区域）
 * 2. R1/S1 = D1 级别的 swing high/low（前高前低）
 * 3. R2/S2 = W1 级别的 swing high/low
 * 4. 严格校验：R2 > R1 > 箱体顶 > 箱体底 > S1 > S2
 */
export async function calculateKeyLevels(): Promise<KeyLevels> {
  const [dailyCandles, weeklyCandles, intradayCandles] = await Promise.all([
    getDailyCandles(),
    getWeeklyCandles(),
    getIntradayCandles(),
  ]);

  // 获取当前价格
  let currentPrice = 0;
  try {
    const quote = await getRealQuote();
    currentPrice = quote.price;
  } catch {
    if (cache.quote?.data) currentPrice = cache.quote.data.price;
  }

  if (dailyCandles && dailyCandles.length >= 5 && currentPrice > 1000) {
    // Twelve Data 返回的数据是倒序的（最新在前）
    const highs = dailyCandles.map(c => parseFloat(c.high)).filter(h => h > 1000);
    const lows = dailyCandles.map(c => parseFloat(c.low)).filter(l => l > 1000);
    const closes = dailyCandles.map(c => parseFloat(c.close)).filter(c => c > 1000);

    // === 1. 箱体：最近5天的核心重叠区域 ===
    const recent5Highs = highs.slice(0, 5);
    const recent5Lows = lows.slice(0, 5);

    // 箱体上沿 = 最近5天最高点的中位数（排除极端值）
    // 箱体下沿 = 最近5天最低点的中位数
    const sortedHighs = [...recent5Highs].sort((a, b) => a - b);
    const sortedLows = [...recent5Lows].sort((a, b) => a - b);

    // 用中间3天的高低点作为箱体（去掉最高和最低的极端值）
    let boxTop: number;
    let boxBottom: number;

    if (sortedHighs.length >= 3 && sortedLows.length >= 3) {
      boxTop = round2(sortedHighs[Math.floor(sortedHighs.length * 0.6)]!);
      boxBottom = round2(sortedLows[Math.floor(sortedLows.length * 0.4)]!);
    } else {
      boxTop = round2(Math.max(...recent5Highs));
      boxBottom = round2(Math.min(...recent5Lows));
    }

    // 箱体宽度校验：太窄就扩展，太宽就收缩
    const boxRange = boxTop - boxBottom;
    if (boxRange < 20) {
      // 太窄，用最近3天的实际高低
      const h3 = Math.max(...highs.slice(0, 3));
      const l3 = Math.min(...lows.slice(0, 3));
      boxTop = round2(h3);
      boxBottom = round2(l3);
    } else if (boxRange > 200) {
      // 太宽（异常），用最近2天
      const h2 = Math.max(...highs.slice(0, 2));
      const l2 = Math.min(...lows.slice(0, 2));
      boxTop = round2(h2);
      boxBottom = round2(l2);
    }

    // 用日内数据微调箱体（如果有）
    if (intradayCandles && intradayCandles.length > 10) {
      const intraHighs = intradayCandles.slice(0, 30).map(c => parseFloat(c.high)).filter(h => h > 1000);
      const intraLows = intradayCandles.slice(0, 30).map(c => parseFloat(c.low)).filter(l => l > 1000);

      if (intraHighs.length > 5 && intraLows.length > 5) {
        const todayHigh = Math.max(...intraHighs);
        const todayLow = Math.min(...intraLows);

        // 如果今日区间在日线箱体内，用今日区间微调
        if (todayHigh <= boxTop + 20 && todayLow >= boxBottom - 20) {
          // 取日线箱体和日内区间的交集扩展
          boxTop = round2(Math.max(boxTop, todayHigh));
          boxBottom = round2(Math.min(boxBottom, todayLow));
        }
      }
    }

    // === 2. D1 级别的 swing high/low → R1/S1 ===
    const swingHighs: number[] = [];
    const swingLows: number[] = [];

    // highs[0] 是最新的，highs[n] 是最老的
    for (let i = 1; i < highs.length - 1; i++) {
      if (highs[i]! > highs[i - 1]! && highs[i]! > highs[i + 1]!) {
        swingHighs.push(highs[i]!);
      }
      if (lows[i]! < lows[i - 1]! && lows[i]! < lows[i + 1]!) {
        swingLows.push(lows[i]!);
      }
    }

    // R1 = 当前价格上方最近的 swing high
    const resistancesAbove = swingHighs.filter(h => h > currentPrice).sort((a, b) => a - b);
    // S1 = 当前价格下方最近的 swing low
    const supportsBelow = swingLows.filter(l => l < currentPrice).sort((a, b) => b - a);

    let resistance1 = resistancesAbove[0] ?? round2(boxTop + 15);
    let support1 = supportsBelow[0] ?? round2(boxBottom - 15);

    // 确保 R1 在箱体上方
    if (resistance1 <= boxTop) {
      resistance1 = round2(boxTop + 15);
    }
    // 确保 S1 在箱体下方
    if (support1 >= boxBottom) {
      support1 = round2(boxBottom - 15);
    }

    // === 3. W1 级别 → R2/S2 ===
    let resistance2 = round2(resistance1 + 30);
    let support2 = round2(support1 - 30);

    if (weeklyCandles && weeklyCandles.length >= 3) {
      const wHighs = weeklyCandles.map(c => parseFloat(c.high)).filter(h => h > 1000);
      const wLows = weeklyCandles.map(c => parseFloat(c.low)).filter(l => l > 1000);

      // W1 swing highs above current price
      const wResistances = wHighs.filter(h => h > resistance1).sort((a, b) => a - b);
      const wSupports = wLows.filter(l => l < support1).sort((a, b) => b - a);

      if (wResistances.length > 0) resistance2 = round2(wResistances[0]!);
      if (wSupports.length > 0) support2 = round2(wSupports[0]!);
    }

    // === 4. 严格排序校验 ===
    // 确保 R2 > R1 > boxTop > boxBottom > S1 > S2
    if (resistance2 <= resistance1) resistance2 = round2(resistance1 + 30);
    if (resistance1 <= boxTop) resistance1 = round2(boxTop + 15);
    if (resistance2 <= resistance1) resistance2 = round2(resistance1 + 30);
    if (boxTop <= boxBottom) boxTop = round2(boxBottom + 20);
    if (support1 >= boxBottom) support1 = round2(boxBottom - 15);
    if (support2 >= support1) support2 = round2(support1 - 30);

    // 最终 sanity check
    const levels: KeyLevels = {
      resistance2: round2(resistance2),
      resistance1: round2(resistance1),
      boxTop: round2(boxTop),
      boxBottom: round2(boxBottom),
      support1: round2(support1),
      support2: round2(support2),
    };

    console.log(`[MarketData] Key levels: R2=${levels.resistance2} R1=${levels.resistance1} Box=${levels.boxTop}-${levels.boxBottom} S1=${levels.support1} S2=${levels.support2} (price=${currentPrice})`);
    return levels;
  }

  // Fallback
  if (currentPrice > 1000) {
    return estimateKeyLevels(currentPrice);
  }

  return getDefaultKeyLevels();
}

function estimateKeyLevels(price: number): KeyLevels {
  const avgDailyRange = 40; // 黄金日均波幅约 $30-50
  const halfRange = avgDailyRange / 2;

  return {
    resistance1: round2(price + halfRange),
    resistance2: round2(price + avgDailyRange * 1.5),
    support1: round2(price - halfRange),
    support2: round2(price - avgDailyRange * 1.5),
    boxTop: round2(price + halfRange * 0.6),
    boxBottom: round2(price - halfRange * 0.6),
  };
}

// ========== Daily Bias v3 ==========

/**
 * 日内偏向判断 v3 - 基于交易体系 + Twelve Data 现货
 *
 * 体系优先级：基本面 > 时间 > 多周期共振 > 关键位 > 图形确认
 */
export async function getRealDailyBias(): Promise<DailyBiasData> {
  if (isCacheValid(cache.dailyBias, CACHE_TTL.dailyBias)) {
    return cache.dailyBias.data;
  }

  const [quote, keyLevels, dailyCandles, weeklyCandles] = await Promise.all([
    getRealQuote().catch(() => null),
    calculateKeyLevels(),
    getDailyCandles(),
    getWeeklyCandles(),
  ]);

  // 获取经济日历事件
  let calendarEvents: Array<{ time: string; impact: string; name: string }> = [];
  try {
    const { getEconomicCalendar } = await import("./calendarService");
    calendarEvents = getEconomicCalendar();
  } catch { /* silent */ }

  const price = quote?.price ?? cache.quote?.data?.price ?? 0;

  let bias: "bullish" | "bearish" | "ranging" = "ranging";
  let biasLabel = "震荡";
  let confidence: "high" | "medium" | "low" = "medium";

  // === 多维度打分 ===
  let bullishScore = 0;
  let bearishScore = 0;
  let hasData = false;

  // --- 维度 1: D1 趋势（权重 3） ---
  if (dailyCandles && dailyCandles.length >= 5) {
    hasData = true;
    const closes = dailyCandles.map(c => parseFloat(c.close)).filter(c => c > 1000);

    if (closes.length >= 5) {
      // closes[0] 是最新的
      const d1Trend = closes[0]! - closes[4]!; // 5日趋势
      const d1Short = closes[0]! - closes[Math.min(2, closes.length - 1)]!; // 3日趋势

      if (d1Trend > 10) bullishScore += 3;
      else if (d1Trend < -10) bearishScore += 3;
      else { bullishScore += 1; bearishScore += 1; }

      // 短期加速确认
      if (d1Short > 5 && d1Trend > 0) bullishScore += 1.5;
      else if (d1Short < -5 && d1Trend < 0) bearishScore += 1.5;
    }
  }

  // --- 维度 2: W1 趋势（权重 2） ---
  if (weeklyCandles && weeklyCandles.length >= 3) {
    const wCloses = weeklyCandles.map(c => parseFloat(c.close)).filter(c => c > 1000);

    if (wCloses.length >= 3) {
      const w1Trend = wCloses[0]! - wCloses[2]!; // 3周趋势
      if (w1Trend > 20) bullishScore += 2;
      else if (w1Trend < -20) bearishScore += 2;
      else { bullishScore += 0.5; bearishScore += 0.5; }
    }
  }

  // --- 维度 3: 当日动能（权重 1.5） ---
  if (quote) {
    hasData = true;
    if (quote.changePercent > 0.3) bullishScore += 1.5;
    else if (quote.changePercent < -0.3) bearishScore += 1.5;
    else if (quote.change > 0) bullishScore += 0.5;
    else bearishScore += 0.5;
  }

  // --- 维度 4: 价格与箱体的关系（权重 2） ---
  const boxRange = keyLevels.boxTop - keyLevels.boxBottom;
  if (boxRange > 0 && price > 0) {
    const priceInBox = (price - keyLevels.boxBottom) / boxRange;

    if (price > keyLevels.boxTop) {
      bullishScore += 2; // 突破箱体上沿
    } else if (price < keyLevels.boxBottom) {
      bearishScore += 2; // 跌破箱体下沿
    } else if (priceInBox > 0.8) {
      bearishScore += 0.5; // 箱体上沿有压力
    } else if (priceInBox < 0.2) {
      bullishScore += 0.5; // 箱体下沿有支撑
    }
  }

  // --- 维度 5: 离关键位的距离 ---
  if (price > 0) {
    const distToR1 = keyLevels.resistance1 - price;
    const distToS1 = price - keyLevels.support1;

    if (distToR1 < 10 && distToR1 > 0) bearishScore += 0.5;
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
    if (quote.changePercent > 0.3) {
      bias = "bullish"; biasLabel = "偏多"; confidence = "low";
    } else if (quote.changePercent < -0.3) {
      bias = "bearish"; biasLabel = "偏空"; confidence = "low";
    } else {
      bias = "ranging"; biasLabel = "震荡"; confidence = "low";
    }
  }

  // === 基本面修正 ===
  const now = new Date();
  const highImpactEvents = calendarEvents.filter(e => e.impact === "high");
  const hasUpcomingData = highImpactEvents.some(e => {
    const eventTime = new Date(e.time);
    const diffMin = (eventTime.getTime() - now.getTime()) / 60000;
    return diffMin >= -15 && diffMin <= 60;
  });

  if (hasUpcomingData && confidence === "high") {
    confidence = "medium";
  }

  // === 风控状态 ===
  const utcHour = now.getUTCHours();
  let riskStatus: "tradable" | "cautious" | "no_trade" = "tradable";
  let riskLabel = "可交易";

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
 * 后台预热缓存 v7
 *
 * 实时报价由 Twelve Data WebSocket 推送（不消耗 API 额度）
 * REST API 只用于 K 线数据刷新，每天约 200-300 次，远低于 800 上限
 *
 * 刷新策略：
 * - 报价：WebSocket 实时推送（1-3秒），WS 断线时才 fallback 到 REST（每2分钟）
 * - 日内 K 线（15min）：每 5 分钟
 * - 日线 K 线：每 30 分钟
 * - 周线 K 线：每 2 小时
 */
export function startCacheWarming() {
  // 启动时用 REST 获取一次完整报价（含 OHLC），作为 WebSocket 的补充
  fetchQuote().then((q) => {
    if (q) {
      const price = parseFloat(q.close);
      const open = parseFloat(q.open);
      const high = parseFloat(q.high);
      const low = parseFloat(q.low);
      const prevClose = parseFloat(q.previous_close);
      const change = price - prevClose;
      const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

      const quoteData: MarketQuote = {
        symbol: "XAUUSD",
        price: round2(price),
        change: round2(change),
        changePercent: round2(changePercent),
        high: round2(high > 0 ? high : price),
        low: round2(low > 0 ? low : price),
        open: round2(open > 0 ? open : price),
        timestamp: new Date(q.timestamp * 1000).toISOString(),
      };
      cache.quote = { data: quoteData, timestamp: Date.now() };
      console.log(`[MarketData] Initial XAU/USD spot: $${price.toFixed(2)} (REST, WS will take over)`);
    }
  }).catch(() => console.log("[MarketData] Initial quote fetch failed, waiting for WebSocket"));

  // 延迟加载 K 线数据
  setTimeout(() => { getDailyCandles().catch(() => {}); }, 3000);
  setTimeout(() => { getIntradayCandles().catch(() => {}); }, 5000);
  setTimeout(() => { getWeeklyCandles().catch(() => {}); }, 8000);

  // 定期刷新 K 线数据：每 60 秒检查一次
  let refreshCycle = 0;
  warmingInterval = setInterval(async () => {
    refreshCycle++;

    // 如果 WebSocket 断线，每 4 个周期（2分钟）用 REST 刷新报价
    if (!isWsConnected() && refreshCycle % 4 === 0) {
      try {
        // 强制走 REST（清除 quote 缓存让 getRealQuote 跳过 WS 分支）
        const tdQuote = await fetchQuote();
        if (tdQuote) {
          const price = parseFloat(tdQuote.close);
          const open = parseFloat(tdQuote.open);
          const high = parseFloat(tdQuote.high);
          const low = parseFloat(tdQuote.low);
          const prevClose = parseFloat(tdQuote.previous_close);
          const change = price - prevClose;
          const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

          cache.quote = {
            data: {
              symbol: "XAUUSD",
              price: round2(price),
              change: round2(change),
              changePercent: round2(changePercent),
              high: round2(high > 0 ? high : price),
              low: round2(low > 0 ? low : price),
              open: round2(open > 0 ? open : price),
              timestamp: new Date(tdQuote.timestamp * 1000).toISOString(),
            },
            timestamp: Date.now(),
          };
        }
      } catch { /* silent */ }
    }

    // 每 5 个周期（5分钟）刷新日内数据
    if (refreshCycle % 5 === 2) {
      try {
        if (!isCacheValid(cache.intradayCandles, CACHE_TTL.intraday)) {
          await getIntradayCandles();
        }
      } catch { /* silent */ }
    }

    // 每 30 个周期（30分钟）刷新日线数据
    if (refreshCycle % 30 === 5) {
      try {
        if (!isCacheValid(cache.dailyCandles, CACHE_TTL.daily)) {
          await getDailyCandles();
        }
      } catch { /* silent */ }
    }

    // 每 120 个周期（2小时）刷新周线数据
    if (refreshCycle % 120 === 10) {
      try {
        if (!isCacheValid(cache.weeklyCandles, CACHE_TTL.weekly)) {
          await getWeeklyCandles();
        }
      } catch { /* silent */ }
    }

    // 日志：每 60 个周期（1小时）输出状态
    if (refreshCycle % 60 === 0) {
      console.log(`[MarketData] Status: API calls=${dailyApiCalls}/800, WS=${isWsConnected() ? 'connected' : 'disconnected'}, price=$${cache.quote?.data?.price ?? 'N/A'}`);
    }
  }, 60 * 1000); // 每 60 秒检查一次（不是 30 秒了，因为 WS 负责实时报价）

  console.log("[MarketData] Cache warming started (WS for quotes, REST for K-lines)");
}

export function stopCacheWarming() {
  if (warmingInterval) {
    clearInterval(warmingInterval);
    warmingInterval = null;
  }
}
