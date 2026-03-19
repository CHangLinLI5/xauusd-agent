import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  Settings,
  Save,
  ArrowLeft,
  Newspaper,
  Calendar,
  Bot,
  Shield,
  RefreshCw,
  Loader2,
} from "lucide-react";

export default function AdminConfig() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"news" | "calendar" | "model" | "risk">("model");

  // Model config
  const [systemPrompt, setSystemPrompt] = useState("");
  const [temperature, setTemperature] = useState("0.7");
  const [maxTokens, setMaxTokens] = useState("2000");

  const { data: configs } = trpc.config.getAll.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

  const saveConfig = trpc.config.set.useMutation({
    onSuccess: () => toast.success("配置已保存"),
    onError: () => toast.error("保存失败"),
  });

  useEffect(() => {
    if (configs) {
      const promptConfig = configs.find((c: any) => c.configKey === "system_prompt");
      const tempConfig = configs.find((c: any) => c.configKey === "temperature");
      const tokensConfig = configs.find((c: any) => c.configKey === "max_tokens");
      if (promptConfig) setSystemPrompt(promptConfig.configValue);
      if (tempConfig) setTemperature(tempConfig.configValue);
      if (tokensConfig) setMaxTokens(tokensConfig.configValue);
    }
  }, [configs]);

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Shield className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold mb-2">权限不足</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">
          仅管理员可访问后台配置
        </p>
        <Link href="/">
          <Button variant="outline">返回首页</Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { key: "model" as const, label: "模型参数", icon: Bot },
    { key: "news" as const, label: "新闻源", icon: Newspaper },
    { key: "calendar" as const, label: "经济日历", icon: Calendar },
    { key: "risk" as const, label: "风控规则", icon: Shield },
  ];

  return (
    <div className="px-4 py-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <Settings className="w-5 h-5 text-primary" />
        <h1 className="text-lg font-semibold">后台配置</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Model Config */}
      {activeTab === "model" && (
        <div className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm font-medium">系统提示词</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                className="w-full h-40 bg-secondary/50 rounded-lg p-3 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="输入 XAUUSD Agent 的系统提示词..."
              />
              <Button
                size="sm"
                className="mt-2 gap-1"
                onClick={() => saveConfig.mutate({ key: "system_prompt", value: systemPrompt, description: "XAUUSD Agent 系统提示词" })}
                disabled={saveConfig.isPending}
              >
                {saveConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                保存
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm font-medium">模型参数</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Temperature</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Max Tokens</label>
                <input
                  type="number"
                  step="100"
                  min="100"
                  max="8000"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
              <Button
                size="sm"
                className="gap-1"
                onClick={async () => {
                  await saveConfig.mutateAsync({ key: "temperature", value: temperature, description: "LLM Temperature" });
                  await saveConfig.mutateAsync({ key: "max_tokens", value: maxTokens, description: "LLM Max Tokens" });
                }}
                disabled={saveConfig.isPending}
              >
                {saveConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                保存参数
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-3 px-3">
              <CardTitle className="text-sm font-medium">API 状态</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">自定义 LLM</span>
                  <Badge variant="outline" className="text-green border-green/30 text-[10px]">已配置</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">新闻 API</span>
                  <Badge variant="outline" className="text-gold border-gold/30 text-[10px]">Mock 数据</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">行情 API</span>
                  <Badge variant="outline" className="text-gold border-gold/30 text-[10px]">Mock 数据</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">经济日历 API</span>
                  <Badge variant="outline" className="text-gold border-gold/30 text-[10px]">Mock 数据</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* News Sources */}
      {activeTab === "news" && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-medium">新闻源配置</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-2">
              {["美联储新闻", "非农/CPI/PCE/PPI", "ISM/初请失业金", "美元指数/美债", "地缘政治", "央行动态"].map((source) => (
                <div key={source} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm">{source}</span>
                  <Badge variant="outline" className="text-gold border-gold/30 text-[10px]">Mock</Badge>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              当前使用 Mock 数据。接入真实新闻 API 后可在此配置数据源。
            </p>
          </CardContent>
        </Card>
      )}

      {/* Calendar Config */}
      {activeTab === "calendar" && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-medium">经济日历配置</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-2">
              {["非农就业", "CPI", "PCE", "PPI", "ISM制造业", "初请失业金", "美联储利率决议", "美联储会议纪要"].map((event) => (
                <div key={event} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                  <span className="text-sm">{event}</span>
                  <Badge variant="outline" className="text-gold border-gold/30 text-[10px]">Mock</Badge>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-3">
              当前使用 Mock 数据。接入真实经济日历 API 后可在此配置关注事件。
            </p>
          </CardContent>
        </Card>
      )}

      {/* Risk Config */}
      {activeTab === "risk" && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-3">
            <CardTitle className="text-sm font-medium">风控参数</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">单笔最大风险（%）</label>
              <input
                type="number"
                defaultValue="1"
                step="0.1"
                className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">每日最大亏损（%）</label>
              <input
                type="number"
                defaultValue="2"
                step="0.1"
                className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">连续亏损强制休息（笔）</label>
              <input
                type="number"
                defaultValue="3"
                step="1"
                className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">数据前禁入时间（分钟）</label>
              <input
                type="number"
                defaultValue="30"
                step="5"
                className="w-full bg-secondary/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
            <Button size="sm" className="gap-1" onClick={() => toast.success("风控参数已保存")}>
              <Save className="w-3.5 h-3.5" />
              保存风控参数
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
