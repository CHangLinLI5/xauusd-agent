/**
 * 构建实时市场上下文，注入到AI聊天系统提示词中
 * 数据来源：fawazahmed0 Currency API (现货) + YahooFinance GC=F (日内波动)
 * v2: 更紧凑的格式，减少冗余，增加可操作信息
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
    const utcMin = now.getUTCMinutes();
    let currentSession = "收盘后";
    if (utcHour >= 0 && utcHour < 8) currentSession = "亚洲盘";
    else if (utcHour >= 8 && utcHour < 13) currentSession = "欧盘";
    else if (utcHour >= 13 && utcHour < 21) currentSession = "美盘";

    // 判断是否接近整点（最后10分钟）
    const nearHourEnd = utcMin >= 50;
    // 判断是否接近数据发布
    const highImpactEvents = events.filter((e) => e.importance === "high");
    const nearDataRelease = highImpactEvents.some((e) => {
      const eventHour = parseInt(e.time.split("T")[1]?.slice(0, 2) ?? "99");
      const eventMin = parseInt(e.time.split("T")[1]?.slice(3, 5) ?? "99");
      const diffMin = (eventHour - utcHour) * 60 + (eventMin - utcMin);
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

    const eventLines = events.map((e) => {
      const timeStr = e.time.split("T")[1]?.slice(0, 5) ?? "";
      const impactIcon = e.importance === "high" ? "🔴" : e.importance === "medium" ? "🟡" : "⚪";
      return `${impactIcon} ${timeStr} ${e.name}${e.forecast ? ` (预期${e.forecast})` : ""}`;
    }).join("\n");

    // 实时风险提醒
    const riskAlerts: string[] = [];
    if (nearDataRelease) riskAlerts.push("⚠️ 30分钟内有高影响数据发布，建议暂停交易");
    if (nearHourEnd) riskAlerts.push("⚠️ 接近整点，流动性可能下降");
    if (biasData.riskStatus === "no_trade") riskAlerts.push("🚫 当前为禁止交易时段");
    if (biasData.riskStatus === "cautious") riskAlerts.push("⚠️ 当前需谨慎操作");

    const lines = [
      "",
      "",
      "---",
      "## 📊 实时市场数据",
      "",
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
      "**你已拥有以上全部实时数据。直接引用具体数字进行分析，不要说无法获取数据。**"
    );

    return lines.join("\n");
  } catch (err) {
    console.error("[MarketContext] Failed to build market context:", err);
    return "";
  }
}
