import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import {
  ClipboardList,
  Loader2,
  RefreshCw,
  LogIn,
  Calendar,
  History,
  ChevronLeft,
} from "lucide-react";
import { useState } from "react";

export default function TradingPlan() {
  const { isAuthenticated } = useAuth();
  const [showHistory, setShowHistory] = useState(false);

  const { data: todayPlan, isLoading: loadingToday } = trpc.plan.today.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: planHistory } = trpc.plan.list.useQuery(undefined, {
    enabled: isAuthenticated && showHistory,
  });

  const generatePlan = trpc.plan.generate.useMutation({
    onSuccess: () => {
      // Refetch today's plan
      window.location.reload();
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <ClipboardList className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-lg font-semibold mb-2">今日交易计划</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">
          登录后 AI 将为你生成专业的日内交易计划
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2">
            <LogIn className="w-4 h-4" />
            登录系统
          </Button>
        </a>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowHistory(false)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-lg font-semibold">历史计划</h1>
        </div>
        <div className="space-y-3">
          {planHistory?.map((plan) => (
            <Card key={plan.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">{plan.planDate}</span>
                  </div>
                  {plan.bias && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      plan.bias === "bullish" ? "bg-green/10 text-green" :
                      plan.bias === "bearish" ? "bg-red/10 text-red" :
                      "bg-gold/10 text-gold"
                    }`}>
                      {plan.marketType ?? ""}
                    </span>
                  )}
                </div>
                <div className="text-xs prose prose-invert prose-sm max-w-none">
                  <Streamdown>{plan.content.slice(0, 200) + "..."}</Streamdown>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!planHistory || planHistory.length === 0) && (
            <div className="text-center py-8 text-muted-foreground text-sm">暂无历史计划</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">今日交易计划</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1"
            onClick={() => setShowHistory(true)}
          >
            <History className="w-3.5 h-3.5" />
            历史
          </Button>
        </div>
      </div>

      {/* Date */}
      <div className="text-xs text-muted-foreground">
        {new Date().toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "long",
        })}
      </div>

      {/* Generate Button */}
      {!todayPlan && !loadingToday && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-center">
            <ClipboardList className="w-10 h-10 text-primary mx-auto mb-3" />
            <h3 className="text-sm font-medium mb-1">尚未生成今日计划</h3>
            <p className="text-xs text-muted-foreground mb-3">
              AI 将根据当前市场环境生成完整的交易计划
            </p>
            <Button
              onClick={() => generatePlan.mutate()}
              disabled={generatePlan.isPending}
              className="gap-2"
            >
              {generatePlan.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  生成今日计划
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {loadingToday && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Plan Content */}
      {todayPlan && (
        <>
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <Streamdown>{todayPlan.content}</Streamdown>
              </div>
            </CardContent>
          </Card>

          {/* Regenerate */}
          <Button
            variant="outline"
            className="w-full gap-2"
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
        </>
      )}
    </div>
  );
}
