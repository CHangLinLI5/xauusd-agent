import { trpc } from "@/lib/trpc";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import { useIsMobile } from "@/hooks/useMobile";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  BarChart3,
  ClipboardList,
  Newspaper,
  Shield,
  Calendar,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  LogIn,
  Zap,
  Eye,
  Target,
  Clock,
  Wifi,
  WifiOff,
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const isMobile = useIsMobile();

  // WebSocket realtime data (primary)
  const ws = useMarketSocket();

  // tRPC fallback - only active when WebSocket is disconnected
  const shouldFallback = !ws.isConnected && !ws.quote;
  const { data: fallbackQuote } = trpc.market.quote.useQuery(undefined, {
    enabled: shouldFallback,
    refetchInterval: shouldFallback ? 8000 : false,
    staleTime: 5000,
  });
  const { data: fallbackBias } = trpc.market.dailyBias.useQuery(undefined, {
    enabled: shouldFallback,
    refetchInterval: shouldFallback ? 30000 : false,
    staleTime: 20000,
  });
  const { data: fallbackCalendar } = trpc.market.calendar.useQuery(undefined, {
    enabled: shouldFallback,
    refetchInterval: shouldFallback ? 120000 : false,
    staleTime: 60000,
  });
  const { data: fallbackNews } = trpc.market.news.useQuery(undefined, {
    enabled: shouldFallback,
    refetchInterval: shouldFallback ? 120000 : false,
    staleTime: 60000,
  });

  // Use WebSocket data if available, otherwise fallback to tRPC
  const quote = ws.quote ?? fallbackQuote;
  const bias = ws.bias ?? fallbackBias;
  const calendar = ws.calendar ?? fallbackCalendar;
  const news = ws.news ?? fallbackNews;

  const biasConfig = {
    bullish: { label: "偏多", icon: TrendingUp, color: "text-green", bgClass: "from-green/15 to-green/5", dotClass: "status-dot-green" },
    bearish: { label: "偏空", icon: TrendingDown, color: "text-red", bgClass: "from-red/15 to-red/5", dotClass: "status-dot-red" },
    ranging: { label: "震荡", icon: Minus, color: "text-gold", bgClass: "from-gold/15 to-gold/5", dotClass: "status-dot-gold" },
  };

  const riskConfig = {
    tradable: { label: "可交易", color: "text-green", dotClass: "status-dot-green", icon: Zap },
    cautious: { label: "谨慎观望", color: "text-gold", dotClass: "status-dot-gold", icon: Eye },
    no_trade: { label: "数据前禁入", color: "text-red", dotClass: "status-dot-red", icon: Shield },
  };

  const currentBias = bias ? biasConfig[bias.bias as keyof typeof biasConfig] : biasConfig.ranging;
  const currentRisk = bias ? riskConfig[bias.riskStatus as keyof typeof riskConfig] : riskConfig.tradable;
  const BiasIcon = currentBias.icon;
  const RiskIcon = currentRisk.icon;

  const currentPrice = quote?.price ?? 0;
  const priceUp = (quote?.change ?? 0) >= 0;
  const quoteLoading = !quote;

  // Price flash animation
  const prevPriceRef = useRef<number>(0);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);
  useEffect(() => {
    if (currentPrice > 0 && prevPriceRef.current > 0 && currentPrice !== prevPriceRef.current) {
      setPriceFlash(currentPrice > prevPriceRef.current ? "up" : "down");
      const timer = setTimeout(() => setPriceFlash(null), 600);
      return () => clearTimeout(timer);
    }
    prevPriceRef.current = currentPrice;
  }, [currentPrice]);

  // Responsive container class
  const containerClass = isMobile
    ? "px-4 py-5 space-y-4 max-w-lg mx-auto"
    : "px-6 py-6 space-y-5 max-w-6xl mx-auto";

  return (
    <div className={containerClass}>
      {/* Desktop: Top row with price + bias/risk side by side */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-3 gap-5"}>
        {/* Hero Price Section */}
        <div className={`card-base rounded-2xl p-4 relative overflow-hidden ${isMobile ? "" : "col-span-2"}`}>
          {/* Background gradient accent */}
          <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-xl opacity-10 ${
            priceUp ? "bg-green" : "bg-red"
          }`} />

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              {ws.isConnected ? (
                <div className="status-dot status-dot-green" />
              ) : (
                <div className="status-dot status-dot-gold animate-pulse" />
              )}
              <span className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">
                XAUUSD · 现货黄金 · {ws.isConnected ? "实时" : "延迟"}
              </span>
              {ws.isConnected ? (
                <Wifi className="w-3 h-3 text-green/60" />
              ) : (
                <WifiOff className="w-3 h-3 text-gold/60" />
              )}
            </div>

            <div className="flex items-end justify-between mt-3">
              <div>
                <div className="flex items-baseline gap-2">
                  {quoteLoading ? (
                    <div className="h-9 w-40 shimmer rounded" />
                  ) : (
                    <span className={`font-mono font-bold tracking-tighter leading-none ${isMobile ? "text-[36px]" : "text-[42px]"} ${priceFlash === "up" ? "price-up" : priceFlash === "down" ? "price-down" : ""}`}>
                      {currentPrice > 0 ? currentPrice.toFixed(2) : "----"}
                    </span>
                  )}
                </div>
                {quote && currentPrice > 0 && (
                  <div className={`flex items-center gap-1.5 mt-1.5 ${priceUp ? "text-green" : "text-red"}`}>
                    {priceUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span className="text-sm font-mono font-semibold">
                      {priceUp ? "+" : ""}{quote.change?.toFixed(2)}
                    </span>
                    <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${
                      priceUp ? "bg-green/10" : "bg-red/10"
                    }`}>
                      {priceUp ? "+" : ""}{quote.changePercent?.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              <div className="text-right space-y-1">
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[10px] text-muted-foreground">H</span>
                  <span className="text-xs font-mono font-medium text-foreground/80">
                    {quote?.high && quote.high > 0 ? quote.high.toFixed(2) : "----"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[10px] text-muted-foreground">L</span>
                  <span className="text-xs font-mono font-medium text-foreground/80">
                    {quote?.low && quote.low > 0 ? quote.low.toFixed(2) : "----"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <span className="text-[10px] text-muted-foreground">O</span>
                  <span className="text-xs font-mono font-medium text-foreground/80">
                    {quote?.open && quote.open > 0 ? quote.open.toFixed(2) : "----"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bias & Risk Status */}
        <div className={isMobile ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"}>
          <div className="card-base rounded-xl p-3.5 relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${currentBias.bgClass} opacity-50`} />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Activity className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">今日 Bias</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${currentBias.bgClass} flex items-center justify-center`}>
                  <BiasIcon className={`w-4.5 h-4.5 ${currentBias.color}`} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-tight ${currentBias.color}`}>
                    {bias?.biasLabel ?? "加载中"}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      bias?.confidence === "high" ? "bg-green" : bias?.confidence === "medium" ? "bg-gold" : "bg-red"
                    }`} />
                    <span className="text-[10px] text-muted-foreground">
                      {(bias?.confidence as string) === "high" ? "高置信" : (bias?.confidence as string) === "medium" ? "中置信" : "低置信"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card-base rounded-xl p-3.5 relative overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${
              currentRisk.color === "text-green" ? "from-green/10 to-green/3" :
              currentRisk.color === "text-gold" ? "from-gold/10 to-gold/3" :
              "from-red/10 to-red/3"
            } opacity-50`} />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground font-medium tracking-wider uppercase">风控状态</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  currentRisk.color === "text-green" ? "bg-green/10" :
                  currentRisk.color === "text-gold" ? "bg-gold/10" : "bg-red/10"
                }`}>
                  <RiskIcon className={`w-4.5 h-4.5 ${currentRisk.color}`} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-tight ${currentRisk.color}`}>
                    {bias?.riskLabel ?? "加载中"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric" })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Two-column layout for Key Levels + AI Summary + Calendar */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-5"}>
        {/* Key Levels - Visual Price Ladder */}
        <div className="card-base rounded-2xl overflow-hidden">
          <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-gold" />
              <span className="text-sm font-semibold">今日关键位</span>
            </div>
            {currentPrice > 0 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                当前 {currentPrice.toFixed(2)}
              </span>
            )}
          </div>
          <div className="px-3 pb-3.5">
            {bias?.keyLevels ? (
              <div className="space-y-1.5">
                {[
                  { label: "R2", value: bias.keyLevels.resistance2, type: "resistance" as const },
                  { label: "R1", value: bias.keyLevels.resistance1, type: "resistance" as const },
                  { label: "箱体上沿", value: bias.keyLevels.boxTop, type: "box" as const },
                  { label: "箱体下沿", value: bias.keyLevels.boxBottom, type: "box" as const },
                  { label: "S1", value: bias.keyLevels.support1, type: "support" as const },
                  { label: "S2", value: bias.keyLevels.support2, type: "support" as const },
                ].map((level) => {
                  const isNearPrice = currentPrice > 0 && Math.abs(level.value - currentPrice) / currentPrice < 0.005;
                  const colorClass = level.type === "resistance" ? "text-red" :
                    level.type === "support" ? "text-green" : "text-gold";
                  const bgClass = level.type === "resistance" ? "bg-red" :
                    level.type === "support" ? "bg-green" : "bg-gold";

                  return (
                    <div
                      key={level.label}
                      className={`flex items-center justify-between py-2 px-3 rounded-lg transition-all ${
                        isNearPrice
                          ? "bg-gold/10 border border-gold/20"
                          : "bg-surface/50 hover:bg-surface-elevated/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-1 h-4 rounded-full ${bgClass}/60`} />
                        <span className={`text-xs font-medium ${colorClass}/80`}>{level.label}</span>
                        {isNearPrice && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gold/20 text-gold font-medium animate-pulse">
                            接近
                          </span>
                        )}
                      </div>
                      <span className={`font-mono text-sm font-semibold ${isNearPrice ? "text-gold" : ""}`}>
                        {level.value.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-10 shimmer rounded-lg" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: AI Summary + Calendar */}
        <div className="space-y-4">
          {/* AI Summary */}
          {bias?.summary && (
            <div className="card-base rounded-2xl p-4 border-gold/15 relative overflow-hidden">
              <div className="relative">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-md bg-gold/15 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-gold" />
                  </div>
                  <span className="text-xs font-semibold text-gold">AI 市场观点</span>
                </div>
                <p className="text-[13px] leading-relaxed text-foreground/85">{bias.summary}</p>
              </div>
            </div>
          )}

          {/* Economic Calendar */}
          <div className="card-base rounded-2xl overflow-hidden">
            <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan" />
              <span className="text-sm font-semibold">今日经济日历</span>
            </div>
            <div className="px-3 pb-3.5">
              <div className="space-y-1">
                {calendar?.slice(0, 4).map((event: any, i: number) => (
                  <div
                    key={event.id ?? i}
                    className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface/30 hover:bg-surface/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${
                        event.importance === "high" ? "bg-red" : event.importance === "medium" ? "bg-gold" : "bg-muted-foreground"
                      }`} />
                      <span className="text-[13px]">{event.name ?? event.event}</span>
                      {event.importance === "high" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red/10 text-red font-medium">
                          高影响
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      {new Date(event.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )) ?? (
                  <div className="text-center text-muted-foreground text-sm py-4">暂无数据</div>
                )}
              </div>
            </div>
          </div>

          {/* Session Status */}
          {bias?.sessions && (
            <div className="card-base rounded-2xl overflow-hidden">
              <div className="px-4 pt-3.5 pb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-gold" />
                <span className="text-sm font-semibold">盘面状态</span>
              </div>
              <div className="px-3 pb-3.5">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "亚洲盘", time: "06:00-14:00", status: bias.sessions.asia },
                    { label: "欧洲盘", time: "14:00-20:30", status: bias.sessions.europe },
                    { label: "美洲盘", time: "20:30-06:00", status: bias.sessions.us },
                  ].map((s) => (
                    <div key={s.label} className="bg-surface/50 rounded-xl p-3 text-center">
                      <div className="text-[10px] text-muted-foreground mb-1 font-medium">{s.label}</div>
                      <div className={`text-xs font-semibold ${
                        s.status === "可交易" ? "text-green" : s.status === "谨慎" ? "text-gold" : "text-red"
                      }`}>
                        {s.status}
                      </div>
                      <div className="text-[9px] text-muted-foreground/60 mt-0.5">{s.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {!isAuthenticated ? (
        <div className="card-base rounded-2xl p-5 text-center border-gold/15">
          <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-3">
            <LogIn className="w-6 h-6 text-gold" />
          </div>
          <div className="text-sm text-foreground/80 mb-1">登录后使用 AI 分析功能</div>
          <div className="text-[11px] text-muted-foreground mb-4">获取专业交易决策辅助</div>
          <a href={getLoginUrl()}>
            <Button className="w-full gap-2 bg-gold/90 hover:bg-gold text-background font-semibold h-11 rounded-xl">
              <LogIn className="w-4 h-4" />
              登录系统
            </Button>
          </a>
        </div>
      ) : (
        <div className={isMobile ? "grid grid-cols-2 gap-3" : "grid grid-cols-4 gap-4"}>
          {[
            { href: "/chat", icon: MessageSquare, label: "AI 对话", desc: "专业分析问答", color: "text-gold", bg: "from-gold/12 to-gold/4" },
            { href: "/chart", icon: BarChart3, label: "图表分析", desc: "上传截图识别", color: "text-cyan", bg: "from-cyan/12 to-cyan/4" },
            { href: "/plan", icon: ClipboardList, label: "交易计划", desc: "生成今日计划", color: "text-green", bg: "from-green/12 to-green/4" },
            { href: "/news", icon: Newspaper, label: "新闻总结", desc: "黄金财经资讯", color: "text-red", bg: "from-red/12 to-red/4" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className="card-base rounded-xl p-3.5 cursor-pointer group transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.bg} flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform duration-200`}>
                  <item.icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="text-[13px] font-semibold">{item.label}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Latest News Preview */}
      <div className="card-base rounded-2xl overflow-hidden">
        <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold">最新资讯</span>
          </div>
          <Link href="/news">
            <span className="text-[11px] text-gold cursor-pointer hover:underline">查看全部 →</span>
          </Link>
        </div>
        <div className="px-3 pb-3.5">
          <div className={isMobile ? "space-y-1" : "grid grid-cols-3 gap-3"}>
            {news?.slice(0, isMobile ? 3 : 6).map((item: any) => (
              <div
                key={item.id}
                className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg bg-surface/30 hover:bg-surface/50 transition-colors"
              >
                <div className={`w-1 h-full min-h-[28px] rounded-full shrink-0 mt-0.5 ${
                  item.impact === "bullish" ? "bg-green/60" :
                  item.impact === "bearish" ? "bg-red/60" : "bg-gold/60"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-snug line-clamp-1 font-medium">{item.title}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium ${
                      item.impact === "bullish" ? "text-green" :
                      item.impact === "bearish" ? "text-red" : "text-gold"
                    }`}>
                      {item.impactLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{item.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Spacer for safe area */}
      <div className="h-2" />
    </div>
  );
}
