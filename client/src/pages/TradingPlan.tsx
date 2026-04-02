import { trpc } from "@/lib/trpc";
import { getFullDateCN, formatDateTimeCN } from "@/lib/timeUtils";
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
  Download,
  Eye,
} from "lucide-react";
import { useState, useCallback } from "react";

/** 将 Markdown 文本导出为 PDF（前端生成） */
async function exportPlanToPdf(content: string, planDate: string) {
  // 动态加载 html2canvas + jspdf 或者用简单的打印方式
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("请允许弹出窗口以导出PDF");
    return;
  }

  // 将 Markdown 转为简单 HTML
  const htmlContent = content
    .replace(/^### (.*$)/gm, '<h3 style="color:#d4a853;margin:16px 0 8px;">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 style="color:#d4a853;margin:20px 0 10px;">$1</h2>')
    .replace(/^# (.*$)/gm, '<h1 style="color:#d4a853;margin:24px 0 12px;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#d4a853;">$1</strong>')
    .replace(/\|(.*)\|/g, (match) => {
      const cells = match.split("|").filter(Boolean).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return "";
      const tag = match.includes("---") ? "th" : "td";
      return "<tr>" + cells.map(c => `<${tag} style="padding:6px 12px;border:1px solid #333;text-align:left;">${c}</${tag}>`).join("") + "</tr>";
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, '<table style="border-collapse:collapse;width:100%;margin:12px 0;">$&</table>')
    .replace(/^- (.*$)/gm, '<li style="margin:4px 0;">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul style="padding-left:20px;">$&</ul>')
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>交易计划 - ${planDate}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 40px 30px;
          color: #1a1a1a;
          line-height: 1.8;
          font-size: 14px;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #d4a853;
          padding-bottom: 16px;
          margin-bottom: 24px;
        }
        .header h1 {
          color: #d4a853;
          font-size: 22px;
          margin: 0 0 4px;
        }
        .header .date {
          color: #666;
          font-size: 13px;
        }
        h1, h2, h3 { color: #333; }
        strong { color: #b8860b; }
        table { border-collapse: collapse; width: 100%; margin: 12px 0; }
        th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; font-size: 13px; }
        th { background: #f5f0e0; color: #333; font-weight: 600; }
        .footer {
          margin-top: 30px;
          padding-top: 12px;
          border-top: 1px solid #eee;
          text-align: center;
          color: #999;
          font-size: 11px;
        }
        @media print {
          body { padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>GoldBias 交易计划</h1>
        <div class="date">${planDate}</div>
      </div>
      ${htmlContent}
      <div class="footer">
        GoldBias AI · 生成于 ${new Date().toLocaleString("zh-CN")}
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
  }, 500);
}

export default function TradingPlan() {
  const { isAuthenticated } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();

  const { data: todayPlan, isLoading: loadingToday } = trpc.plan.today.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: planHistory } = trpc.plan.list.useQuery(undefined, {
    enabled: isAuthenticated && showHistory,
  });

  const { data: selectedPlan, isLoading: loadingSelected } = trpc.plan.get.useQuery(
    { id: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );

  const generatePlan = trpc.plan.generate.useMutation({
    onSuccess: () => {
      utils.plan.today.invalidate();
    },
  });

  const handleExportPdf = useCallback((content: string, planDate: string) => {
    exportPlanToPdf(content, planDate);
  }, []);

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

  // ========== 历史计划详情页 ==========
  if (selectedPlanId && selectedPlan) {
    return (
      <div className={containerClass}>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedPlanId(null)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Calendar className="w-5 h-5 text-gold" />
            <h1 className="text-lg font-bold">{selectedPlan.planDate} 交易计划</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs text-muted-foreground hover:text-gold"
            onClick={() => handleExportPdf(selectedPlan.content, selectedPlan.planDate)}
          >
            <Download className="w-3.5 h-3.5" />
            导出
          </Button>
        </div>

        {(selectedPlan.marketType || selectedPlan.bias) && (
          <div className="flex items-center gap-2 flex-wrap">
            {selectedPlan.marketType && (
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-gold/10 text-gold border border-gold/15">
                {selectedPlan.marketType}
              </span>
            )}
            {selectedPlan.bias && (
              <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg ${
                selectedPlan.bias === "bullish" ? "bg-green/10 text-green border border-green/15" :
                selectedPlan.bias === "bearish" ? "bg-red/10 text-red border border-red/15" :
                "bg-gold/10 text-gold border border-gold/15"
              }`}>
                {selectedPlan.bias === "bullish" ? "偏多" : selectedPlan.bias === "bearish" ? "偏空" : "震荡"}
              </span>
            )}
          </div>
        )}

        <div className="card-base rounded-2xl p-4">
          <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed [&_h1]:text-gold [&_h2]:text-gold [&_h3]:text-gold/90 [&_strong]:text-gold/90 [&_code]:text-cyan [&_code]:bg-surface/50 [&_code]:px-1 [&_code]:rounded [&_li]:text-foreground/80 [&_p]:text-foreground/80">
            <Streamdown>{selectedPlan.content}</Streamdown>
          </div>
        </div>
      </div>
    );
  }

  // ========== 加载历史详情中 ==========
  if (selectedPlanId && loadingSelected) {
    return (
      <div className={containerClass}>
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gold mb-3" />
          <span className="text-xs text-muted-foreground">加载计划中...</span>
        </div>
      </div>
    );
  }

  // ========== 历史计划列表 ==========
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
              className="card-base rounded-xl p-4 cursor-pointer hover:border-gold/20 transition-all group"
              onClick={() => setSelectedPlanId(plan.id)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gold" />
                  <span className="text-sm font-semibold">{plan.planDate}</span>
                </div>
                <div className="flex items-center gap-2">
                  {plan.bias && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      plan.bias === "bullish" ? "bg-green/10 text-green" :
                      plan.bias === "bearish" ? "bg-red/10 text-red" :
                      "bg-gold/10 text-gold"
                    }`}>
                      {plan.marketType ?? (plan.bias === "bullish" ? "偏多" : plan.bias === "bearish" ? "偏空" : "震荡")}
                    </span>
                  )}
                  <Eye className="w-3.5 h-3.5 text-white/20 group-hover:text-gold/60 transition-colors" />
                </div>
              </div>
              <div className="text-xs text-foreground/50 line-clamp-3">
                {plan.content.replace(/[#*|]/g, "").slice(0, 150)}...
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

  // ========== 今日计划主页 ==========
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
        <div className="flex items-center gap-2">
          {todayPlan && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5 text-muted-foreground hover:text-gold"
              onClick={() => handleExportPdf(todayPlan.content, todayPlan.planDate)}
            >
              <Download className="w-3.5 h-3.5" />
              导出
            </Button>
          )}
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
