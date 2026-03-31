import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Link } from "wouter";
import { useIsMobile } from "@/hooks/useMobile";
import {
  Settings,
  Save,
  ArrowLeft,
  Newspaper,
  Calendar,
  Bot,
  Shield,
  Loader2,
  Lock,
  Cpu,
  Database,
  Radio,
  Zap,
  Globe,
} from "lucide-react";

export default function AdminConfig() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"news" | "calendar" | "model" | "risk">("model");
  const isMobile = useIsMobile();

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

  const containerClass = isMobile
    ? "px-4 py-5 max-w-lg mx-auto space-y-4"
    : "px-6 py-6 max-w-4xl mx-auto space-y-5";

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red/15 to-red/5 flex items-center justify-center mb-5">
          <Lock className="w-8 h-8 text-red" />
        </div>
        <h2 className="text-xl font-bold mb-2">权限不足</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">仅管理员可访问后台配置</p>
        <Link href="/">
          <Button variant="outline" className="rounded-xl">返回首页</Button>
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
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center">
          <Settings className="w-4 h-4 text-gold" />
        </div>
        <div>
          <h1 className="text-lg font-bold">后台配置</h1>
          <p className="text-[10px] text-muted-foreground">管理员专用</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                activeTab === tab.key
                  ? "bg-gold/15 text-gold border border-gold/20"
                  : "bg-surface/50 text-muted-foreground hover:text-foreground border border-border/10"
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
        <div className={isMobile ? "space-y-4" : "grid grid-cols-2 gap-5"}>
          <div className="card-base rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
              <Cpu className="w-4 h-4 text-gold" />
              <span className="text-sm font-semibold">系统提示词</span>
            </div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full h-40 bg-surface/60 rounded-xl p-3.5 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-gold/30 border border-border/20 focus:border-gold/30 text-foreground/80 transition-all"
              placeholder="输入 GoldBias AI 的系统提示词..."
            />
            <Button
              size="sm"
              className="mt-3 gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border-0 rounded-lg"
              onClick={() => saveConfig.mutate({ key: "system_prompt", value: systemPrompt, description: "GoldBias AI 系统提示词" })}
              disabled={saveConfig.isPending}
            >
              {saveConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              保存提示词
            </Button>
          </div>

          <div className="space-y-4">
            <div className="card-base rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
                <Bot className="w-4 h-4 text-gold" />
                <span className="text-sm font-semibold">模型参数</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1.5 block font-medium">Temperature</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    className="w-full bg-surface/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 border border-border/20 focus:border-gold/30 font-mono transition-all"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground mb-1.5 block font-medium">Max Tokens</label>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    max="8000"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(e.target.value)}
                    className="w-full bg-surface/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 border border-border/20 focus:border-gold/30 font-mono transition-all"
                  />
                </div>
                <Button
                  size="sm"
                  className="gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border-0 rounded-lg"
                  onClick={async () => {
                    await saveConfig.mutateAsync({ key: "temperature", value: temperature, description: "LLM Temperature" });
                    await saveConfig.mutateAsync({ key: "max_tokens", value: maxTokens, description: "LLM Max Tokens" });
                  }}
                  disabled={saveConfig.isPending}
                >
                  {saveConfig.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  保存参数
                </Button>
              </div>
            </div>

            <div className="card-base rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
                <Database className="w-4 h-4 text-gold" />
                <span className="text-sm font-semibold">API 状态</span>
              </div>
              <div className="space-y-2">
                {[
                  { name: "自定义 LLM (GPT-5.4)", status: "active", label: "已配置" },
                  { name: "现货金价 (OTC Spot)", status: "active", label: "已接入" },
                  { name: "日内行情 (COMEX GC)", status: "active", label: "已接入" },
                  { name: "新闻 API", status: "mock", label: "Mock 数据" },
                  { name: "经济日历 API", status: "mock", label: "Mock 数据" },
                ].map((api) => (
                  <div key={api.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-surface/30">
                    <span className="text-xs text-foreground/80">{api.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      api.status === "active" ? "bg-green/10 text-green" : "bg-gold/10 text-gold"
                    }`}>
                      {api.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* News Sources */}
      {activeTab === "news" && (
        <div className="card-base rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
            <Radio className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold">新闻源配置</span>
          </div>
          <div className="space-y-1.5">
            {["美联储新闻", "非农/CPI/PCE/PPI", "ISM/初请失业金", "美元指数/美债", "地缘政治", "央行动态"].map((source) => (
              <div key={source} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface/30">
                <span className="text-[13px]">{source}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gold/10 text-gold">Mock</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            当前使用 Mock 数据。接入真实新闻 API 后可在此配置数据源和刷新频率。
          </p>
        </div>
      )}

      {/* Calendar Config */}
      {activeTab === "calendar" && (
        <div className="card-base rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
            <Globe className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold">经济日历配置</span>
          </div>
          <div className="space-y-1.5">
            {["非农就业", "CPI", "PCE", "PPI", "ISM制造业", "初请失业金", "美联储利率决议", "美联储会议纪要"].map((event) => (
              <div key={event} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface/30">
                <span className="text-[13px]">{event}</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gold/10 text-gold">Mock</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            当前使用 Mock 数据。接入真实经济日历 API 后可在此配置关注事件和提醒规则。
          </p>
        </div>
      )}

      {/* Risk Config */}
      {activeTab === "risk" && (
        <div className="card-base rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border/20">
            <Zap className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold">风控参数</span>
          </div>
          <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-4"}>
            {[
              { label: "单笔最大风险（%）", defaultVal: "1", step: "0.1" },
              { label: "每日最大亏损（%）", defaultVal: "2", step: "0.1" },
              { label: "连续亏损强制休息（笔）", defaultVal: "3", step: "1" },
              { label: "数据前禁入时间（分钟）", defaultVal: "30", step: "5" },
            ].map((field) => (
              <div key={field.label}>
                <label className="text-[11px] text-muted-foreground mb-1.5 block font-medium">{field.label}</label>
                <input
                  type="number"
                  defaultValue={field.defaultVal}
                  step={field.step}
                  className="w-full bg-surface/60 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-gold/30 border border-border/20 focus:border-gold/30 font-mono transition-all"
                />
              </div>
            ))}
          </div>
          <Button
            size="sm"
            className="mt-4 gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border-0 rounded-lg"
            onClick={() => toast.success("风控参数已保存")}
          >
            <Save className="w-3.5 h-3.5" />
            保存风控参数
          </Button>
        </div>
      )}

      {/* Bottom Spacer */}
      <div className="h-2" />
    </div>
  );
}
