import { trpc } from "@/lib/trpc";
import { formatTimeCN, formatTimeShortCN, getTodayDateCN, useRealtimeClock } from "@/lib/timeUtils";
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
  Info,
  ChevronRight,
  ListChecks,
  Sparkles,
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
    refetchInterval: shouldFallback ? 3000 : false,
    staleTime: 2000,
  });
  const { data: fallbackBias } = trpc.market.dailyBias.useQuery(undefined, {
    enabled: shouldFallback,
    refetchInterval: shouldFallback ? 10000 : false,
    staleTime: 8000,
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

  // Realtime clock
  const realtimeClock = useRealtimeClock();
  const formatTime = formatTimeCN;

  const containerClass = isMobile
    ? "px-4 py-5 space-y-4 max-w-lg mx-auto"
    : "px-6 py-6 space-y-5 max-w-6xl mx-auto";

  return (
    <div className={containerClass}>
      {/* GoldBias Slogan Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gold/8 via-gold/4 to-transparent border border-gold/10 px-5 py-4">
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl bg-gold/5" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/25 to-gold/10 flex items-center justify-center border border-gold/20">
              <img src="/logo.png" alt="GoldBias" className="w-7 h-7 rounded-md" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">
                Gold<span className="text-gold">Bias</span>
              </h1>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                先判环境，再等位置，所有技术服务于止损
              </p>
            </div>
          </div>
          <Link href="/plan">
            <button className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gold/12 hover:bg-gold/20 border border-gold/15 text-gold text-xs font-semibold transition-all duration-300 hover:shadow-[0_0_12px_rgba(240,192,64,0.1)] press-scale">
              <ListChecks className="w-3.5 h-3.5" />
              <span className={isMobile ? "hidden" : ""}>今日执行清单</span>
              <span className={isMobile ? "" : "hidden"}>执行清单</span>
              <ChevronRight className="w-3 h-3 opacity-60" />
            </button>
          </Link>
        </div>
      </div>

      {/* Desktop: Top row with price + bias/risk side by side */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-3 gap-5"}>
        {/* Hero Price Section */}
        <div className={`card-base rounded-2xl p-5 relative overflow-hidden candle-pattern ${isMobile ? "" : "col-span-2"}`}>
          {/* Background gradient accent */}
          <div className={`absolute top-0 right-0 w-40 h-40 rounded-full blur-2xl opacity-8 ${
            priceUp ? "bg-green" : "bg-red"
          }`} />
          <div className={`absolute bottom-0 left-0 w-24 h-24 rounded-full blur-xl opacity-5 bg-gold`} />

          <div className="relative">
            {/* Header row */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2.5">
                {ws.isConnected ? (
                  <div className="status-dot status-dot-green" />
                ) : (
                  <div className="status-dot status-dot-gold animate-pulse" />
                )}
                <span className="text-[11px] text-muted-foreground font-semibold tracking-[0.15em] uppercase">
                  XAU / USD
                </span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gold/10 text-gold/70 font-semibold tracking-wider">
                  SPOT
                </span>
                {ws.isConnected ? (
                  <Wifi className="w-3 h-3 text-green/50" />
                ) : (
                  <WifiOff className="w-3 h-3 text-gold/50" />
                )}
              </div>
              <span className="text-[11px] text-gold/60 font-mono font-bold tracking-wider">
                {realtimeClock}
              </span>
            </div>

            {/* Price display */}
            <div className="flex items-end justify-between mt-4">
              <div>
                <div className="flex items-baseline gap-2.5">
                  {quoteLoading ? (
                    <div className="h-10 w-44 shimmer rounded-lg" />
                  ) : (
                    <span className={`font-mono font-extrabold tracking-tighter leading-none ${isMobile ? "text-[38px]" : "text-[46px]"} ${priceFlash === "up" ? "price-up" : priceFlash === "down" ? "price-down" : ""}`}>
                      {currentPrice > 0 ? currentPrice.toFixed(2) : "----"}
                    </span>
                  )}
                  {!quoteLoading && currentPrice > 0 && (
                    <span className="text-[10px] text-muted-foreground/40 font-medium pb-1">USD/oz</span>
                  )}
                </div>
                {quote && currentPrice > 0 && (
                  <div className={`flex items-center gap-2 mt-2 ${priceUp ? "text-green" : "text-red"}`}>
                    {priceUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                    <span className="text-sm font-mono font-bold">
                      {priceUp ? "+" : ""}{quote.change?.toFixed(2)}
                    </span>
                    <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md ${
                      priceUp ? "bg-green/10" : "bg-red/10"
                    }`}>
                      {priceUp ? "+" : ""}{quote.changePercent?.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>

              {/* OHLC data */}
              <div className="text-right space-y-1.5">
                {[
                  { label: "H", value: quote?.high },
                  { label: "L", value: quote?.low },
                  { label: "O", value: quote?.open },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 justify-end">
                    <span className="text-[9px] text-muted-foreground/50 font-semibold w-3 text-right">{item.label}</span>
                    <span className="text-[12px] font-mono font-medium text-foreground/70">
                      {item.value && item.value > 0 ? item.value.toFixed(2) : "----"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data source footer */}
            <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-border/10">
              <Info className="w-3 h-3 text-muted-foreground/30" />
              <span className="text-[9px] text-muted-foreground/30">
                现货价格来源: OTC Spot Market | 日内数据: COMEX GC Futures
              </span>
            </div>
          </div>
        </div>

        {/* Bias & Risk Status */}
        <div className={isMobile ? "grid grid-cols-2 gap-3" : "flex flex-col gap-4"}>
          <div className="card-base rounded-xl p-4 relative overflow-hidden hover-lift">
            <div className={`absolute inset-0 bg-gradient-to-br ${currentBias.bgClass} opacity-40`} />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Activity className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-[10px] text-muted-foreground/70 font-semibold tracking-[0.12em] uppercase">今日 Bias</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${currentBias.bgClass} flex items-center justify-center shadow-sm`}>
                  <BiasIcon className={`w-5 h-5 ${currentBias.color}`} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-tight ${currentBias.color}`}>
                    {bias?.biasLabel ?? "加载中"}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      bias?.confidence === "high" ? "bg-green" : bias?.confidence === "medium" ? "bg-gold" : "bg-red"
                    }`} />
                    <span className="text-[10px] text-muted-foreground/70">
                      {(bias?.confidence as string) === "high" ? "高置信" : (bias?.confidence as string) === "medium" ? "中置信" : "低置信"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card-base rounded-xl p-4 relative overflow-hidden hover-lift">
            <div className={`absolute inset-0 bg-gradient-to-br ${
              currentRisk.color === "text-green" ? "from-green/10 to-green/3" :
              currentRisk.color === "text-gold" ? "from-gold/10 to-gold/3" :
              "from-red/10 to-red/3"
            } opacity-40`} />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2.5">
                <Shield className="w-3 h-3 text-muted-foreground/60" />
                <span className="text-[10px] text-muted-foreground/70 font-semibold tracking-[0.12em] uppercase">风控状态</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                  currentRisk.color === "text-green" ? "bg-green/10" :
                  currentRisk.color === "text-gold" ? "bg-gold/10" : "bg-red/10"
                }`}>
                  <RiskIcon className={`w-5 h-5 ${currentRisk.color}`} />
                </div>
                <div>
                  <div className={`text-lg font-bold leading-tight ${currentRisk.color}`}>
                    {bias?.riskLabel ?? "加载中"}
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {getTodayDateCN()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop: Two-column layout */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-5"}>
        {/* Key Levels */}
        <div className="card-base rounded-2xl overflow-hidden">
          <div className="px-4 pt-4 pb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center">
                <Target className="w-3.5 h-3.5 text-gold" />
              </div>
              <span className="text-sm font-bold">今日关键位</span>
              <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-surface/80 text-muted-foreground/50 font-semibold tracking-wider">
                PIVOT
              </span>
            </div>
            {currentPrice > 0 && (
              <span className="text-[10px] text-muted-foreground/60 font-mono font-medium">
                当前 {currentPrice.toFixed(2)}
              </span>
            )}
          </div>
          <div className="px-3 pb-4">
            {bias?.keyLevels ? (
              <div className="space-y-1.5 stagger-enter">
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
                      className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl transition-all duration-300 ${
                        isNearPrice
                          ? "bg-gold/8 border border-gold/20 shadow-[0_0_12px_rgba(240,192,64,0.05)]"
                          : "bg-surface/40 hover:bg-surface/60 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-1 h-5 rounded-full ${bgClass}/50`} />
                        <span className={`text-xs font-semibold ${colorClass}/80`}>{level.label}</span>
                        {isNearPrice && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gold/15 text-gold font-bold animate-pulse tracking-wider">
                            NEAR
                          </span>
                        )}
                      </div>
                      <span className={`font-mono text-sm font-bold ${isNearPrice ? "text-gold" : "text-foreground/80"}`}>
                        {level.value.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1.5">
                {[1,2,3,4,5,6].map(i => (
                  <div key={i} className="h-11 shimmer rounded-xl" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: AI Summary + Calendar */}
        <div className="space-y-4">
          {/* AI Summary */}
          {bias?.summary && (
            <div className="card-base rounded-2xl p-5 border-gold/10 relative overflow-hidden gradient-border">
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 text-gold" />
                  </div>
                  <span className="text-xs font-bold text-gold">AI 市场观点</span>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-gold/6 text-gold/50 font-semibold ml-auto tracking-wider">
                    MULTI-FACTOR
                  </span>
                </div>
                <p className="text-[13px] leading-[1.8] text-foreground/80">{bias.summary}</p>
              </div>
            </div>
          )}

          {/* Economic Calendar */}
          <div className="card-base rounded-2xl overflow-hidden">
            <div className="px-4 pt-4 pb-2.5 flex items-center gap-2.5">
              <div className="w-6 h-6 rounded-lg bg-cyan/10 flex items-center justify-center">
                <Calendar className="w-3.5 h-3.5 text-cyan" />
              </div>
              <span className="text-sm font-bold">今日经济日历</span>
            </div>
            <div className="px-3 pb-4">
              <div className="space-y-1.5 stagger-enter">
                {calendar?.slice(0, 4).map((event: any, i: number) => (
                  <div
                    key={event.id ?? i}
                    className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-surface/30 hover:bg-surface/50 transition-all duration-250 border border-transparent hover:border-border/20"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-2 h-2 rounded-full ${
                        event.importance === "high" ? "bg-red shadow-[0_0_6px_rgba(255,80,80,0.3)]" :
                        event.importance === "medium" ? "bg-gold" : "bg-muted-foreground/40"
                      }`} />
                      <span className="text-[13px] font-medium">{event.name ?? event.event}</span>
                      {event.importance === "high" && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-md bg-red/10 text-red font-bold tracking-wider">
                          HIGH
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-muted-foreground/60 font-mono font-medium">
                      {formatTimeShortCN(event.time)}
                    </span>
                  </div>
                )) ?? (
                  <div className="text-center text-muted-foreground text-sm py-6">暂无数据</div>
                )}
              </div>
            </div>
          </div>

          {/* Session Status */}
          {bias?.sessions && (
            <div className="card-base rounded-2xl overflow-hidden">
              <div className="px-4 pt-4 pb-2.5 flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Clock className="w-3.5 h-3.5 text-gold" />
                </div>
                <span className="text-sm font-bold">盘面状态</span>
              </div>
              <div className="px-3 pb-4">
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: "亚洲盘", time: "08:00-16:00", status: bias.sessions.asia },
                    { label: "欧洲盘", time: "15:00-00:00", status: bias.sessions.europe },
                    { label: "美洲盘", time: "21:00-06:00", status: bias.sessions.us },
                  ].map((s) => (
                    <div key={s.label} className="bg-surface/50 rounded-xl p-3 text-center border border-border/10 hover:border-border/25 transition-all duration-250">
                      <div className="text-[10px] text-muted-foreground/60 mb-1.5 font-semibold tracking-wider">{s.label}</div>
                      <div className={`text-xs font-bold ${
                        s.status === "可交易" ? "text-green" : s.status === "谨慎" ? "text-gold" : "text-red"
                      }`}>
                        {s.status}
                      </div>
                      <div className="text-[8px] text-muted-foreground/40 mt-1 font-mono">{s.time}</div>
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
        <div className="card-base rounded-2xl p-6 text-center border-gold/10 gradient-border">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center mx-auto mb-4 border border-gold/15">
            <LogIn className="w-7 h-7 text-gold" />
          </div>
          <div className="text-base font-bold mb-1">登录后使用 AI 分析功能</div>
          <div className="text-[12px] text-muted-foreground/60 mb-5">获取专业交易决策辅助</div>
          <a href={getLoginUrl()}>
            <Button className="w-full gap-2 bg-gold/90 hover:bg-gold text-background font-bold h-12 rounded-xl transition-all duration-300 hover:shadow-[0_0_20px_rgba(240,192,64,0.15)]">
              <LogIn className="w-4 h-4" />
              登录系统
            </Button>
          </a>
        </div>
      ) : (
        <div className={isMobile ? "grid grid-cols-2 gap-3" : "grid grid-cols-4 gap-4"}>
          {[
            { href: "/chat", icon: MessageSquare, label: "AI 对话", desc: "专业分析问答", color: "text-gold", bg: "from-gold/12 to-gold/4", hoverBorder: "hover:border-gold/20" },
            { href: "/chart", icon: BarChart3, label: "图表分析", desc: "上传截图识别", color: "text-cyan", bg: "from-cyan/12 to-cyan/4", hoverBorder: "hover:border-cyan/20" },
            { href: "/plan", icon: ClipboardList, label: "交易计划", desc: "生成今日计划", color: "text-green", bg: "from-green/12 to-green/4", hoverBorder: "hover:border-green/20" },
            { href: "/news", icon: Newspaper, label: "新闻总结", desc: "黄金财经资讯", color: "text-red", bg: "from-red/12 to-red/4", hoverBorder: "hover:border-red/20" },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={`card-base rounded-xl p-4 cursor-pointer group transition-all duration-300 hover-lift ${item.hoverBorder}`}>
                <div className="flex items-start justify-between">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                    <item.icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-muted-foreground/50 group-hover:translate-x-0.5 transition-all duration-300" />
                </div>
                <div className="text-[13px] font-bold">{item.label}</div>
                <div className="text-[10px] text-muted-foreground/60 mt-0.5">{item.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Latest News Preview */}
      <div className="card-base rounded-2xl overflow-hidden">
        <div className="px-4 pt-4 pb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gold/10 flex items-center justify-center">
              <Newspaper className="w-3.5 h-3.5 text-gold" />
            </div>
            <span className="text-sm font-bold">最新资讯</span>
          </div>
          <Link href="/news">
            <span className="text-[11px] text-gold/70 cursor-pointer hover:text-gold transition-colors duration-200 flex items-center gap-1 font-medium">
              查看全部 <ChevronRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
        <div className="px-3 pb-4">
          <div className={isMobile ? "space-y-1.5 stagger-enter" : "grid grid-cols-3 gap-3 stagger-enter"}>
            {news?.slice(0, isMobile ? 3 : 6).map((item: any) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-2.5 px-3.5 rounded-xl bg-surface/25 hover:bg-surface/45 transition-all duration-250 border border-transparent hover:border-border/15"
              >
                <div className={`w-1 h-full min-h-[28px] rounded-full shrink-0 mt-0.5 ${
                  item.impact === "bullish" ? "bg-green/50" :
                  item.impact === "bearish" ? "bg-red/50" : "bg-gold/50"
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] leading-snug line-clamp-1 font-medium">{item.title}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] font-semibold ${
                      item.impact === "bullish" ? "text-green" :
                      item.impact === "bearish" ? "text-red" : "text-gold"
                    }`}>
                      {item.impactLabel}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">{item.source}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer with About link */}
      <div className="flex items-center justify-center gap-3 py-4 text-[10px] text-muted-foreground/40">
        <span>GoldBias v1.0</span>
        <span>&middot;</span>
        <Link href="/about">
          <span className="hover:text-gold/60 transition-colors cursor-pointer">关于 GoldBias</span>
        </Link>
        <span>&middot;</span>
        <span>by Traderynn</span>
      </div>
    </div>
  );
}
