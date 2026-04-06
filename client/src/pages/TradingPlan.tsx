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
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("请允许弹出窗口以导出PDF");
    return;
  }

  // 预处理：清理 Markdown 中的分隔线
  const cleaned = content.replace(/^---$/gm, "").trim();

  // 将 Markdown 转为结构化 HTML
  const htmlContent = cleaned
    // 标题
    .replace(/^### (.*$)/gm, '<h3>$1</h3>')
    .replace(/^## (.*$)/gm, '<h2>$1</h2>')
    .replace(/^# (.*$)/gm, '<h1>$1</h1>')
    // 加粗
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    // 表格
    .replace(/\|(.*?)\|/g, (match) => {
      const cells = match.split("|").filter(Boolean).map(c => c.trim());
      if (cells.every(c => /^[-:]+$/.test(c))) return "";
      return "<tr>" + cells.map(c => `<td>${c}</td>`).join("") + "</tr>";
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>')
    // 有序列表
    .replace(/^(\d+)\. (.*$)/gm, '<li class="ol">$2</li>')
    .replace(/(<li class="ol">.*<\/li>\n?)+/g, '<ol>$&</ol>')
    // 无序列表
    .replace(/^- (.*$)/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // 段落换行
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");

  const generatedTime = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>交易计划 - ${planDate}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: A4;
          margin: 20mm 18mm 25mm 18mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "Segoe UI", Roboto, sans-serif;
          max-width: 720px;
          margin: 0 auto;
          padding: 0;
          color: #2c2c2c;
          line-height: 1.75;
          font-size: 13px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* ===== Header ===== */
        .header {
          text-align: center;
          padding-bottom: 14px;
          margin-bottom: 20px;
          border-bottom: 2px solid #c5a44e;
        }
        .header .brand {
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: #999;
          margin-bottom: 4px;
        }
        .header h1 {
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 2px 0;
        }
        .header h1 span {
          color: #c5a44e;
        }
        .header .meta {
          font-size: 12px;
          color: #888;
          margin-top: 4px;
        }
        .header .meta .sep {
          margin: 0 8px;
          color: #ccc;
        }

        /* ===== Content ===== */
        .content {
          padding: 0;
        }
        .content h1 {
          font-size: 17px;
          font-weight: 700;
          color: #1a1a1a;
          margin: 22px 0 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #e8e0cc;
        }
        .content h2 {
          font-size: 15px;
          font-weight: 700;
          color: #333;
          margin: 18px 0 8px;
          padding-left: 10px;
          border-left: 3px solid #c5a44e;
        }
        .content h3 {
          font-size: 14px;
          font-weight: 600;
          color: #444;
          margin: 14px 0 6px;
        }
        .content p {
          margin: 6px 0;
          color: #333;
        }
        .content strong {
          color: #8b6914;
          font-weight: 600;
        }

        /* ===== Tables ===== */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0 14px;
          font-size: 12px;
        }
        table tr:first-child td {
          background: #f8f4ea;
          font-weight: 600;
          color: #5a4a1e;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        td {
          padding: 7px 10px;
          border: 1px solid #e5dfd0;
          color: #444;
          vertical-align: top;
        }
        tr:nth-child(even) td {
          background: #fdfcf9;
        }

        /* ===== Lists ===== */
        ul, ol {
          padding-left: 18px;
          margin: 6px 0 10px;
        }
        li {
          margin: 3px 0;
          color: #444;
          line-height: 1.7;
        }

        /* ===== Footer ===== */
        .footer {
          margin-top: 28px;
          padding-top: 12px;
          border-top: 1px solid #e5dfd0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 10px;
          color: #aaa;
        }
        .footer .left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .footer .dot {
          width: 3px;
          height: 3px;
          background: #ccc;
          border-radius: 50%;
          display: inline-block;
        }

        /* ===== Disclaimer ===== */
        .disclaimer {
          margin-top: 16px;
          padding: 10px 14px;
          background: #fafaf8;
          border: 1px solid #f0ece0;
          border-radius: 4px;
          font-size: 9px;
          color: #bbb;
          line-height: 1.6;
          text-align: center;
        }

        @media print {
          body { padding: 0; }
          .disclaimer { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">Traderynn · GoldBias</div>
        <h1>XAUUSD <span>交易计划</span></h1>
        <div class="meta">
          ${planDate}
          <span class="sep">|</span>
          goldbias.cn
        </div>
      </div>

      <div class="content">
        <p>${htmlContent}</p>
      </div>

      <div class="footer">
        <div class="left">
          <span>Traderynn</span>
          <span class="dot"></span>
          <span>goldbias.cn</span>
        </div>
        <div>${generatedTime}</div>
      </div>

      <div class="disclaimer">
        免责声明：本交易计划仅供参考，不构成任何投资建议。交易有风险，入市需谨慎。作者及 GoldBias 不对因使用本计划产生的任何损失承担责任。
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
