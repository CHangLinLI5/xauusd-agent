/**
 * 新闻服务模块
 *
 * 从 Google News RSS 获取实时黄金/XAUUSD 相关新闻
 * 返回结构兼容前端 NewsItem 接口（mockData.ts 中定义）
 * 包含缓存机制，避免频繁请求
 * 降级到 Mock 数据
 */

import type { NewsItem } from "./mockData";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ========== Cache ==========

let newsCache: CacheEntry<NewsItem[]> | null = null;
const NEWS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ========== Google News RSS ==========

async function fetchGoogleNewsRSS(): Promise<NewsItem[]> {
  const queries = [
    "gold+price+XAUUSD",
    "gold+market+trading",
  ];

  const allItems: NewsItem[] = [];
  const seenTitles = new Set<string>();

  for (const query of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; XAUUSDAgent/1.0)" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) continue;

      const text = await response.text();
      const items = parseRSSItems(text);

      for (const item of items) {
        if (!seenTitles.has(item.title)) {
          seenTitles.add(item.title);
          allItems.push(item);
        }
      }
    } catch (error) {
      console.warn(`[NewsService] Google News RSS fetch failed for query "${query}":`, (error as Error).message?.slice(0, 80));
    }
  }

  return allItems.slice(0, 20); // Return top 20 unique items
}

function parseRSSItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  // Simple XML parsing for RSS items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  let index = 0;

  while ((match = itemRegex.exec(xml)) !== null && index < 30) {
    const itemXml = match[1]!;

    const title = extractTag(itemXml, "title");
    const pubDate = extractTag(itemXml, "pubDate");
    const source = extractTag(itemXml, "source");

    if (!title) continue;

    // Filter: only gold/XAUUSD related
    const lowerTitle = title.toLowerCase();
    const isGoldRelated = lowerTitle.includes("gold") ||
      lowerTitle.includes("xau") ||
      lowerTitle.includes("precious metal") ||
      lowerTitle.includes("bullion") ||
      lowerTitle.includes("黄金") ||
      lowerTitle.includes("fed") ||
      lowerTitle.includes("dollar") ||
      lowerTitle.includes("inflation") ||
      lowerTitle.includes("treasury") ||
      lowerTitle.includes("central bank");

    if (!isGoldRelated) continue;

    const cleanedTitle = cleanTitle(title);
    const category = categorizeNews(cleanedTitle);
    const impact = assessImpact(cleanedTitle);
    const impactLabel = impact === "bullish" ? "利多黄金" : impact === "bearish" ? "利空黄金" : "中性影响";
    const rhythm = assessRhythm(cleanedTitle);

    items.push({
      id: `news-${Date.now()}-${index}`,
      title: cleanedTitle,
      content: generateContent(cleanedTitle),
      summary: generateSummary(cleanedTitle),
      source: source || "Google News",
      publishedAt: pubDate ? formatTime(pubDate) : new Date().toISOString(),
      impact,
      impactLabel,
      category,
      rhythm,
    });

    index++;
  }

  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1]!.trim();

  // Handle regular content
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = regex.exec(xml);
  if (match) return match[1]!.trim();

  // Handle self-closing or inline with attributes
  const inlineRegex = new RegExp(`<${tag}[^>]*?(?:url="([^"]*)")?[^>]*>([^<]*)`);
  const inlineMatch = inlineRegex.exec(xml);
  if (inlineMatch) return inlineMatch[2]?.trim() || inlineMatch[1]?.trim() || null;

  return null;
}

