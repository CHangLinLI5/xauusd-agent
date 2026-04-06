/**
 * 构建实时市场上下文，注入到AI聊天系统提示词中
 * 数据来源：Twelve Data XAU/USD 现货
 * v4: 增强容错 — catch 块返回 mock 上下文而非空字符串；增加数据源标记和日志
 */
import { getRealQuote, getRealDailyBias } from "./marketData";
import { getMockQuote, getMockDailyBias } from "./mockData";
import { getEconomicCalendar } from "./calendarService";

/**
 * 将 quote + biasData + events 格式化为注入 system prompt 的文本块
 * 提取为独立函数，确保 try 和 catch 两条路径都能复用
 */
function formatMarketContext(
  quote: ReturnType<typeof getMockQuote>,
  biasData: ReturnType<typeof getMockDailyBias>,
  events: ReturnType<typeof getEconomicCalendar>,
  dataSource: "realtime" | "mock",
): string {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  let currentSession = "收盘后";
  if (utcHour >= 0 && utcHour < 8) currentSession = "亚洲盘";
  else if (utcHour >= 8 && utcHour < 13) currentSession = "欧盘";
  else if (utcHour >= 13 && utcHour < 21) currentSession = "美盘";

  // 判断是否接近整点（最后10分钟）
  const nearHourEnd = utcMin >= 50;
  // 判断是否接近数据发布
  const highImpactEvents = events.filter((e) => e.impact === "high");
  const nearDataRelease = highImpactEvents.some((e) => {
    const eventTime = new Date(e.time);
    const diffMin = (eventTime.getTime() - now.getTime()) / 60000;
    return diffMin >= 0 && diffMin <= 30;
  });

  const confidenceLabel = biasData.confidence === "high" ? "高" : biasData.confidence === "medium" ? "中" : "低";

  // 计算价格在箱体中的位置
  const boxRange = biasData.keyLevels.boxTop - biasData.keyLevels.boxBottom;
  const priceInBox = boxRange > 0
    ? ((quote.price - biasData.keyLevels.boxBottom) / boxRange * 100).toFixed(0)
    : "N/A";
  let pricePosition = "箱体中部";
  if (quote.price > biasData.keyLevels.boxTop) pricePosition = "箱体上方（突破）";
  else if (quote.price < biasData.keyLevels.boxBottom) pricePosition = "箱体下方（跌破）";
  else if (Number(priceInBox) > 80) pricePosition = "箱体上沿附近";
  else if (Number(priceInBox) < 20) pricePosition = "箱体下沿附近";

  // 只显示今天和明天的事件
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const todayEvents = events.filter((e) => e.time.startsWith(todayStr));
  const tomorrowEvents = events.filter((e) => e.time.startsWith(tomorrowStr));

  const formatEventLine = (e: typeof events[0]) => {
    const timeStr = e.time.split("T")[1]?.slice(0, 5) ?? "";
    const impactIcon = e.impact === "high" ? "🔴" : e.impact === "medium" ? "🟡" : "⚪";
    return `${impactIcon} ${timeStr} ${e.name}${e.forecast ? ` (预期${e.forecast})` : ""}`;
  };

  let eventLines = "";
  if (todayEvents.length > 0) {
    eventLines += "今日:\n" + todayEvents.map(formatEventLine).join("\n");
  }
  if (tomorrowEvents.length > 0) {
    if (eventLines) eventLines += "\n";
    eventLines += "明日:\n" + tomorrowEvents.map(formatEventLine).join("\n");
  }
  if (!eventLines) {
    eventLines = "今日无重要经济数据";
  }

  // 实时风险提醒
  const riskAlerts: string[] = [];
  if (nearDataRelease) riskAlerts.push("⚠️ 30分钟内有高影响数据发布，建议暂停交易");
  if (nearHourEnd) riskAlerts.push("⚠️ 接近整点，流动性可能下降");
  if (biasData.riskStatus === "no_trade") riskAlerts.push("🚫 当前为禁止交易时段");
  if (biasData.riskStatus === "cautious") riskAlerts.push("⚠️ 当前需谨慎操作");

  const sourceTag = dataSource === "mock" ? "（模拟数据，仅供参考）" : "";

  const lines = [
    "",
    "",
    "---",
    `## 📊 XAUUSD 实时市场数据${sourceTag}`,
    "",
    `**标的**: XAUUSD（现货黄金/美元）— 这是你唯一关注的品种`,
    `**XAUUSD Spot**: ${quote.price.toFixed(2)} | ${quote.change >= 0 ? "▲" : "▼"} ${Math.abs(quote.change).toFixed(2)} (${quote.change >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)`,
    `**日内区间**: ${quote.low.toFixed(2)} — ${quote.high.toFixed(2)} | 开盘: ${quote.open.toFixed(2)}`,
    `**当前时段**: ${currentSession} (${String(utcHour).padStart(2, "0")}:${String(utcMin).padStart(2, "0")} UTC)`,
    "",
    `**Bias**: ${biasData.biasLabel}（${confidenceLabel}置信） | 风控: ${biasData.riskLabel}`,
    "",
    "**关键位**:",
    `R2 ${biasData.keyLevels.resistance2.toFixed(2)} → R1 ${biasData.keyLevels.resistance1.toFixed(2)} → 📦箱体 [${biasData.keyLevels.boxBottom.toFixed(2)} ~ ${biasData.keyLevels.boxTop.toFixed(2)}] → S1 ${biasData.keyLevels.support1.toFixed(2)} → S2 ${biasData.keyLevels.support2.toFixed(2)}`,
    `**价格位置**: ${pricePosition}（箱体内${priceInBox}%位置）`,
    "",
    "**经济日历**:",
    eventLines,
  ];

  if (riskAlerts.length > 0) {
    lines.push("", "**实时风险提醒**:");
    riskAlerts.forEach((a) => lines.push(a));
  }

  lines.push(
    "",
    "---",
    "**你已拥有以上全部 XAUUSD 实时数据。直接引用具体数字进行分析，不要说无法获取数据，不要询问用户标的或周期。**"
  );

  return lines.join("\n");
}

