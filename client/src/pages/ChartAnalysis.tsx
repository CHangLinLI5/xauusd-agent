import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { formatDateTimeCN } from "@/lib/timeUtils";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BarChart3,
  Upload,
  Image,
  Loader2,
  LogIn,
  History,
  ChevronLeft,
  RefreshCw,
  Camera,
  Scan,
  Eye,
  Target,
  Layers,
  Crosshair,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ZoomIn,
  X,
} from "lucide-react";

const FEATURES = [
  { icon: Target, label: "支撑/阻力位", desc: "关键价格水平识别" },
  { icon: Layers, label: "箱体/通道区", desc: "区间结构分析" },
  { icon: Crosshair, label: "形态识别", desc: "2B/分型/孕线/WM" },
  { icon: Eye, label: "优质报价", desc: "报价区判断" },
  { icon: TrendingUp, label: "趋势分析", desc: "多周期方向判断" },
  { icon: AlertTriangle, label: "风险提示", desc: "关键数据/事件预警" },
];

// ========== AI Agent Logo Component ==========
function AgentLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sizeMap = { sm: "w-6 h-6", md: "w-8 h-8", lg: "w-12 h-12" };
  const textMap = { sm: "text-[8px]", md: "text-[10px]", lg: "text-[14px]" };
  return (
    <div className={`${sizeMap[size]} rounded-xl bg-gradient-to-br from-gold/30 via-gold/15 to-gold/5 flex items-center justify-center border border-gold/25 shadow-[0_0_12px_rgba(240,192,64,0.1)]`}>
      <span className={`text-gradient-gold ${textMap[size]} font-extrabold tracking-tight`}>Au</span>
    </div>
  );
}