function cleanTitle(title: string): string {
  return title
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function categorizeNews(title: string): string {
  const lower = title.toLowerCase();

  if (lower.includes("fed") || lower.includes("fomc") || lower.includes("powell") || lower.includes("interest rate")) {
    return "美联储";
  }
  if (lower.includes("central bank") || lower.includes("reserve") || lower.includes("pboc") || lower.includes("ecb")) {
    return "央行购金";
  }
  if (lower.includes("forecast") || lower.includes("prediction") || lower.includes("outlook") || lower.includes("target") || lower.includes("analyst")) {
    return "机构观点";
  }
  if (lower.includes("technical") || lower.includes("chart") || lower.includes("support") || lower.includes("resistance") || lower.includes("breakout")) {
    return "技术分析";
  }
  if (lower.includes("etf") || lower.includes("spdr") || lower.includes("gld") || lower.includes("fund")) {
    return "ETF动态";
  }
  if (lower.includes("inflation") || lower.includes("cpi") || lower.includes("gdp") || lower.includes("jobs") || lower.includes("nonfarm")) {
    return "CPI";
  }
  if (lower.includes("geopolit") || lower.includes("war") || lower.includes("tariff") || lower.includes("sanction") || lower.includes("tension")) {
    return "地缘政治";
  }
  if (lower.includes("dollar") || lower.includes("dxy") || lower.includes("usd")) {
    return "美元指数";
  }
  if (lower.includes("treasury") || lower.includes("bond") || lower.includes("yield")) {
    return "美债";
  }
  if (lower.includes("nonfarm") || lower.includes("payroll") || lower.includes("employment")) {
    return "非农";
  }

  return "市场动态";
}

function assessImpact(title: string): "bullish" | "bearish" | "neutral" {
  const lower = title.toLowerCase();

  // Bullish signals for gold
  const bullishKeywords = [
    "surge", "rally", "jump", "soar", "record", "all-time high",
    "rate cut", "dovish", "safe haven", "uncertainty", "crisis",
    "weak dollar", "inflation rise", "central bank buy",
    "breakout", "bullish", "upside", "gains",
  ];

  const bearishKeywords = [
    "drop", "fall", "decline", "crash", "plunge", "selloff",
    "rate hike", "hawkish", "strong dollar", "risk on",
    "bearish", "downside", "losses", "retreat",
  ];

  let bullishScore = 0;
  let bearishScore = 0;

  for (const kw of bullishKeywords) {
    if (lower.includes(kw)) bullishScore++;
  }
  for (const kw of bearishKeywords) {
    if (lower.includes(kw)) bearishScore++;
  }

  if (bullishScore > bearishScore) return "bullish";
  if (bearishScore > bullishScore) return "bearish";
  return "neutral";
}

function assessRhythm(title: string): string {
  const lower = title.toLowerCase();

  if (lower.includes("crash") || lower.includes("surge") || lower.includes("plunge") ||
    lower.includes("record") || lower.includes("all-time") || lower.includes("breakout")) {
    return "高波动";
  }
  if (lower.includes("steady") || lower.includes("stable") || lower.includes("range") ||
    lower.includes("consolidat")) {
    return "低波动";
  }
  return "中波动";
}

function generateSummary(title: string): string {
  const lower = title.toLowerCase();

  if (lower.includes("forecast") || lower.includes("prediction")) {
    return "市场分析机构发布黄金价格预测报告，关注后续走势方向和关键价位。";
  }
  if (lower.includes("surge") || lower.includes("rally") || lower.includes("jump") || lower.includes("gains")) {
    return "黄金价格大幅上涨，市场避险情绪升温推动金价走高，关注上方阻力位。";
  }
  if (lower.includes("drop") || lower.includes("fall") || lower.includes("decline") || lower.includes("crash")) {
    return "黄金价格出现回落，关注关键支撑位的防守情况和市场情绪变化。";
  }
  if (lower.includes("fed") || lower.includes("fomc") || lower.includes("powell")) {
    return "美联储政策动向引发市场关注，利率决议和官员讲话对黄金走势产生重要影响。";
  }
  if (lower.includes("dollar") || lower.includes("dxy")) {
    return "美元走势变化影响黄金定价，关注美元指数后续表现和相关性变化。";
  }
  if (lower.includes("inflation") || lower.includes("cpi")) {
    return "通胀数据公布，对黄金的避险属性和货币政策预期产生直接影响。";
  }
  if (lower.includes("technical") || lower.includes("chart")) {
    return "技术面分析显示黄金关键位变化，交易者关注突破或回调信号。";
  }
  if (lower.includes("etf")) {
    return "黄金ETF持仓变动反映机构资金流向，关注后续配置趋势。";
  }
  if (lower.includes("central bank") || lower.includes("reserve")) {
    return "各国央行黄金储备动态，央行购金行为持续影响金价中长期走势。";
  }
  if (lower.includes("tariff") || lower.includes("trade war") || lower.includes("geopolit")) {
    return "地缘政治风险升温，避险需求推动黄金市场关注度上升。";
  }

  return "黄金市场最新动态，关注价格走势和市场情绪变化对交易策略的影响。";
}

function generateContent(title: string): string {
  // Generate more detailed content based on the title
  const summary = generateSummary(title);
  return `${title}。${summary}交易者需密切关注相关数据和事件对黄金价格的影响，结合技术面分析制定交易策略。建议关注关键支撑阻力位的突破情况，严格执行风控纪律。`;
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ========== Public API ==========

/**
 * 获取黄金相关新闻
 * 优先从 Google News RSS 获取真实新闻，失败时使用 Mock
 * 返回结构兼容 mockData.ts 中的 NewsItem 接口
 */
export async function getGoldNews(): Promise<NewsItem[]> {
  // Check cache
  if (newsCache && Date.now() - newsCache.timestamp < NEWS_CACHE_TTL) {
    return newsCache.data;
  }

  try {
    const news = await fetchGoogleNewsRSS();
    if (news.length > 0) {
      console.log(`[NewsService] Fetched ${news.length} real news items from Google News RSS`);
      newsCache = { data: news, timestamp: Date.now() };
      return news;
    }
  } catch (error) {
    console.warn("[NewsService] Failed to fetch real news:", (error as Error).message?.slice(0, 80));
  }

  // Fallback: use mock data
  console.log("[NewsService] Using mock news data as fallback");
  const { getMockNews } = await import("./mockData");
  const mockNews = getMockNews();
  newsCache = { data: mockNews, timestamp: Date.now() };
  return mockNews;
}

/**
 * 强制刷新新闻缓存
 */
export function invalidateNewsCache() {
  newsCache = null;
}
