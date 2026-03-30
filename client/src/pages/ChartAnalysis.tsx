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
} from "lucide-react";

const FEATURES = [
  { icon: Target, label: "支撑/阻力位", desc: "关键价格水平" },
  { icon: Layers, label: "箱体/过道区", desc: "区间结构识别" },
  { icon: Crosshair, label: "形态识别", desc: "2B/分型/孕线/WM" },
  { icon: Eye, label: "优质报价", desc: "报价区判断" },
];

export default function ChartAnalysis() {
  const { isAuthenticated } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const { data: history } = trpc.chart.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

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
      } catch {
        setAnalysisResult("分析失败，请重试。");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const containerClass = isMobile
    ? "px-4 py-5 max-w-lg mx-auto space-y-4"
    : "px-6 py-6 max-w-5xl mx-auto space-y-5";

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan/20 to-cyan/5 flex items-center justify-center mb-5">
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

  if (showHistory) {
    return (
      <div className={containerClass}>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => setShowHistory(false)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-cyan" />
            <h1 className="text-lg font-bold">分析历史</h1>
          </div>
        </div>
        <div className={isMobile ? "space-y-2.5" : "grid grid-cols-2 gap-4"}>
          {history?.map((item) => (
            <div
              key={item.id}
              className="card-base rounded-xl p-3.5"
            >
              <div className="flex gap-3">
                <div className="w-16 h-16 rounded-lg bg-surface-elevated overflow-hidden shrink-0">
                  <img src={item.imageUrl} alt="Chart" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                      item.status === "completed" ? "bg-green/10 text-green" :
                      item.status === "analyzing" ? "bg-gold/10 text-gold" :
                      item.status === "failed" ? "bg-red/10 text-red" :
                      "bg-surface-elevated text-muted-foreground"
                    }`}>
                      {item.status === "completed" ? "已完成" :
                       item.status === "analyzing" ? "分析中" :
                       item.status === "failed" ? "失败" : "待分析"}
                    </span>
                    {item.timeframe && (
                      <span className="text-[10px] text-muted-foreground font-mono">{item.timeframe}</span>
                    )}
                  </div>
                  <div className="text-xs text-foreground/70 line-clamp-2">
                    {item.analysisResult?.slice(0, 100) ?? "等待分析..."}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {formatDateTimeCN(item.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(!history || history.length === 0) && (
            <div className={`text-center py-16 ${isMobile ? "" : "col-span-2"}`}>
              <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">暂无分析记录</p>
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
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan/15 to-cyan/5 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-bold">图表分析</h1>
            <p className="text-[10px] text-muted-foreground">AI Vision 图表识别</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs gap-1.5 text-muted-foreground hover:text-cyan"
          onClick={() => setShowHistory(true)}
        >
          <History className="w-3.5 h-3.5" />
          历史
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
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/15 to-cyan/5 flex items-center justify-center mx-auto mb-4">
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
              <div className="card-base rounded-2xl overflow-hidden relative">
                <img src={selectedImage} alt="Chart" className="w-full" />
                {analyzing && (
                  <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <Scan className="w-10 h-10 text-cyan animate-pulse" />
                      <span className="text-sm text-cyan font-medium">AI 正在分析图表...</span>
                      <span className="text-[10px] text-muted-foreground">识别形态 · 标记关键位 · 判断报价区</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Analysis Result */}
              {analysisResult && (
                <div className="card-base rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
                    <Scan className="w-4 h-4 text-cyan" />
                    <span className="text-sm font-semibold">分析结果</span>
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed [&_h1]:text-cyan [&_h2]:text-cyan [&_h3]:text-cyan/90 [&_strong]:text-gold/90 [&_code]:text-cyan [&_code]:bg-surface/50 [&_code]:px-1 [&_code]:rounded [&_li]:text-foreground/80 [&_p]:text-foreground/80">
                    <Streamdown>{analysisResult}</Streamdown>
                  </div>
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
              className="card-base rounded-xl p-3"
            >
              <feat.icon className="w-4 h-4 text-cyan/60 mb-2" />
              <div className="text-[12px] font-semibold">{feat.label}</div>
              <div className="text-[10px] text-muted-foreground">{feat.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