export async function buildMarketContext(): Promise<string> {
  let dataSource: "realtime" | "mock" = "realtime";

  try {
    const [quote, biasData] = await Promise.all([
      getRealQuote().catch((err) => {
        console.warn("[MarketContext] getRealQuote failed, using mock:", (err as Error).message?.slice(0, 80));
        dataSource = "mock";
        return getMockQuote();
      }),
      getRealDailyBias().catch((err) => {
        console.warn("[MarketContext] getRealDailyBias failed, using mock:", (err as Error).message?.slice(0, 80));
        dataSource = "mock";
        return getMockDailyBias();
      }),
    ]);

    let events: ReturnType<typeof getEconomicCalendar> = [];
    try {
      events = getEconomicCalendar();
    } catch {
      console.warn("[MarketContext] getEconomicCalendar failed, using empty");
    }

    const result = formatMarketContext(quote, biasData, events, dataSource);
    console.log(`[MarketContext] Built context: ${result.length} chars, source=${dataSource}, price=${quote.price}`);
    return result;
  } catch (err) {
    // 最后的兜底：即使上面的逻辑全部失败，也要返回一个有效的 mock 上下文
    // 绝对不能返回空字符串，否则 LLM 会丧失所有市场数据感知
    console.error("[MarketContext] CRITICAL: All data sources failed, using emergency mock:", err);
    try {
      const mockQuote = getMockQuote();
      const mockBias = getMockDailyBias();
      return formatMarketContext(mockQuote, mockBias, [], "mock");
    } catch (innerErr) {
      // 连 mock 都失败了（理论上不可能），返回最小化硬编码上下文
      console.error("[MarketContext] FATAL: Even mock data failed:", innerErr);
      return `

---
## 📊 XAUUSD 实时市场数据（应急模式）

**标的**: XAUUSD（现货黄金/美元）— 这是你唯一关注的品种
**注意**: 实时数据暂时不可用，请基于你的交易体系和经验回答用户问题。
**你仍然只分析 XAUUSD，不要询问用户标的或周期。**
---`;
    }
  }
}