// ========== Analysis Report Renderer ==========
function AnalysisReport({ content }: { content: string }) {
  return (
    <div className="space-y-4">
      {/* Report Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border/20">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-cyan/5 flex items-center justify-center">
          <Scan className="w-4 h-4 text-cyan" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">AI 分析报告</h3>
          <p className="text-[10px] text-muted-foreground">GoldBias Chart Analysis Report</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green/10">
          <CheckCircle2 className="w-3 h-3 text-green" />
          <span className="text-[10px] font-medium text-green">分析完成</span>
        </div>
      </div>

      {/* Report Content */}
      <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-[1.8]
        [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-cyan [&_h1]:mt-5 [&_h1]:mb-2 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-cyan/15
        [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-cyan [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2
        [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:text-gold/90 [&_h3]:mt-3 [&_h3]:mb-1.5
        [&_strong]:text-gold
        [&_em]:text-cyan/80 [&_em]:not-italic [&_em]:font-medium
        [&_code]:text-cyan [&_code]:bg-cyan/8 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-[12px] [&_code]:font-mono
        [&_table]:w-full [&_table]:text-[12px] [&_table]:border-collapse [&_table]:rounded-lg [&_table]:overflow-hidden
        [&_thead]:bg-surface/80
        [&_th]:px-3 [&_th]:py-2 [&_th]:text-gold/80 [&_th]:font-semibold [&_th]:text-left [&_th]:border-b [&_th]:border-border/30
        [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-border/10
        [&_tr:hover]:bg-surface/30
        [&_hr]:border-border/15 [&_hr]:my-4
        [&_blockquote]:border-l-2 [&_blockquote]:border-gold/40 [&_blockquote]:bg-gold/5 [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:rounded-r-xl [&_blockquote]:text-foreground/85 [&_blockquote]:italic
        [&_ul]:space-y-1.5 [&_ol]:space-y-1.5
        [&_li]:text-foreground/85 [&_li]:leading-relaxed
        [&_li::marker]:text-gold/50
        [&_p]:text-foreground/90 [&_p]:leading-[1.8]
        [&_a]:text-cyan [&_a]:underline [&_a]:underline-offset-2
      ">
        <Streamdown>{content}</Streamdown>
      </div>
    </div>
  );
}

// ========== Image Preview Modal ==========
function ImagePreviewModal({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <button className="absolute top-4 right-4 p-2 rounded-lg bg-surface/80 text-muted-foreground hover:text-foreground transition-colors" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
      <img src={src} alt="Chart" className="max-w-full max-h-[85vh] rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

export default function ChartAnalysis() {
  const { isAuthenticated } = useAuth();
  const [view, setView] = useState<"main" | "history" | "detail">("main");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const utils = trpc.useUtils();

  const { data: history } = trpc.chart.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: historyDetail } = trpc.chart.get.useQuery(
    { id: selectedHistoryId! },
    { enabled: !!selectedHistoryId }
  );

  const uploadChart = trpc.chart.upload.useMutation();
  const analyzeChart = trpc.chart.analyze.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      if (!base64) return;

      setSelectedImage(ev.target?.result as string);
      setAnalyzing(true);
      setAnalysisResult(null);

      try {
        const { id } = await uploadChart.mutateAsync({
          imageBase64: base64,
          mimeType: file.type,
        });
        const result = await analyzeChart.mutateAsync({ id });
        setAnalysisResult(result.analysisResult);
        // Refresh history list
        utils.chart.list.invalidate();
      } catch {
        setAnalysisResult("分析失败，请重试。可能是 LLM API 不支持图片分析（Vision）功能。");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const openHistoryDetail = (id: number) => {
    setSelectedHistoryId(id);
    setView("detail");
  };

  const containerClass = isMobile
    ? "px-4 py-5 max-w-lg mx-auto space-y-4"
    : "px-6 py-6 max-w-5xl mx-auto space-y-5";

  // ========== Not authenticated ==========
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan/20 to-cyan/5 flex items-center justify-center mb-5 border border-cyan/15">
          <BarChart3 className="w-8 h-8 text-cyan" />
        </div>
        <h2 className="text-xl font-bold mb-2">图表分析</h2>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-[280px] leading-relaxed">
          上传 MT4/TradingView 截图，AI 自动识别形态、关键位和报价区
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2 bg-gold/90 hover:bg-gold text-background font-semibold h-11 px-6 rounded-xl">
            <LogIn className="w-4 h-4" />
            登录开始分析
          </Button>
        </a>
      </div>
    );
  }

  // ========== History Detail View ==========
  if (view === "detail" && historyDetail) {
    const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
      completed: { label: "分析完成", color: "text-green bg-green/10", icon: CheckCircle2 },
      analyzing: { label: "分析中", color: "text-gold bg-gold/10", icon: Loader2 },
      failed: { label: "分析失败", color: "text-red bg-red/10", icon: AlertTriangle },
      pending: { label: "待分析", color: "text-muted-foreground bg-surface-elevated", icon: Clock },
    };
    const status = statusConfig[historyDetail.status] || statusConfig.pending;
    const StatusIcon = status.icon;

    return (
      <div className={containerClass}>
        {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}

        {/* Header */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setView("history"); setSelectedHistoryId(null); }}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <BarChart3 className="w-5 h-5 text-cyan" />
            <h1 className="text-lg font-bold">分析详情</h1>
          </div>
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${status.color}`}>
            <StatusIcon className={`w-3 h-3 ${historyDetail.status === "analyzing" ? "animate-spin" : ""}`} />
            <span className="text-[11px] font-medium">{status.label}</span>
          </div>
        </div>

        {/* Chart Image */}
        <div className="card-base rounded-2xl overflow-hidden relative group cursor-pointer" onClick={() => setPreviewImage(historyDetail.imageUrl)}>
          <img src={historyDetail.imageUrl} alt="Chart" className="w-full" />
          <div className="absolute inset-0 bg-background/0 group-hover:bg-background/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm flex items-center gap-2 text-sm text-foreground">
              <ZoomIn className="w-4 h-4" />
              点击放大
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {formatDateTimeCN(historyDetail.createdAt)}
          </div>
          {historyDetail.timeframe && (
            <div className="flex items-center gap-1.5">
              <BarChart3 className="w-3 h-3" />
              <span className="font-mono">{historyDetail.timeframe}</span>
            </div>
          )}
        </div>

        {/* Analysis Result */}
        {historyDetail.analysisResult && historyDetail.status === "completed" ? (
          <div className="card-base rounded-2xl p-5">
            <AnalysisReport content={historyDetail.analysisResult} />
          </div>
        ) : historyDetail.status === "failed" ? (
          <div className="card-base rounded-2xl p-5">
            <div className="flex items-center gap-3 text-red">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="text-sm font-medium">分析失败</p>
                <p className="text-xs text-muted-foreground mt-1">{historyDetail.analysisResult || "请重试或检查 LLM API 配置"}</p>
              </div>
            </div>
          </div>
        ) : historyDetail.status === "analyzing" ? (
          <div className="card-base rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-gold animate-spin" />
              <div>
                <p className="text-sm font-medium text-gold">正在分析中...</p>
                <p className="text-xs text-muted-foreground mt-1">AI 正在识别图表形态和关键位</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card-base rounded-2xl p-5 text-center text-muted-foreground">
            <p className="text-sm">等待分析...</p>
          </div>
        )}
      </div>
    );
  }

  // ========== History List View ==========
  if (view === "history") {
    return (
      <div className={containerClass}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setView("main")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-cyan" />
            <h1 className="text-lg font-bold">分析历史</h1>
          </div>
          <span className="text-[11px] text-muted-foreground ml-auto">{history?.length ?? 0} 条记录</span>
        </div>
        <div className={isMobile ? "space-y-2.5" : "grid grid-cols-2 gap-4"}>
          {history?.map((item) => {
            const isCompleted = item.status === "completed";
            const isFailed = item.status === "failed";
            return (
              <div
                key={item.id}
                className="card-base rounded-xl p-3.5 cursor-pointer hover:border-gold/20 transition-all group"
                onClick={() => openHistoryDetail(item.id)}
              >
                <div className="flex gap-3">
                  <div className={`w-14 h-14 rounded-xl shrink-0 flex flex-col items-center justify-center border transition-all ${
                    isCompleted
                      ? "bg-gradient-to-br from-green/10 to-green/3 border-green/15 group-hover:border-green/30"
                      : item.status === "analyzing"
                      ? "bg-gradient-to-br from-gold/10 to-gold/3 border-gold/15 group-hover:border-gold/30"
                      : isFailed
                      ? "bg-gradient-to-br from-red/10 to-red/3 border-red/15 group-hover:border-red/30"
                      : "bg-gradient-to-br from-cyan/10 to-cyan/3 border-cyan/15 group-hover:border-cyan/30"
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5 text-green mb-0.5" />
                    ) : item.status === "analyzing" ? (
                      <Loader2 className="w-5 h-5 text-gold animate-spin mb-0.5" />
                    ) : isFailed ? (
                      <AlertTriangle className="w-5 h-5 text-red mb-0.5" />
                    ) : (
                      <BarChart3 className="w-5 h-5 text-cyan mb-0.5" />
                    )}
                    <span className="text-[8px] font-bold text-muted-foreground tracking-wider">XAU/USD</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        isCompleted ? "bg-green/10 text-green" :
                        item.status === "analyzing" ? "bg-gold/10 text-gold" :
                        isFailed ? "bg-red/10 text-red" :
                        "bg-surface-elevated text-muted-foreground"
                      }`}>
                        {isCompleted ? "已完成" :
                         item.status === "analyzing" ? "分析中" :
                         isFailed ? "失败" : "待分析"}
                      </span>
                      {item.timeframe && (
                        <span className="text-[10px] text-muted-foreground font-mono">{item.timeframe}</span>
                      )}
                    </div>
                    <div className="text-xs text-foreground/70 line-clamp-2">
                      {isCompleted && item.analysisResult
                        ? item.analysisResult.replace(/[#*_`>]/g, "").slice(0, 100)
                        : isFailed ? "分析失败，点击查看详情" : "点击查看详情..."}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {formatDateTimeCN(item.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {(!history || history.length === 0) && (
            <div className={`text-center py-16 ${isMobile ? "" : "col-span-2"}`}>
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">暂无分析记录</p>
              <p className="text-xs text-muted-foreground/60 mt-1">上传图表截图开始第一次分析</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== Main Upload View ==========
  return (
    <div className={containerClass}>
      {previewImage && <ImagePreviewModal src={previewImage} onClose={() => setPreviewImage(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan/15 to-cyan/5 flex items-center justify-center border border-cyan/15">
            <BarChart3 className="w-4.5 h-4.5 text-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-bold">图表分析</h1>
            <p className="text-[10px] text-muted-foreground">AI Vision · 智能图表识别</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-muted-foreground hover:text-cyan"
          onClick={() => setView("history")}
        >
          <History className="w-3.5 h-3.5" />
          历史 {history && history.length > 0 && <span className="text-[10px] bg-surface-elevated px-1.5 rounded-full">{history.length}</span>}
        </Button>
      </div>

      {/* Desktop: two-column layout for upload + features */}
      <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-5"}>
        {/* Upload Area */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileSelect}
          />

          {!selectedImage ? (
            <div className="card-base rounded-2xl p-6 text-center border-dashed border-2 border-border/30 hover:border-cyan/20 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/15 to-cyan/5 flex items-center justify-center mx-auto mb-4 border border-cyan/10">
                <Upload className="w-7 h-7 text-cyan" />
              </div>
              <h3 className="text-base font-bold mb-1.5">上传图表截图</h3>
              <p className="text-xs text-muted-foreground mb-5 max-w-[260px] mx-auto leading-relaxed">
                支持 MT4 / TradingView / Sierra Chart 截图，AI 将自动分析
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  variant="outline"
                  className="gap-2 h-10 px-5 rounded-xl border-border/30 hover:border-cyan/30 hover:bg-cyan/5 hover:text-cyan"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute("capture");
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Image className="w-4 h-4" />
                  选择图片
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 h-10 px-5 rounded-xl border-border/30 hover:border-cyan/30 hover:bg-cyan/5 hover:text-cyan"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute("capture", "environment");
                      fileInputRef.current.click();
                    }
                  }}
                >
                  <Camera className="w-4 h-4" />
                  拍照
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Preview */}
              <div className="card-base rounded-2xl overflow-hidden relative group cursor-pointer" onClick={() => !analyzing && setPreviewImage(selectedImage)}>
                <img src={selectedImage} alt="Chart" className="w-full" />
                {analyzing && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative">
                        <Scan className="w-12 h-12 text-cyan" />
                        <div className="absolute inset-0 animate-ping">
                          <Scan className="w-12 h-12 text-cyan/30" />
                        </div>
                      </div>
                      <span className="text-sm text-cyan font-semibold">AI 正在分析图表...</span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />
                        识别形态 · 标记关键位 · 判断报价区
                      </div>
                      <div className="w-48 h-1 bg-surface rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-gradient-to-r from-cyan/50 to-gold/50 rounded-full animate-[shimmer_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
                      </div>
                    </div>
                  </div>
                )}
                {!analyzing && (
                  <div className="absolute inset-0 bg-background/0 group-hover:bg-background/20 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-sm flex items-center gap-2 text-sm">
                      <ZoomIn className="w-4 h-4" />
                      放大查看
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis Result */}
              {analysisResult && (
                <div className="card-base rounded-2xl p-5">
                  <AnalysisReport content={analysisResult} />
                </div>
              )}

              {/* Actions */}
              <Button
                variant="outline"
                className="w-full gap-2 h-11 rounded-xl border-border/30 hover:border-cyan/30 hover:bg-cyan/5 hover:text-cyan transition-all"
                onClick={() => {
                  setSelectedImage(null);
                  setAnalysisResult(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                <RefreshCw className="w-4 h-4" />
                重新上传
              </Button>
            </div>
          )}
        </div>

        {/* Feature Grid */}
        <div className={isMobile ? "grid grid-cols-2 gap-2.5" : "grid grid-cols-2 gap-3 content-start"}>
          {FEATURES.map((feat) => (
            <div
              key={feat.label}
              className="card-base rounded-xl p-3.5 hover:border-cyan/15 transition-all group"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan/10 to-transparent flex items-center justify-center mb-2">
                <feat.icon className="w-3.5 h-3.5 text-cyan/70 group-hover:text-cyan transition-colors" />
              </div>
              <div className="text-[12px] font-semibold">{feat.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{feat.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
