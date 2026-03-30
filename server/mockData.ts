/**
 * Mock 数据模块 v3
 *
 * 改进点：
 * - Mock 价格更新到 4500+ 水平（2026年3月实际价位）
 * - 新闻内容更丰富、更贴近真实市场
 * - 经济日历使用动态日期，不再硬编码
 * - Mock 报价使用合理的基准价格
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
      title: "美联储维持利率不变，鲍威尔暗示年内可能降息",
      source: "Reuters",
      category: "美联储",
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      summary: "美联储在最新议息会议中维持联邦基金利率不变。鲍威尔在新闻发布会上表示，通胀正在朝着2%目标回落，如果经济数据继续支持，年内可能启动降息周期。市场对此反应积极，黄金价格短线拉升。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "高波动",
      content: "美联储在3月议息会议中一致决定维持联邦基金利率在当前水平不变。美联储主席鲍威尔在随后的新闻发布会上表示，近期通胀数据显示物价压力正在缓解，核心PCE指数已连续数月回落。他指出，如果这一趋势持续，联储可能在今年晚些时候开始降息。鲍威尔同时强调，降息的时机和幅度将取决于经济数据的表现，联储不会预设任何路径。市场对鲍威尔的鸽派言论反应积极，美元指数短线走弱，黄金价格快速拉升突破关键阻力位。",
    },
    {
      id: "2",
      title: "美国2月CPI同比回落至2.8%，低于市场预期",
      source: "Bloomberg",
      category: "CPI",
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
      summary: "美国2月CPI同比增长2.8%，低于市场预期的3.0%，环比仅增长0.1%。核心CPI同比降至3.1%，为2021年以来最低。数据公布后美元走弱，黄金受到明显提振。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "单边上行",
      content: "美国劳工部公布的最新消费者价格指数显示，2月CPI同比增长2.8%，低于经济学家预期的3.0%。环比仅增长0.1%，为近六个月最低涨幅。核心CPI（剔除食品和能源）同比增长3.1%，同样低于预期。住房成本增速放缓是通胀降温的主要推动因素。数据公布后，市场对美联储年内降息的预期大幅升温，联邦基金期货显示6月降息概率升至75%。美元指数应声下跌，黄金价格在数据公布后30分钟内上涨超过20美元。",
    },
    {
      id: "3",
      title: "全球央行持续增持黄金储备，中国连续第16个月买入",
      source: "World Gold Council",
      category: "央行购金",
      publishedAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
      summary: "世界黄金协会最新报告显示，全球央行2月净购入黄金45吨。中国人民银行连续第16个月增持黄金储备，累计增持超过300吨。央行持续购金为金价提供了强劲的底部支撑。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "震荡偏多",
      content: "世界黄金协会发布的最新月度报告显示，全球央行在2月份净购入黄金45吨，延续了自2022年以来的强劲购金趋势。其中，中国人民银行增持约10吨，连续第16个月增加黄金储备，累计增持已超过300吨。波兰、印度和土耳其央行也是主要买家。分析师指出，央行购金反映了去美元化趋势和对地缘政治风险的对冲需求，这为黄金价格提供了坚实的底部支撑。",
    },
    {
      id: "4",
      title: "美国非农就业数据超预期，新增就业27.5万",
      source: "FX Street",
      category: "非农",
      publishedAt: new Date(now.getTime() - 24 * 3600000).toISOString(),
      summary: "美国2月非农就业人数增加27.5万，大幅超出市场预期的20万。失业率维持在3.6%低位，平均时薪环比增长0.3%。强劲的就业数据短期内对黄金形成一定压力，但市场认为不改变降息大方向。",
      impact: "bearish",
      impactLabel: "利空黄金",
      rhythm: "短期回调",
      content: "美国劳工部公布的2月非农就业报告显示，新增非农就业人数27.5万，远超市场预期的20万。失业率维持在3.6%，劳动参与率小幅上升至62.6%。平均时薪环比增长0.3%，同比增长4.1%。虽然就业数据强劲，但市场普遍认为这不会改变美联储年内降息的大方向，因为通胀数据已经明显降温。黄金在数据公布后短线下跌约15美元，但随后逐步收复失地。",
    },
    {
      id: "5",
      title: "美债收益率全线回落，10年期跌破4.0%关口",
      source: "MarketWatch",
      category: "美债",
      publishedAt: new Date(now.getTime() - 3 * 3600000).toISOString(),
      summary: "美国10年期国债收益率跌破4.0%心理关口，为近两个月新低。2年期和10年期利差持续收窄。收益率下行降低了持有黄金的机会成本，对金价形成直接利好。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "震荡偏多",
      content: "美国国债市场今日出现明显买盘，推动收益率全线走低。10年期国债收益率跌破4.0%关键心理关口，报3.95%，为近两个月最低水平。2年期收益率也下跌至4.35%，2s10s利差收窄至-40个基点。市场分析师认为，通胀降温和经济放缓预期是推动国债买盘的主要因素。对黄金而言，实际利率下降直接降低了持有黄金的机会成本，历史上这种环境通常有利于金价上涨。",
    },
    {
      id: "6",
      title: "地缘政治紧张局势持续，避险需求支撑金价",
      source: "CNBC",
      category: "地缘政治",
      publishedAt: new Date(now.getTime() - 6 * 3600000).toISOString(),
      summary: "中东和东欧地缘政治紧张局势持续升级，全球避险情绪升温。黄金作为传统避险资产受到资金青睐，ETF持仓连续三周净流入。分析师预计地缘风险溢价短期内难以消退。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "高波动",
      content: "全球地缘政治风险持续发酵，中东地区冲突没有缓和迹象，东欧局势也面临新的不确定性。在此背景下，全球避险资金持续流入黄金市场。全球最大黄金ETF——SPDR Gold Trust的持仓量连续三周增加，累计增持约15吨。分析师指出，当前地缘政治风险为黄金提供了额外的风险溢价，预计在局势明朗之前，金价将维持高位运行。",
    },
    {
      id: "7",
      title: "美元指数跌至103下方，多头动能持续减弱",
      source: "DailyFX",
      category: "美元指数",
      publishedAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
      summary: "美元指数跌破103关口，创近一个月新低。欧元和日元走强对美元形成双重压力。技术面显示美元短期均线系统空头排列，美元走弱环境对黄金构成持续利好。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "震荡",
      content: "美元指数今日延续弱势，跌破103关键支撑位，报102.85，创近一个月新低。欧元兑美元升至1.0950上方，日元也因日本央行加息预期走强。技术面上，美元指数已跌破5日、10日和20日均线，短期均线系统呈空头排列。分析师认为，美联储降息预期升温和其他主要央行相对鹰派的立场是美元走弱的主要原因。美元走弱通常有利于以美元计价的黄金价格上涨。",
    },
    {
      id: "8",
      title: "高盛上调黄金目标价至5000美元，看好长期前景",
      source: "Goldman Sachs",
      category: "机构观点",
      publishedAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
      summary: "高盛最新研报将12个月黄金目标价从4500美元上调至5000美元。报告指出，央行购金需求、降息周期启动和地缘风险三重因素将继续推动金价上行。",
      impact: "bullish",
      impactLabel: "利多黄金",
      rhythm: "中期看多",
      content: "高盛在最新发布的贵金属研究报告中，将12个月黄金价格目标从4500美元上调至5000美元/盎司。报告认为，三大结构性因素将继续支撑金价：一是全球央行持续增持黄金储备的趋势不会逆转；二是美联储即将进入降息周期，实际利率下降利好黄金；三是全球地缘政治不确定性持续存在。高盛分析师还指出，黄金ETF持仓仍远低于2020年的峰值水平，意味着投资需求仍有很大的上升空间。",
    },
  ];
}

export function getMockEconomicCalendar(): EconomicEvent[] {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

  return [
    {
      id: "e1",
      time: `${today}T08:30:00Z`,
      name: "欧元区制造业PMI终值",
      importance: "medium",
      forecast: "47.5",
      previous: "46.6",
      currency: "EUR",
    },
    {
      id: "e2",
      time: `${today}T12:30:00Z`,
      name: "美国个人消费支出(PCE)物价指数",
      importance: "high",
      forecast: "2.5%",
      previous: "2.6%",
      currency: "USD",
    },
    {
      id: "e3",
      time: `${today}T13:30:00Z`,
      name: "美国初请失业金人数",
      importance: "medium",
      forecast: "22.0万",
      previous: "21.5万",
      currency: "USD",
    },
    {
      id: "e4",
      time: `${today}T14:00:00Z`,
      name: "美国ISM制造业PMI",
      importance: "high",
      forecast: "50.5",
      previous: "49.2",
      currency: "USD",
    },
    {
      id: "e5",
      time: `${today}T15:00:00Z`,
      name: "美国成屋销售",
      importance: "low",
      forecast: "410万",
      previous: "404万",
      currency: "USD",
    },
    {
      id: "e6",
      time: `${today}T17:00:00Z`,
      name: "美联储官员讲话（沃勒）",
      importance: "high",
      currency: "USD",
    },
    {
      id: "e7",
      time: `${today}T19:30:00Z`,
      name: "EIA原油库存",
      importance: "medium",
      forecast: "-120万桶",
      previous: "+180万桶",
      currency: "USD",
    },
    {
      id: "e8",
      time: `${tomorrow}T12:30:00Z`,
      name: "美国非农就业人数",
      importance: "high",
      forecast: "20.0万",
      previous: "27.5万",
      currency: "USD",
    },
  ];
}

export function getMockQuote(): MarketQuote {
  // Use a realistic base price for 2026 gold market (~$4500-4600)
  const basePrice = 4550 + Math.random() * 40 - 20;
  const change = Math.round((Math.random() * 30 - 15) * 100) / 100;
  return {
    symbol: "XAUUSD",
    price: Math.round(basePrice * 100) / 100,
    change,
    changePercent: Math.round((change / basePrice) * 10000) / 100,
    high: Math.round((basePrice + Math.random() * 25 + 5) * 100) / 100,
    low: Math.round((basePrice - Math.random() * 25 - 5) * 100) / 100,
    open: Math.round((basePrice + Math.random() * 10 - 5) * 100) / 100,
    timestamp: new Date().toISOString(),
  };
}

export function getMockDailyBias() {
  return {
    bias: "bullish" as const,
    biasLabel: "偏多",
    confidence: "medium" as const,
    keyLevels: {
      resistance1: 4600,
      resistance2: 4650,
      support1: 4520,
      support2: 4480,
      boxTop: 4590,
      boxBottom: 4530,
    },
    riskStatus: "tradable" as const,
    riskLabel: "可交易",
    summary: "日线级别多头趋势延续，H4箱体震荡偏多，关注4600突破情况",
    sessions: {
      asia: "谨慎" as const,
      europe: "可交易" as const,
      us: "可交易" as const,
    },
  };
}
