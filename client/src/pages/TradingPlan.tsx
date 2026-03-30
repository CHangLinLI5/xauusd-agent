import { trpc } from "@/lib/trpc";
import { getFullDateCN } from "@/lib/timeUtils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { useIsMobile } from "@/hooks/useMobile";
import {
  ClipboardList,
  Loader2,
  RefreshCw,
  LogIn,
  Calendar,
  History,
  ChevronLeft,
  Sparkles,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useState } from "react";

export default function TradingPlan() {
  const { isAuthenticated } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();

  const { data: todayPlan, isLoading: loadingToday } = trpc.plan.today.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: planHistory } = trpc.plan.list.useQuery(undefined, {
    enabled: isAuthenticated && showHistory,
  });

  const generatePlan = trpc.plan.generate.useMutation({
    onSuccess: () => {
      utils.plan.today.invalidate();
    },
  });

  const containerClass = isMobile
    ? "px-4 py-5 max-w-lg mx-auto space-y-4"
    : "px-6 py-6 max-w-4xl mx-auto space-y-5";

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green/20 to-green/5 flex items-center justify-center mb-5">
          <ClipboardList className="w-8 h-8 text-green" />
        </div>
        <h2 className="text-xl font-bold mb-2">今日交易计划</h2>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-[280px] leading-relaxed">
          AI 将根据当前市场环境为你生成专业的日内交易计划
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2 bg-gold/90 hover:bg-gold text-background font-semibold h-11 px-6 rounded-xl">
            <LogIn className="w-4 h-4" />
            登录生成计划
          </Button>
        </a>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className={containerClass}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowHistory(false)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gold" />
            <h1 className="text-lg font-bold">历史计划</h1>
          </div>
        </div>
        <div className={isMobile ? "space-y-2.5" : "grid grid-cols-2 gap-4"}>
          {planHistory?.map((plan) => (
            <div
              key={plan.id}
              className="card-base rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold" />
                  <span className="text-sm font-semibold">{plan.planDate}</span>
                </div>
                {plan.bias && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                    plan.bias === "bullish" ? "bg-green/10 text-green" :
                    plan.bias === "bearish" ? "bg-red/10 text-red" :
                    "bg-gold/10 text-gold"
                  }`}>
                    {plan.marketType ?? plan.bias}
                  </span>
                )}
              </div>
              <div className="text-xs prose prose-invert prose-sm max-w-none text-foreground/70 [&_strong]:text-gold/80">
                <Streamdown>{plan.content.slice(0, 200) + "..."}</Streamdown>
              </div>
            </div>
          ))}
          {(!planHistory || planHistory.length === 0) && (
            <div className={`text-center py-16 ${isMobile ? "" : "col-span-2"}`}>
              <History className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">暂无历史计划</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green/15 to-green/5 flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-green" />
          </div>
          <div>
            <h1 className="text-lg font-bold">今日交易计划</h1>
            <p className="text-[10px] text-muted-foreground">
              {getFullDateCN()}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-muted-foreground hover:text-gold"
          onClick={() => setShowHistory(true)}
        >
          <History className="w-3.5 h-3.5" />
          历史
        </Button>
      </div>

      {/* Generate Button */}
      {!todayPlan && !loadingToday && (
        <div className="card-base rounded-2xl p-6 text-center relative overflow-hidden">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green/15 to-green/5 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-green" />
            </div>
            <h3 className="text-base font-bold mb-1.5">尚未生成今日计划</h3>
            <p className="text-xs text-muted-foreground mb-5 max-w-[260px] mx-auto leading-relaxed">
              AI 将分析当前市场环境、关键位、经济日历，为你生成完整的日内交易计划
            </p>
            <Button
              onClick={() => generatePlan.mutate()}
              disabled={generatePlan.isPending}
              className="gap-2 bg-green/80 hover:bg-green text-background font-semibold h-11 px-6 rounded-xl"
            >
              {generatePlan.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  AI 分析生成中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  生成今日计划
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {loadingToday && (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-green mb-3" />
          <span className="text-xs text-muted-foreground">加载计划中...</span>
        </div>
      )}

      {/* Plan Content */}
      {todayPlan && (
        <div className="space-y-4">
          {/* Plan Meta */}
          {(todayPlan.marketType || todayPlan.bias) && (
            <div className="flex items-center gap-2 flex-wrap">
              {todayPlan.marketType && (
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/15">
                  {todayPlan.marketType}
                </span>
              )}
              {todayPlan.bias && (
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                  todayPlan.bias === "bullish" ? "bg-green/10 text-green border border-green/15" :
                  todayPlan.bias === "bearish" ? "bg-red/10 text-red border border-red/15" :
                  "bg-gold/10 text-gold border border-gold/15"
                }`}>
                  {todayPlan.bias === "bullish" ? "偏多" : todayPlan.bias === "bearish" ? "偏空" : "震荡"}
                </span>
              )}
            </div>
          )}

          {/* Main Content */}
          <div className="card-base rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
              <FileText className="w-4 h-4 text-gold" />
              <span className="text-sm font-semibold">计划详情</span>
            </div>
            <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed [&_h1]:text-gold [&_h2]:text-gold [&_h3]:text-gold/90 [&_strong]:text-gold/90 [&_code]:text-cyan [&_code]:bg-surface/50 [&_code]:px-1 [&_code]:rounded [&_li]:text-foreground/80 [&_p]:text-foreground/80">
              <Streamdown>{todayPlan.content}</Streamdown>
            </div>
          </div>

          {/* Regenerate */}
          <Button
            variant="outline"
            className="w-full gap-2 h-11 rounded-xl border-border/30 hover:border-green/30 hover:bg-green/5 hover:text-green transition-all"
            onClick={() => generatePlan.mutate()}
            disabled={generatePlan.isPending}
          >
            {generatePlan.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                重新生成中...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                重新生成计划
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
