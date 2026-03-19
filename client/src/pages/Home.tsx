import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  MessageSquare,
  BarChart3,
  ClipboardList,
  Newspaper,
  Shield,
  Upload,
  Calendar,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  LogIn,
} from "lucide-react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { data: quote } = trpc.market.quote.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const { data: bias } = trpc.market.dailyBias.useQuery();
  const { data: calendar } = trpc.market.calendar.useQuery();
  const { data: news } = trpc.market.news.useQuery();

  const biasConfig = {
    bullish: { label: "偏多", icon: TrendingUp, color: "text-green", bg: "bg-green/10" },
    bearish: { label: "偏空", icon: TrendingDown, color: "text-red", bg: "bg-red/10" },
    ranging: { label: "震荡", icon: Minus, color: "text-gold", bg: "bg-gold/10" },
  };

  const riskConfig = {
    tradable: { label: "可交易", color: "text-green", bg: "bg-green/10" },
    cautious: { label: "谨慎观望", color: "text-gold", bg: "bg-gold/10" },
    no_trade: { label: "数据前禁入", color: "text-red", bg: "bg-red/10" },
  };

  const currentBias = bias ? biasConfig[bias.bias as keyof typeof biasConfig] : biasConfig.ranging;
  const currentRisk = bias ? riskConfig[bias.riskStatus as keyof typeof riskConfig] : riskConfig.tradable;
  const BiasIcon = currentBias.icon;

  return (
    <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
      {/* Price Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold font-mono tracking-tight">
              {quote?.price?.toFixed(2) ?? "---"}
            </span>
            {quote && (
              <span className={`flex items-center text-sm font-medium ${
                quote.change >= 0 ? "text-green" : "text-red"
              }`}>
                {quote.change >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {quote.change >= 0 ? "+" : ""}{quote.change?.toFixed(2)} ({quote.changePercent?.toFixed(2)}%)
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">XAUUSD · 现货黄金</span>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            H: <span className="text-foreground font-mono">{quote?.high?.toFixed(2) ?? "---"}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            L: <span className="text-foreground font-mono">{quote?.low?.toFixed(2) ?? "---"}</span>
          </div>
        </div>
      </div>

      {/* Today's Bias & Risk Status */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1.5">今日 Bias</div>
            <div className={`flex items-center gap-2 ${currentBias.color}`}>
              <div className={`w-8 h-8 rounded-lg ${currentBias.bg} flex items-center justify-center`}>
                <BiasIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-lg font-bold">{bias?.biasLabel ?? "加载中"}</div>
                <div className="text-[10px] text-muted-foreground">
                  置信度: {(bias?.confidence as string) === "high" ? "高" : (bias?.confidence as string) === "medium" ? "中" : "低"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-3">
            <div className="text-xs text-muted-foreground mb-1.5">风控状态</div>
            <div className={`flex items-center gap-2 ${currentRisk.color}`}>
              <div className={`w-8 h-8 rounded-lg ${currentRisk.bg} flex items-center justify-center`}>
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-lg font-bold">{bias?.riskLabel ?? "加载中"}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date().toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Key Levels */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <div className="w-1 h-4 rounded-full bg-primary" />
            今日关键位
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          {bias?.keyLevels ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] text-red/80 mb-0.5">阻力 R2</div>
                <div className="font-mono font-semibold text-sm">{bias.keyLevels.resistance2}</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] text-red/60 mb-0.5">阻力 R1</div>
                <div className="font-mono font-semibold text-sm">{bias.keyLevels.resistance1}</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] text-gold/80 mb-0.5">箱体上沿</div>
                <div className="font-mono font-semibold text-sm">{bias.keyLevels.boxTop}</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] text-gold/60 mb-0.5">箱体下沿</div>
                <div className="font-mono font-semibold text-sm">{bias.keyLevels.boxBottom}</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] text-green/60 mb-0.5">支撑 S1</div>
                <div className="font-mono font-semibold text-sm">{bias.keyLevels.support1}</div>
              </div>
              <div className="bg-secondary/50 rounded-lg p-2.5">
                <div className="text-[10px] text-green/80 mb-0.5">支撑 S2</div>
                <div className="font-mono font-semibold text-sm">{bias.keyLevels.support2}</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground text-sm py-4">加载中...</div>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      {bias?.summary && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3">
            <div className="text-xs text-primary mb-1">AI 观点</div>
            <div className="text-sm leading-relaxed">{bias.summary}</div>
          </CardContent>
        </Card>
      )}

      {/* Economic Calendar */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <CardTitle className="text-sm font-medium flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            今日经济日历
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            {calendar?.slice(0, 4).map((event) => (
              <div key={event.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={event.importance === "high" ? "destructive" : "secondary"}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {event.importance === "high" ? "高" : event.importance === "medium" ? "中" : "低"}
                  </Badge>
                  <span className="text-sm">{event.name}</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(event.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )) ?? (
              <div className="text-center text-muted-foreground text-sm py-2">暂无数据</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Session Status */}
      {bias?.sessions && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-gold" />
              盘面状态
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "亚洲盘", status: bias.sessions.asia },
                { label: "欧洲盘", status: bias.sessions.europe },
                { label: "美洲盘", status: bias.sessions.us },
              ].map((s) => (
                <div key={s.label} className="bg-secondary/50 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-muted-foreground mb-1">{s.label}</div>
                  <div className={`text-xs font-medium ${
                    s.status === "可交易" ? "text-green" : s.status === "谨慎" ? "text-gold" : "text-red"
                  }`}>
                    {s.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      {!isAuthenticated ? (
        <Card className="border-primary/20">
          <CardContent className="p-4 text-center">
            <div className="text-sm text-muted-foreground mb-3">登录后使用 AI 分析功能</div>
            <a href={getLoginUrl()}>
              <Button className="w-full gap-2">
                <LogIn className="w-4 h-4" />
                登录系统
              </Button>
            </a>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Link href="/chat">
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">AI 对话</div>
                  <div className="text-[10px] text-muted-foreground">专业分析问答</div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/chart">
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Upload className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">图表分析</div>
                  <div className="text-[10px] text-muted-foreground">上传截图识别</div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/plan">
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">交易计划</div>
                  <div className="text-[10px] text-muted-foreground">生成今日计划</div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/news">
            <Card className="border-border/50 hover:border-primary/30 transition-colors cursor-pointer">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Newspaper className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm font-medium">新闻总结</div>
                  <div className="text-[10px] text-muted-foreground">黄金财经资讯</div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {/* Latest News Preview */}
      <Card className="border-border/50">
        <CardHeader className="pb-2 pt-3 px-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-1.5">
              <Newspaper className="w-4 h-4 text-primary" />
              最新资讯
            </CardTitle>
            <Link href="/news">
              <span className="text-xs text-primary cursor-pointer">查看全部</span>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <div className="space-y-2">
            {news?.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] px-1.5 py-0 shrink-0 mt-0.5 ${
                    item.impact === "bullish" ? "text-green border-green/30" :
                    item.impact === "bearish" ? "text-red border-red/30" :
                    "text-gold border-gold/30"
                  }`}
                >
                  {item.impactLabel}
                </Badge>
                <div className="min-w-0">
                  <div className="text-sm leading-tight line-clamp-1">{item.title}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.source}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
