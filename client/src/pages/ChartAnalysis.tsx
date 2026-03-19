import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
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
} from "lucide-react";

export default function ChartAnalysis() {
  const { isAuthenticated } = useAuth();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: history } = trpc.chart.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const uploadChart = trpc.chart.upload.useMutation();
  const analyzeChart = trpc.chart.analyze.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      if (!base64) return;

      setSelectedImage(ev.target?.result as string);
      setAnalyzing(true);
      setAnalysisResult(null);

      try {
        const { id, imageUrl } = await uploadChart.mutateAsync({
          imageBase64: base64,
          mimeType: file.type,
        });

        // Wait a bit then poll for result
        const result = await analyzeChart.mutateAsync({ id });
        setAnalysisResult(result.analysisResult);
      } catch (err) {
        setAnalysisResult("分析失败，请重试。");
      } finally {
        setAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <BarChart3 className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-lg font-semibold mb-2">图表分析</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">
          上传 MT4/TradingView/Sierra Chart 截图，AI 自动识别形态和关键位
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
          <h1 className="text-lg font-semibold">分析历史</h1>
        </div>
        <div className="space-y-3">
          {history?.map((item) => (
            <Card key={item.id} className="border-border/50">
              <CardContent className="p-3">
                <div className="flex gap-3">
                  <div className="w-16 h-16 rounded-lg bg-secondary/50 overflow-hidden shrink-0">
                    <img src={item.imageUrl} alt="Chart" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        item.status === "completed" ? "bg-green/10 text-green" :
                        item.status === "analyzing" ? "bg-gold/10 text-gold" :
                        item.status === "failed" ? "bg-red/10 text-red" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {item.status === "completed" ? "已完成" :
                         item.status === "analyzing" ? "分析中" :
                         item.status === "failed" ? "失败" : "待分析"}
                      </span>
                      {item.timeframe && (
                        <span className="text-[10px] text-muted-foreground">{item.timeframe}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {item.analysisResult?.slice(0, 100) ?? "等待分析..."}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {new Date(item.createdAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!history || history.length === 0) && (
            <div className="text-center py-8 text-muted-foreground text-sm">暂无分析记录</div>
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
          <BarChart3 className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">图表分析</h1>
        </div>
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

      {/* Upload Area */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {!selectedImage ? (
        <Card className="border-dashed border-2 border-border/50 hover:border-primary/30 transition-colors">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Upload className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-sm font-medium mb-1">上传图表截图</h3>
            <p className="text-xs text-muted-foreground mb-4">
              支持 MT4 / TradingView / Sierra Chart 截图
            </p>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
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
                size="sm"
                className="gap-1"
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
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Preview */}
          <Card className="border-border/50 overflow-hidden">
            <div className="relative">
              <img src={selectedImage} alt="Chart" className="w-full" />
              {analyzing && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <span className="text-sm text-primary">AI 正在分析图表...</span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Analysis Result */}
          {analysisResult && (
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">分析结果</span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{analysisResult}</Streamdown>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 gap-1"
              onClick={() => {
                setSelectedImage(null);
                setAnalysisResult(null);
              }}
            >
              <RefreshCw className="w-4 h-4" />
              重新上传
            </Button>
          </div>
        </>
      )}

      {/* Tips */}
      <Card className="border-border/50 bg-secondary/30">
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="font-medium text-foreground mb-1">AI 将自动识别：</div>
            <div>· 图表周期（M1-W1）</div>
            <div>· 支撑/阻力位、箱体区间</div>
            <div>· 2B、顶底分型、上P/下P/P+、孕线</div>
            <div>· W底/M顶、趋势中的W和M</div>
            <div>· 顶底转换位、过道区</div>
            <div>· 优质报价区判断</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
