/**
 * Mock 数据模块
 * 在真实 API 接入前，提供模拟数据
 */

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  category: string;
  publishedAt: string;
  summary: string;
  impact: "bullish" | "bearish" | "neutral";
  impactLabel: string;
  rhythm: string;
  content: string;
}

export interface EconomicEvent {
  id: string;
  time: string;
  name: string;
  importance: "high" | "medium" | "low";
  actual?: string;
  forecast?: string;
  previous?: string;
  currency: string;
}

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  timestamp: string;
}

export function getMockNews(): NewsItem[] {
  const now = new Date();
  return [
    {
      id: "1",
      title: "美联储会议纪要显示官员对通胀前景存在分歧",
      source: "Reuters",
      category: "美联储",
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      summary: "美联储最新会议纪要显示，多数官员认为当前利率水平适当，但对通胀回落速度存在分歧。部分委员倾向于维持高利率更长时间，另一部分则关注经济放缓风险。市场对年内降息预期有所调整。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "高波动",
      content: "美联储最新公布的会议纪要详细内容显示，联储官员对当前经济形势的评估出现明显分化...",
    },
    {
      id: "2",
      title: "美国CPI数据低于预期，通胀降温信号明显",
      source: "Bloomberg",
      category: "CPI",
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
      summary: "美国最新CPI数据环比增长0.1%，低于市场预期的0.2%。核心CPI同比回落至3.2%，为近两年最低水平。数据公布后美元指数快速走弱，黄金短线拉升。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "单边上行",
      content: "美国劳工部公布的消费者价格指数数据显示通胀持续降温...",
    },
    {
      id: "3",
      title: "中东地缘局势升级，避险情绪推升金价",
      source: "CNBC",
      category: "地缘政治",
      publishedAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
      summary: "中东地区紧张局势进一步升级，多方冲突风险加剧。全球避险资金涌入黄金市场，金价在亚洲盘时段即出现明显上涨。分析师认为地缘风险溢价短期内难以消退。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "高波动",
      content: "中东地区最新局势发展引发市场广泛关注...",
    },
    {
      id: "4",
      title: "美国非农就业数据强劲，美元走强",
      source: "FX Street",
      category: "非农",
      publishedAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
      summary: "上月非农就业人数增加25万，远超市场预期的18万。失业率维持在3.7%低位。强劲的就业数据支撑美元走强，对黄金形成短期压力。",
      impact: "bearish",
      impactLabel: "利空黄金",
      rhythm: "单边下行",
      content: "美国劳工部公布的非农就业报告显示劳动力市场依然强劲...",
    },
    {
      id: "5",
      title: "美债收益率回落，10年期跌破4.2%",
      source: "MarketWatch",
      category: "美债",
      publishedAt: new Date(now.getTime() - 3 * 3600000).toISOString(),
      summary: "美国10年期国债收益率跌破4.2%关键水平，为近一个月新低。收益率下行降低了持有黄金的机会成本，对金价形成支撑。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "震荡偏多",
      content: "美国国债市场今日出现明显买盘...",
    },
    {
      id: "6",
      title: "美元指数跌至104下方，多头动能减弱",
      source: "DailyFX",
      category: "美元指数",
      publishedAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
      summary: "美元指数跌破104关口，技术面显示多头动能明显减弱。欧元和英镑走强对美元形成压力，美元走弱环境有利于黄金上行。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "震荡",
      content: "美元指数今日延续弱势...",
    },
  ];
}

export function getMockEconomicCalendar(): EconomicEvent[] {
  const today = new Date().toISOString().split("T")[0];
  return [
    {
      id: "e1",
      time: `${today}T13:30:00Z`,
      name: "美国初请失业金人数",
      importance: "medium",
      forecast: "21.5万",
      previous: "21.2万",
      currency: "USD",
    },
    {
      id: "e2",
      time: `${today}T15:00:00Z`,
      name: "美国成屋销售",
      importance: "low",
      forecast: "395万",
      previous: "404万",
      currency: "USD",
    },
    {
      id: "e3",
      time: `${today}T17:00:00Z`,
      name: "美联储官员讲话",
      importance: "high",
      currency: "USD",
    },
    {
      id: "e4",
      time: `${today}T19:30:00Z`,
      name: "EIA原油库存",
      importance: "medium",
      forecast: "-150万桶",
      previous: "+200万桶",
      currency: "USD",
    },
  ];
}

export function getMockQuote(): MarketQuote {
  const basePrice = 3038 + Math.random() * 20 - 10;
  return {
    symbol: "XAUUSD",
    price: Math.round(basePrice * 100) / 100,
    change: Math.round((Math.random() * 20 - 10) * 100) / 100,
    changePercent: Math.round((Math.random() * 1 - 0.5) * 100) / 100,
    high: Math.round((basePrice + Math.random() * 15) * 100) / 100,
    low: Math.round((basePrice - Math.random() * 15) * 100) / 100,
    open: Math.round((basePrice + Math.random() * 5 - 2.5) * 100) / 100,
    timestamp: new Date().toISOString(),
  };
}

export function getMockDailyBias() {
  return {
    bias: "bullish" as const,
    biasLabel: "偏多",
    confidence: "medium" as const,
    keyLevels: {
      resistance1: 3055,
      resistance2: 3070,
      support1: 3025,
      support2: 3010,
      boxTop: 3055,
      boxBottom: 3025,
    },
    riskStatus: "tradable" as const,
    riskLabel: "可交易",
    summary: "日线级别多头趋势延续，H4箱体震荡偏多，关注3055突破情况",
    sessions: {
      asia: "谨慎" as const,
      europe: "可交易" as const,
      us: "可交易" as const,
    },
  };
}
