/**
 * 构建实时市场上下文，注入到AI聊天系统提示词中
 */
import { getRealQuote, getRealDailyBias } from "./marketData";
import { getMockQuote, getMockDailyBias, getMockEconomicCalendar } from "./mockData";

export async function buildMarketContext(): Promise<string> {
  try {
    const [quote, biasData] = await Promise.all([
      getRealQuote().catch(() => getMockQuote()),
      getRealDailyBias().catch(() => getMockDailyBias()),
    ]);
    const events = getMockEconomicCalendar();
    const now = new Date();
    const utcHour = now.getUTCHours();
    let currentSession = "收盘后";
    if (utcHour >= 0 && utcHour < 8) currentSession = "亚洲盘";
    else if (utcHour >= 8 && utcHour < 13) currentSession = "欧盘";
    else if (utcHour >= 13 && utcHour < 21) currentSession = "美盘";

    const confidenceLabel = biasData.confidence === "high" ? "高" : biasData.confidence === "medium" ? "中" : "低";

    const eventLines = events.map((e) => {
      const timeStr = e.time.split("T")[1]?.slice(0, 5) ?? "";
      const impactLabel = e.importance === "high" ? "高影响" : e.importance === "medium" ? "中影响" : "低影响";
      return `- ${timeStr} ${e.name}（${impactLabel}）`;
    }).join("\n");

    const lines = [
      "",
      "",
      "## 当前实时市场数据（系统自动注入，请在回复中引用这些数据）",
      "",
      "### 实时报价",
      `- XAUUSD 当前价格：${quote.price.toFixed(2)}`,
      `- 今日涨跌：${quote.change >= 0 ? "+" : ""}${quote.change.toFixed(2)} (${quote.change >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)`,
      `- 今日最高：${quote.high.toFixed(2)}`,
      `- 今日最低：${quote.low.toFixed(2)}`,
      `- 今日开盘：${quote.open.toFixed(2)}`,
      `- 更新时间：${quote.timestamp}`,
      "",
      "### 今日偏向",
      `- Bias：${biasData.biasLabel}（置信度：${confidenceLabel}）`,
      `- 风控状态：${biasData.riskLabel}`,
      `- AI摘要：${biasData.summary}`,
      "",
      "### 关键位",
      `- R2（阻力2）：${biasData.keyLevels.resistance2.toFixed(2)}`,
      `- R1（阻力1）：${biasData.keyLevels.resistance1.toFixed(2)}`,
      `- 箱体上沿：${biasData.keyLevels.boxTop.toFixed(2)}`,
      `- 箱体下沿：${biasData.keyLevels.boxBottom.toFixed(2)}`,
      `- S1（支撑1）：${biasData.keyLevels.support1.toFixed(2)}`,
      `- S2（支撑2）：${biasData.keyLevels.support2.toFixed(2)}`,
      "",
      "### 盘面状态",
      `- 当前时段：${currentSession}`,
      `- 亚洲盘：${biasData.sessions.asia}`,
      `- 欧洲盘：${biasData.sessions.europe}`,
      `- 美洲盘：${biasData.sessions.us}`,
      "",
      "### 今日经济日历",
      eventLines,
      "",
      "**重要：请在你的回复中直接引用以上实时数据，不要说\"我无法获取实时数据\"。你已经拥有最新的市场数据。**",
    ];

    return lines.join("\n");
  } catch (err) {
    console.error("[MarketContext] Failed to build market context:", err);
    return "";
  }
}
