import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { useIsMobile } from "@/hooks/useMobile";
import { useMarketSocket } from "@/hooks/useMarketSocket";
import {
  Send,
  Plus,
  Trash2,
  MessageSquare,
  LogIn,
  Loader2,
  ChevronLeft,
  Sparkles,
  History,
  Bot,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  BarChart3,
  Clock,
  Zap,
  FileText,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  WifiOff,
  Eye,
  Terminal,
  CheckCircle2,
  Circle,
  Cpu,
  Database,
  LineChart,
  AlertTriangle,
  Command,
} from "lucide-react";

// ========== Types ==========

interface AgentStep {
  id: string;
  label: string;
  status: "pending" | "active" | "done";
  icon: React.ElementType;
}

// ========== Constants ==========

const QUICK_QUESTIONS = [
  { text: "今天 XAUUSD 偏多还是偏空？", icon: TrendingUp, cmd: "/bias" },
  { text: "当前价格接近哪个关键位？", icon: Target, cmd: "/levels" },
  { text: "现在是消息前震荡还是消息后单边？", icon: Clock, cmd: "/session" },
  { text: "给我生成今天的完整交易计划", icon: FileText, cmd: "/plan" },
  { text: "当前有没有优质报价区？", icon: BarChart3, cmd: "/entry" },
  { text: "今天有哪些重要数据？", icon: Zap, cmd: "/data" },
];

const SLASH_COMMANDS = [
  { cmd: "/bias", label: "今日偏向分析", desc: "多空方向 + 置信度", icon: TrendingUp },
  { cmd: "/plan", label: "生成交易计划", desc: "完整日内交易计划", icon: FileText },
  { cmd: "/levels", label: "关键位查询", desc: "支撑阻力 + 箱体", icon: Target },
  { cmd: "/risk", label: "风控检查", desc: "当前风险状态", icon: Shield },
  { cmd: "/session", label: "盘面状态", desc: "当前时段分析", icon: Clock },
  { cmd: "/data", label: "今日数据", desc: "经济日历事件", icon: Zap },
];

const AGENT_STEPS: AgentStep[] = [
  { id: "fetch", label: "获取实时行情", status: "pending", icon: Database },
  { id: "analyze", label: "分析多周期方向", status: "pending", icon: LineChart },
  { id: "check", label: "检查关键位与形态", status: "pending", icon: Target },
  { id: "risk", label: "评估风控状态", status: "pending", icon: Shield },
  { id: "generate", label: "生成交易建议", status: "pending", icon: Cpu },
];

// ========== Sub-components ==========

/** Mini market context bar at the top of chat */
function MarketContextBar({ compact = false }: { compact?: boolean }) {
  const ws = useMarketSocket();
  const quote = ws.quote;
  const bias = ws.bias;
  const priceUp = (quote?.change ?? 0) >= 0;

  const biasConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
    bullish: { label: "偏多", color: "text-green", icon: TrendingUp },
    bearish: { label: "偏空", color: "text-red", icon: TrendingDown },
    ranging: { label: "震荡", color: "text-gold", icon: Minus },
  };

  const riskConfig: Record<string, { label: string; color: string }> = {
    tradable: { label: "可交易", color: "text-green" },
    cautious: { label: "谨慎", color: "text-gold" },
    no_trade: { label: "禁入", color: "text-red" },
  };

  const currentBias = bias ? biasConfig[bias.bias] ?? biasConfig.ranging : biasConfig.ranging;
  const currentRisk = bias ? riskConfig[bias.riskStatus] ?? riskConfig.tradable : riskConfig.tradable;
  const BiasIcon = currentBias.icon;

  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-1.5 text-[11px]">
        <div className="flex items-center gap-1.5">
          {ws.isConnected ? (
            <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-gold" />
          )}
          <span className="font-mono font-semibold text-foreground">
            {quote?.price ? quote.price.toFixed(2) : "----"}
          </span>
          {quote && (
            <span className={`font-mono ${priceUp ? "text-green" : "text-red"}`}>
              {priceUp ? "+" : ""}{quote.change?.toFixed(2)}
            </span>
          )}
        </div>
        <div className="w-px h-3 bg-border/30" />
        <div className={`flex items-center gap-1 ${currentBias.color}`}>
          <BiasIcon className="w-3 h-3" />
          <span className="font-medium">{currentBias.label}</span>
        </div>
        <div className="w-px h-3 bg-border/30" />
        <span className={`font-medium ${currentRisk.color}`}>{currentRisk.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-surface/30 border-b border-border/15">
      <div className="flex items-center gap-2">
        {ws.isConnected ? (
          <Wifi className="w-3 h-3 text-green/70" />
        ) : (
          <WifiOff className="w-3 h-3 text-gold/70" />
        )}
        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">XAUUSD</span>
        <span className="font-mono font-bold text-sm text-foreground">
          {quote?.price ? quote.price.toFixed(2) : "----"}
        </span>
        {quote && (
          <span className={`text-xs font-mono ${priceUp ? "text-green" : "text-red"}`}>
            {priceUp ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
            {priceUp ? "+" : ""}{quote.change?.toFixed(2)} ({priceUp ? "+" : ""}{quote.changePercent?.toFixed(2)}%)
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 ml-auto text-[11px]">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
          currentBias.color === "text-green" ? "bg-green/10" : currentBias.color === "text-red" ? "bg-red/10" : "bg-gold/10"
        }`}>
          <BiasIcon className={`w-3 h-3 ${currentBias.color}`} />
          <span className={`font-semibold ${currentBias.color}`}>{currentBias.label}</span>
          {bias?.confidence && (
            <span className="text-muted-foreground">
              ({bias.confidence === "high" ? "高" : bias.confidence === "medium" ? "中" : "低"})
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
          currentRisk.color === "text-green" ? "bg-green/10" : currentRisk.color === "text-red" ? "bg-red/10" : "bg-gold/10"
        }`}>
          <Shield className={`w-3 h-3 ${currentRisk.color}`} />
          <span className={`font-semibold ${currentRisk.color}`}>{currentRisk.label}</span>
        </div>
        {bias?.keyLevels && (
          <div className="hidden lg:flex items-center gap-2 text-muted-foreground">
            <span>R1: <span className="text-red font-mono">{bias.keyLevels.resistance1}</span></span>
            <span>S1: <span className="text-green font-mono">{bias.keyLevels.support1}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Agent thinking steps visualization */
function AgentThinking({ elapsedMs }: { elapsedMs: number }) {
  const [steps, setSteps] = useState<AgentStep[]>(
    AGENT_STEPS.map((s) => ({ ...s, status: "pending" as const }))
  );

  useEffect(() => {
    // Simulate step progression based on elapsed time
    const timings = [0, 800, 2200, 3800, 5500];
    const newSteps = AGENT_STEPS.map((s, i) => {
      if (elapsedMs >= (timings[i + 1] ?? Infinity)) {
        return { ...s, status: "done" as const };
      } else if (elapsedMs >= timings[i]) {
        return { ...s, status: "active" as const };
      }
      return { ...s, status: "pending" as const };
    });
    setSteps(newSteps);
  }, [elapsedMs]);

  return (
    <div className="card-base rounded-xl px-4 py-3 max-w-md">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-5 h-5 rounded-md bg-gold/15 flex items-center justify-center">
          <Cpu className="w-3 h-3 text-gold animate-pulse" />
        </div>
        <span className="text-xs font-semibold text-gold">Agent 分析中</span>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">
          {(elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="space-y-1.5">
        {steps.map((step) => {
          const StepIcon = step.icon;
          return (
            <div
              key={step.id}
              className={`flex items-center gap-2 text-xs transition-all duration-300 ${
                step.status === "done"
                  ? "text-foreground/70"
                  : step.status === "active"
                  ? "text-gold"
                  : "text-muted-foreground/40"
              }`}
            >
              {step.status === "done" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green shrink-0" />
              ) : step.status === "active" ? (
                <Loader2 className="w-3.5 h-3.5 text-gold animate-spin shrink-0" />
              ) : (
                <Circle className="w-3.5 h-3.5 shrink-0" />
              )}
              <StepIcon className="w-3 h-3 shrink-0" />
              <span className={step.status === "active" ? "font-medium" : ""}>{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Follow-up quick actions after agent response */
function FollowUpActions({ onAction }: { onAction: (text: string) => void }) {
  const actions = [
    { label: "生成交易计划", icon: FileText, text: "基于以上分析，生成今天的完整交易计划" },
    { label: "查看图表", icon: LineChart, text: "帮我分析当前图表形态" },
    { label: "关键位详情", icon: Target, text: "详细分析当前所有关键位和箱体" },
    { label: "风控检查", icon: Shield, text: "检查当前的风控状态和注意事项" },
  ];

  return (
    <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2.5 border-t border-border/10">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.text)}
          className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-surface/40 hover:bg-gold/10 border border-border/15 hover:border-gold/20 text-muted-foreground hover:text-gold transition-all"
        >
          <a.icon className="w-3 h-3" />
          {a.label}
        </button>
      ))}
    </div>
  );
}

/** Slash command dropdown */
function SlashCommandPanel({
  filter,
  onSelect,
  onClose,
}: {
  filter: string;
  onSelect: (cmd: string, label: string) => void;
  onClose: () => void;
}) {
  const filtered = SLASH_COMMANDS.filter(
    (c) => c.cmd.includes(filter) || c.label.includes(filter)
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 card-base rounded-xl border border-border/20 overflow-hidden shadow-lg z-50">
      <div className="px-3 py-1.5 border-b border-border/10 flex items-center gap-1.5">
        <Command className="w-3 h-3 text-gold" />
        <span className="text-[10px] text-muted-foreground font-medium">快捷指令</span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map((c) => (
          <button
            key={c.cmd}
            onClick={() => onSelect(c.cmd, c.label)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gold/5 transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0">
              <c.icon className="w-3.5 h-3.5 text-gold/70" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-foreground">{c.label}</div>
              <div className="text-[10px] text-muted-foreground">{c.desc}</div>
            </div>
            <span className="text-[10px] text-muted-foreground/50 font-mono ml-auto shrink-0">{c.cmd}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ========== Main Component ==========

export default function Chat() {
  const { isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const [showSlashPanel, setShowSlashPanel] = useState(false);
  const [thinkingStart, setThinkingStart] = useState<number | null>(null);
  const [thinkingElapsed, setThinkingElapsed] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: sessions, refetch: refetchSessions } = trpc.chat.sessions.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: messages, refetch: refetchMessages } = trpc.chat.messages.useQuery(
    { sessionId: activeSessionId! },
    { enabled: !!activeSessionId }
  );

  const createSession = trpc.chat.createSession.useMutation({
    onSuccess: (data) => {
      setActiveSessionId(data.id);
      refetchSessions();
      setShowSessions(false);
    },
  });

  const deleteSession = trpc.chat.deleteSession.useMutation({
    onSuccess: () => {
      refetchSessions();
      if (sessions && sessions.length > 1) {
        setActiveSessionId(sessions[0]?.id === activeSessionId ? sessions[1]?.id ?? null : sessions[0]?.id ?? null);
      } else {
        setActiveSessionId(null);
      }
    },
  });

  const sendMessage = trpc.chat.send.useMutation({
    onMutate: () => {
      setThinkingStart(Date.now());
    },
    onSuccess: () => {
      setThinkingStart(null);
      setThinkingElapsed(0);
      refetchMessages();
    },
    onError: () => {
      setThinkingStart(null);
      setThinkingElapsed(0);
    },
  });

  // Thinking timer
  useEffect(() => {
    if (!thinkingStart) return;
    const interval = setInterval(() => {
      setThinkingElapsed(Date.now() - thinkingStart);
    }, 100);
    return () => clearInterval(interval);
  }, [thinkingStart]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  // Slash command detection
  useEffect(() => {
    if (input.startsWith("/")) {
      setShowSlashPanel(true);
    } else {
      setShowSlashPanel(false);
    }
  }, [input]);

  const handleSend = useCallback(async (text?: string) => {
    const content = text || input.trim();
    if (!content || sendMessage.isPending) return;

    // Resolve slash commands to full text
    const slashMatch = SLASH_COMMANDS.find((c) => content === c.cmd);
    const resolvedContent = slashMatch
      ? QUICK_QUESTIONS.find((q) => q.cmd === slashMatch.cmd)?.text ?? slashMatch.label
      : content;

    if (!activeSessionId) {
      const session = await createSession.mutateAsync({ title: resolvedContent.slice(0, 30) });
      setInput("");
      setShowSlashPanel(false);
      await sendMessage.mutateAsync({ sessionId: session.id, content: resolvedContent });
      return;
    }

    setInput("");
    setShowSlashPanel(false);
    await sendMessage.mutateAsync({ sessionId: activeSessionId, content: resolvedContent });
  }, [input, activeSessionId, sendMessage.isPending]);

  const handleSlashSelect = useCallback((cmd: string, _label: string) => {
    const q = QUICK_QUESTIONS.find((q) => q.cmd === cmd);
    if (q) {
      handleSend(q.text);
    } else {
      setInput(cmd + " ");
      setShowSlashPanel(false);
      textareaRef.current?.focus();
    }
  }, [handleSend]);

  // ========== Unauthenticated ==========
  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center mb-5">
          <Bot className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-xl font-bold mb-2">XAUUSD AI Agent</h2>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-[280px] leading-relaxed">
          专注黄金日内交易的智能分析Agent，基于价格行为、关键位和基本面的专业决策系统
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2 bg-gold/90 hover:bg-gold text-background font-semibold h-11 px-6 rounded-xl">
            <LogIn className="w-4 h-4" />
            登录开始对话
          </Button>
        </a>
      </div>
    );
  }

  // ========== Message rendering ==========
  const renderMessage = (msg: { id: number; role: string; content: string }, isLast: boolean) => {
    if (msg.role === "user") {
      return (
        <div key={msg.id} className="flex gap-2.5 justify-end">
          <div className="max-w-[75%] rounded-2xl px-3.5 py-2.5 bg-gold/12 text-foreground border border-gold/10">
            <div className="text-[13px]">{msg.content}</div>
          </div>
          <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 mt-0.5">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        </div>
      );
    }

    // Assistant message with structured rendering
    return (
      <div key={msg.id} className="flex gap-2.5 justify-start">
        <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3.5 h-3.5 text-gold" />
        </div>
        <div className="max-w-[85%] space-y-0">
          <div className="card-base rounded-2xl px-4 py-3">
            <div className="text-[13px] prose prose-invert prose-sm max-w-none leading-relaxed [&_h1]:text-gold [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-3 [&_h1]:mb-1.5 [&_h2]:text-gold [&_h2]:text-sm [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-gold/90 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2.5 [&_h3]:mb-1 [&_strong]:text-gold/90 [&_code]:text-cyan [&_code]:bg-surface/50 [&_code]:px-1 [&_code]:rounded [&_table]:text-[12px] [&_table]:border-collapse [&_th]:bg-surface/50 [&_th]:px-2 [&_th]:py-1 [&_th]:text-gold/80 [&_th]:font-semibold [&_th]:text-left [&_th]:border [&_th]:border-border/20 [&_td]:px-2 [&_td]:py-1 [&_td]:border [&_td]:border-border/15 [&_hr]:border-border/15 [&_hr]:my-2 [&_blockquote]:border-l-gold/30 [&_blockquote]:bg-gold/5 [&_blockquote]:px-3 [&_blockquote]:py-1.5 [&_blockquote]:rounded-r-lg [&_ul]:space-y-0.5 [&_ol]:space-y-0.5 [&_li]:text-foreground/85">
              <Streamdown>{msg.content}</Streamdown>
            </div>
          </div>
          {/* Follow-up actions on last assistant message */}
          {isLast && !sendMessage.isPending && (
            <FollowUpActions onAction={handleSend} />
          )}
        </div>
      </div>
    );
  };

  // ========== Empty state ==========
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center mb-4">
        <Sparkles className="w-7 h-7 text-gold" />
      </div>
      <h3 className="text-base font-bold mb-0.5">XAUUSD Agent</h3>
      <p className="text-[11px] text-muted-foreground text-center mb-1 max-w-[280px]">
        专注黄金日内交易的智能分析系统
      </p>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 mb-5">
        <Activity className="w-3 h-3" />
        <span>实时行情 · 多周期分析 · 关键位识别 · 风控检查</span>
      </div>
      <div className={`grid ${isMobile ? "grid-cols-1 max-w-sm" : "grid-cols-2 max-w-lg"} gap-2 w-full`}>
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q.text}
            className="flex items-center gap-2.5 text-left text-[12px] px-3 py-2.5 rounded-xl bg-surface/40 hover:bg-surface-elevated border border-border/15 hover:border-gold/20 text-foreground/75 hover:text-foreground transition-all group"
            onClick={() => handleSend(q.text)}
          >
            <div className="w-7 h-7 rounded-lg bg-surface-elevated group-hover:bg-gold/10 flex items-center justify-center shrink-0 transition-colors">
              <q.icon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-gold transition-colors" />
            </div>
            <span>{q.text}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ========== Input area ==========
  const renderInputArea = () => (
    <div className="px-4 lg:px-6 py-3 border-t border-border/15 bg-background/60">
      <div className={`${isMobile ? "max-w-lg" : "max-w-3xl"} mx-auto`}>
        <div className="relative">
          {showSlashPanel && (
            <SlashCommandPanel
              filter={input.slice(1)}
              onSelect={handleSlashSelect}
              onClose={() => setShowSlashPanel(false)}
            />
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                  if (e.key === "Escape") {
                    setShowSlashPanel(false);
                  }
                }}
                placeholder="输入交易问题，或输入 / 查看快捷指令..."
                className="w-full resize-none bg-surface/50 rounded-xl px-3.5 py-2.5 text-[13px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-gold/25 border border-border/15 focus:border-gold/25 min-h-[40px] max-h-[120px] transition-all pr-10"
                rows={1}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <button
                  onClick={() => {
                    setInput("/");
                    textareaRef.current?.focus();
                  }}
                  className="p-1 rounded-md hover:bg-surface-elevated text-muted-foreground/40 hover:text-gold/60 transition-colors"
                  title="快捷指令"
                >
                  <Terminal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <Button
              size="icon"
              className={`h-10 w-10 shrink-0 rounded-xl transition-all duration-150 ${
                input.trim()
                  ? "bg-gold/90 hover:bg-gold text-background"
                  : "bg-surface/60 text-muted-foreground/40"
              }`}
              onClick={() => handleSend()}
              disabled={!input.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <span className="text-[10px] text-muted-foreground/30">
              Shift+Enter 换行 · / 快捷指令 · 基于实时行情分析
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  // ========== Session sidebar (desktop) ==========
  const renderSessionSidebar = () => (
    <div className="w-56 border-r border-border/15 flex flex-col bg-card/20 shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/10">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-gold/70" />
          <span className="text-xs font-semibold">对话</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => createSession.mutate({ title: "新对话" })}
          className="gap-1 text-[11px] text-gold hover:bg-gold/10 h-6 px-2"
        >
          <Plus className="w-3 h-3" />
          新建
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {sessions?.map((session) => (
          <div
            key={session.id}
            className={`group rounded-lg cursor-pointer transition-all duration-150 ${
              session.id === activeSessionId
                ? "bg-gold/8 border border-gold/15"
                : "hover:bg-surface/40 border border-transparent"
            }`}
            onClick={() => setActiveSessionId(session.id)}
          >
            <div className="p-2 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium truncate">{session.title}</div>
                  <div className="text-[9px] text-muted-foreground/50">
                    {new Date(session.updatedAt).toLocaleDateString("zh-CN")}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-muted-foreground/30 hover:text-red shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteSession.mutate({ sessionId: session.id });
                }}
              >
                <Trash2 className="w-2.5 h-2.5" />
              </Button>
            </div>
          </div>
        ))}
        {(!sessions || sessions.length === 0) && (
          <div className="text-center py-6">
            <MessageSquare className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/15" />
            <p className="text-[10px] text-muted-foreground/40">暂无对话</p>
          </div>
        )}
      </div>
    </div>
  );

  // ========== Desktop Layout ==========
  if (!isMobile) {
    return (
      <div className="flex h-[calc(100vh-0px)]">
        {renderSessionSidebar()}
        <div className="flex-1 flex flex-col">
          {/* Market context bar */}
          <MarketContextBar />
          {/* Chat header */}
          <div className="flex items-center gap-2 px-5 py-2 border-b border-border/10 bg-background/30">
            <div className="w-6 h-6 rounded-md bg-gold/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-gold" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">
                {sessions?.find((s) => s.id === activeSessionId)?.title ?? "XAUUSD Agent"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
              <span className="text-[10px] text-muted-foreground">在线</span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="max-w-3xl mx-auto space-y-4">
              {(!messages || messages.length === 0) && !sendMessage.isPending && renderEmptyState()}

              {messages?.map((msg, i) => renderMessage(msg, i === messages.length - 1 && msg.role === "assistant"))}

              {sendMessage.isPending && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-gold" />
                  </div>
                  <AgentThinking elapsedMs={thinkingElapsed} />
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          {renderInputArea()}
        </div>
      </div>
    );
  }

  // ========== Mobile: Session list ==========
  if (showSessions) {
    return (
      <div className="px-4 py-5 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-gold" />
            <h2 className="text-lg font-bold">对话记录</h2>
          </div>
          <Button
            size="sm"
            onClick={() => createSession.mutate({ title: "新对话" })}
            className="gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border-0 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            新对话
          </Button>
        </div>
        <div className="space-y-2">
          {sessions?.map((session) => (
            <div
              key={session.id}
              className={`card-base rounded-xl cursor-pointer transition-all duration-150 ${
                session.id === activeSessionId ? "border-gold/30" : ""
              }`}
              onClick={() => {
                setActiveSessionId(session.id);
                setShowSessions(false);
              }}
            >
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{session.title}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(session.updatedAt).toLocaleString("zh-CN")}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession.mutate({ sessionId: session.id });
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {(!sessions || sessions.length === 0) && (
            <div className="text-center py-12">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">暂无对话记录</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== Mobile: Chat view ==========
  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] max-w-lg mx-auto">
      {/* Market context (compact) */}
      <MarketContextBar compact />

      {/* Chat Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/15 bg-background/40">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => setShowSessions(true)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-md bg-gold/10 flex items-center justify-center">
            <Bot className="w-3 h-3 text-gold" />
          </div>
          <div className="text-sm font-semibold truncate">
            {sessions?.find((s) => s.id === activeSessionId)?.title ?? "XAUUSD Agent"}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-gold"
          onClick={() => createSession.mutate({ title: "新对话" })}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(!messages || messages.length === 0) && !sendMessage.isPending && renderEmptyState()}

        {messages?.map((msg, i) => renderMessage(msg, i === messages.length - 1 && msg.role === "assistant"))}

        {sendMessage.isPending && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-gold" />
            </div>
            <AgentThinking elapsedMs={thinkingElapsed} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {renderInputArea()}
    </div>
  );
}
