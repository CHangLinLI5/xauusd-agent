import { useState, useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { formatDateCN, formatDateTimeCN } from "@/lib/timeUtils";
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
  ArrowUpRight,
  ArrowDownRight,
  Wifi,
  WifiOff,
  Terminal,
  Command,
} from "lucide-react";

// ========== Constants ==========

const SESSION_STORAGE_KEY = "goldbias_active_session";

const QUICK_QUESTIONS = [
  { text: "今天黄金偏多还是偏空？", icon: TrendingUp, cmd: "/bias" },
  { text: "当前价格接近哪个关键位？", icon: Target, cmd: "/levels" },
  { text: "现在是什么盘面节奏？", icon: Clock, cmd: "/session" },
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

// ========== Markdown content styles ==========
const MD_STYLES = `text-[14px] leading-[1.85] text-slate-200
  [&_h1]:text-[15px] [&_h1]:font-semibold [&_h1]:text-blue-300 [&_h1]:mt-4 [&_h1]:mb-2
  [&_h2]:text-[14px] [&_h2]:font-semibold [&_h2]:text-blue-300/90 [&_h2]:mt-3 [&_h2]:mb-1.5
  [&_h3]:text-[14px] [&_h3]:font-medium [&_h3]:text-blue-300/80 [&_h3]:mt-2 [&_h3]:mb-1
  [&_strong]:text-blue-200 [&_strong]:font-semibold
  [&_code]:text-cyan-300/80 [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[13px] [&_code]:font-mono
  [&_table]:w-full [&_table]:text-[13px] [&_table]:border-collapse [&_table]:my-3
  [&_th]:px-3 [&_th]:py-2 [&_th]:text-blue-300/70 [&_th]:font-medium [&_th]:text-left [&_th]:border-b [&_th]:border-white/[0.08] [&_th]:bg-white/[0.03]
  [&_td]:px-3 [&_td]:py-2 [&_td]:border-b [&_td]:border-white/[0.04] [&_td]:text-slate-300
  [&_hr]:border-white/[0.08] [&_hr]:my-3
  [&_blockquote]:border-l-2 [&_blockquote]:border-blue-400/30 [&_blockquote]:bg-blue-400/[0.04] [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:rounded-r-lg [&_blockquote]:text-slate-300 [&_blockquote]:my-2
  [&_ul]:space-y-1 [&_ol]:space-y-1
  [&_li]:text-slate-300 [&_li]:leading-relaxed
  [&_li::marker]:text-blue-400/40
  [&_p]:text-slate-200 [&_p]:leading-[1.85] [&_p]:my-1.5
`;

// ========== Thinking text filter ==========
// Filter out English thinking/reasoning text that leaks from LLM
const THINKING_PATTERNS = [
  /^Crafting trading advice[.\s]*/i,
  /^Analyzing the (market|data|chart|price)[.\s]*/i,
  /^Let me (think|analyze|consider|review)[.\s]*/i,
  /^Thinking about[.\s]*/i,
  /^Processing[.\s]*/i,
  /^Generating[.\s]*/i,
  /^Formulating[.\s]*/i,
  /^Preparing[.\s]*/i,
];

function filterThinkingText(text: string): string {
  let filtered = text;
  for (const pattern of THINKING_PATTERNS) {
    filtered = filtered.replace(pattern, "");
  }
  return filtered;
}

// ========== Sub-components ==========

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
      <div className="flex items-center gap-3 px-3 py-1.5 text-[11px] bg-[#1a1d24] border-b border-slate-700/30">
        <div className="flex items-center gap-1.5">
          {ws.isConnected ? (
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
          <span className="font-mono font-semibold text-slate-100">
            {quote?.price ? quote.price.toFixed(2) : "----"}
          </span>
          {quote && (
            <span className={`font-mono ${priceUp ? "text-emerald-400" : "text-rose-400"}`}>
              {priceUp ? "+" : ""}{quote.change?.toFixed(2)}
            </span>
          )}
        </div>
        <div className="w-px h-3 bg-slate-700/40" />
        <div className={`flex items-center gap-1 ${currentBias.color}`}>
          <BiasIcon className="w-3 h-3" />
          <span className="font-medium">{currentBias.label}</span>
        </div>
        <div className="w-px h-3 bg-slate-700/40" />
        <span className={`font-medium ${currentRisk.color}`}>{currentRisk.label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-2 bg-[#1a1d24] border-b border-slate-700/30">
      <div className="flex items-center gap-2">
        {ws.isConnected ? (
          <Wifi className="w-3 h-3 text-emerald-400/60" />
        ) : (
          <WifiOff className="w-3 h-3 text-amber-400/60" />
        )}
        <span className="text-[11px] text-slate-400 uppercase tracking-wider">XAU/USD</span>
        <span className="font-mono font-bold text-sm text-slate-100">
          {quote?.price ? quote.price.toFixed(2) : "----"}
        </span>
        {quote && (
          <span className={`text-xs font-mono ${priceUp ? "text-emerald-400" : "text-rose-400"}`}>
            {priceUp ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
            {priceUp ? "+" : ""}{quote.change?.toFixed(2)} ({priceUp ? "+" : ""}{quote.changePercent?.toFixed(2)}%)
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 ml-auto text-[11px]">
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
          currentBias.color === "text-green" ? "bg-emerald-400/10" : currentBias.color === "text-red" ? "bg-rose-400/10" : "bg-amber-400/10"
        }`}>
          <BiasIcon className={`w-3 h-3 ${currentBias.color}`} />
          <span className={`font-semibold ${currentBias.color}`}>{currentBias.label}</span>
          {bias?.confidence && (
            <span className="text-slate-400">
              ({bias.confidence === "high" ? "高" : bias.confidence === "medium" ? "中" : "低"})
            </span>
          )}
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
          currentRisk.color === "text-green" ? "bg-emerald-400/10" : currentRisk.color === "text-red" ? "bg-rose-400/10" : "bg-amber-400/10"
        }`}>
          <Shield className={`w-3 h-3 ${currentRisk.color}`} />
          <span className={`font-semibold ${currentRisk.color}`}>{currentRisk.label}</span>
        </div>
        {bias?.keyLevels && (
          <div className="hidden lg:flex items-center gap-2 text-slate-400">
            <span>R1: <span className="text-rose-400 font-mono">{bias.keyLevels.resistance1}</span></span>
            <span>S1: <span className="text-emerald-400 font-mono">{bias.keyLevels.support1}</span></span>
          </div>
        )}
      </div>
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
    (c) =>
      c.cmd.toLowerCase().includes(filter.toLowerCase()) ||
      c.label.includes(filter) ||
      c.desc.includes(filter)
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#1e2028] border border-slate-700/40 rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="px-3 py-2 border-b border-slate-700/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Command className="w-3 h-3 text-blue-400/80" />
          <span className="text-[11px] font-semibold text-blue-400/80">快捷指令</span>
        </div>
        <button onClick={onClose} className="text-[10px] text-slate-500 hover:text-slate-300">
          ESC
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto py-1">
        {filtered.map((c) => (
          <button
            key={c.cmd}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-slate-700/20 transition-colors text-left"
            onClick={() => onSelect(c.cmd, c.label)}
          >
            <div className="w-6 h-6 rounded-md bg-slate-700/30 flex items-center justify-center shrink-0">
              <c.icon className="w-3 h-3 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-200">{c.label}</div>
              <div className="text-[10px] text-slate-500">{c.desc}</div>
            </div>
            <span className="text-[10px] text-slate-600 font-mono ml-auto shrink-0">{c.cmd}</span>
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
  const [activeSessionId, setActiveSessionId] = useState<number | null>(() => {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : null;
  });
  const [input, setInput] = useState("");
  const [showSessions, setShowSessions] = useState(false);
  const [showSlashPanel, setShowSlashPanel] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

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
        const next = sessions.find(s => s.id !== activeSessionId);
        setActiveSessionId(next?.id ?? null);
      } else {
        setActiveSessionId(null);
      }
    },
  });

  // Persist active session
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(SESSION_STORAGE_KEY, String(activeSessionId));
    }
  }, [activeSessionId]);

  // Auto-select most recent session
  useEffect(() => {
    if (!activeSessionId && sessions && sessions.length > 0) {
      const saved = localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        const id = parseInt(saved, 10);
        if (sessions.some(s => s.id === id)) {
          setActiveSessionId(id);
          return;
        }
      }
      setActiveSessionId(sessions[0].id);
    }
  }, [sessions, activeSessionId]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Slash panel toggle
  useEffect(() => {
    if (input === "/") {
      setShowSlashPanel(true);
    } else if (!input.startsWith("/") || input.includes(" ")) {
      setShowSlashPanel(false);
    }
  }, [input]);

  // Streaming send - FIXED: read 'token' field from SSE, filter thinking text
  const sendStreamMessage = useCallback(async (sessionId: number, content: string) => {
    setIsStreaming(true);
    setPendingUserMessage(content);
    setStreamingContent(null);

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, content }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Stream request failed");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              // Backend sends { token } for streaming chunks, { done, content } for completion
              if (parsed.token) {
                fullContent += parsed.token;
                // Filter out thinking/reasoning text that leaks from LLM
                const filtered = filterThinkingText(fullContent);
                setStreamingContent(filtered);
              } else if (parsed.content) {
                // Final complete message
                fullContent = parsed.content;
                setStreamingContent(filterThinkingText(fullContent));
              }
            } catch {}
          }
        }
      }
    } catch (error) {
      console.error("Stream error:", error);
      setStreamingContent("抱歉，请求出错了，请重试。");
      // Keep error message visible briefly before clearing
      await new Promise((r) => setTimeout(r, 2000));
    } finally {
      setIsStreaming(false);
      setPendingUserMessage(null);
      // Only clear streaming content after refetch succeeds
      try {
        await refetchMessages();
        await refetchSessions();
      } catch {
        // Ignore refetch errors
      }
      setStreamingContent(null);
    }
  }, [refetchMessages, refetchSessions]);

  const handleSend = useCallback(async (overrideContent?: string) => {
    const content = overrideContent ?? input.trim();
    if (!content || isStreaming) return;

    const resolvedContent = (() => {
      const q = QUICK_QUESTIONS.find((q) => q.cmd === content);
      if (q) return q.text;
      const sc = SLASH_COMMANDS.find((c) => content.startsWith(c.cmd));
      if (sc) return sc.label + (content.length > sc.cmd.length ? ": " + content.slice(sc.cmd.length).trim() : "");
      return content;
    })();

    if (!activeSessionId) {
      const session = await createSession.mutateAsync({ title: resolvedContent.slice(0, 20) });
      setInput("");
      setShowSlashPanel(false);
      await sendStreamMessage(session.id, resolvedContent);
      return;
    }

    setInput("");
    setShowSlashPanel(false);
    await sendStreamMessage(activeSessionId, resolvedContent);
  }, [input, activeSessionId, isStreaming, sendStreamMessage]);

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
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/5 flex items-center justify-center mb-5 border border-blue-500/15">
          <span className="text-blue-400 text-xl font-extrabold tracking-tight">Au</span>
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">GoldBias AI</h2>
        <p className="text-sm text-slate-400 text-center mb-6 max-w-[280px] leading-relaxed">
          专注黄金日内交易的智能分析Agent
        </p>
        <a href={getLoginUrl()}>
          <Button className="gap-2 bg-blue-500/80 hover:bg-blue-500 text-white font-semibold h-11 px-6 rounded-xl">
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
        <div key={msg.id} className="flex justify-end py-2">
          <div className="max-w-[85%] lg:max-w-[65%]">
            <div className="rounded-2xl rounded-br-md px-4 py-2.5 bg-blue-600/20 text-slate-100 border border-blue-500/15">
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        </div>
      );
    }

    // Filter thinking text from stored messages too
    const filteredContent = filterThinkingText(msg.content);

    return (
      <div key={msg.id} className="py-3">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5 border border-blue-500/15">
            <span className="text-blue-400 text-[9px] font-extrabold tracking-tight">Au</span>
          </div>
          <div className="flex-1 min-w-0 chat-content">
            <div className={MD_STYLES}>
              <Streamdown>{filteredContent}</Streamdown>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ========== Empty state ==========
  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center h-full min-h-[50vh]">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/5 flex items-center justify-center mb-4 border border-blue-500/10">
        <Sparkles className="w-7 h-7 text-blue-400/70" />
      </div>
      <h3 className="text-base font-bold text-slate-100 mb-0.5">GoldBias AI</h3>
      <p className="text-[11px] text-slate-400 text-center mb-1 max-w-[280px]">
        专注黄金日内交易的智能分析系统
      </p>
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mb-5">
        <Activity className="w-3 h-3" />
        <span>实时行情 · 多周期分析 · 关键位识别 · 风控检查</span>
      </div>
      <div className={`grid ${isMobile ? "grid-cols-1 max-w-sm" : "grid-cols-2 max-w-lg"} gap-2 w-full`}>
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q.text}
            className="flex items-center gap-2.5 text-left text-[12px] px-3 py-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-700/40 border border-slate-700/30 hover:border-blue-500/20 text-slate-300 hover:text-slate-100 transition-all group"
            onClick={() => handleSend(q.text)}
          >
            <div className="w-7 h-7 rounded-lg bg-slate-700/30 group-hover:bg-blue-500/15 flex items-center justify-center shrink-0 transition-colors">
              <q.icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-400 transition-colors" />
            </div>
            <span>{q.text}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ========== Input area ==========
  const renderInputArea = () => (
    <div className="px-3 lg:px-6 py-2.5 bg-[#14161b] border-t border-slate-700/30 safe-area-bottom">
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
                className="w-full resize-none bg-slate-800/50 rounded-xl px-3.5 py-2.5 text-[14px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 border border-slate-700/40 focus:border-blue-500/30 min-h-[42px] max-h-[120px] transition-all pr-10"
                rows={1}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <button
                  onClick={() => {
                    setInput("/");
                    textareaRef.current?.focus();
                  }}
                  className="p-1 rounded-md hover:bg-slate-700/30 text-slate-500 hover:text-blue-400 transition-colors"
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
                  ? "bg-blue-500/80 hover:bg-blue-500 text-white"
                  : "bg-slate-800/50 text-slate-500"
              }`}
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          {!isMobile && (
            <div className="flex items-center justify-between mt-1 px-1">
              <span className="text-[10px] text-slate-600">
                Shift+Enter 换行 · / 快捷指令
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ========== Session sidebar (desktop) ==========
  const renderSessionSidebar = () => (
    <div className="w-56 border-r border-slate-700/30 flex flex-col bg-[#12141a] shrink-0">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700/30">
        <div className="flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-blue-400/50" />
          <span className="text-xs font-semibold text-slate-300">对话</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => createSession.mutate({ title: "新对话" })}
          className="gap-1 text-[11px] text-blue-400/70 hover:bg-blue-500/10 h-6 px-2"
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
                ? "bg-blue-500/[0.08] border border-blue-500/15"
                : "hover:bg-slate-800/40 border border-transparent"
            }`}
            onClick={() => setActiveSessionId(session.id)}
          >
            <div className="p-2 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <MessageSquare className="w-3 h-3 text-slate-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-slate-300 truncate">{session.title}</div>
                  <div className="text-[9px] text-slate-500">
                    {formatDateCN(session.updatedAt)}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-slate-600 hover:text-rose-400 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
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
            <MessageSquare className="w-6 h-6 mx-auto mb-1.5 text-slate-700" />
            <p className="text-[10px] text-slate-500">暂无对话</p>
          </div>
        )}
      </div>
    </div>
  );

  // ========== Messages area ==========
  const renderMessages = () => (
    <>
      {(!messages || messages.length === 0) && !isStreaming && !pendingUserMessage && renderEmptyState()}

      {messages?.map((msg, i) => renderMessage(msg, i === messages.length - 1 && msg.role === "assistant"))}

      {/* Optimistic user message while streaming */}
      {isStreaming && pendingUserMessage && (
        <div className="flex justify-end py-2">
          <div className="max-w-[85%] lg:max-w-[65%]">
            <div className="rounded-2xl rounded-br-md px-4 py-2.5 bg-blue-600/20 text-slate-100 border border-blue-500/15">
              <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{pendingUserMessage}</p>
            </div>
          </div>
        </div>
      )}

      {/* Streaming response */}
      {isStreaming && (
        <div className="py-3">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center shrink-0 border border-blue-500/15">
              <span className="text-blue-400 text-[9px] font-extrabold tracking-tight">Au</span>
            </div>
            <div className="flex-1 min-w-0 chat-content">
              {streamingContent ? (
                <div className={MD_STYLES}>
                  <Streamdown isAnimating>{streamingContent}</Streamdown>
                </div>
              ) : (
                <div className="flex items-center gap-2 py-2">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-[12px] text-slate-400">正在分析...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </>
  );

  // ========== Desktop Layout ==========
  if (!isMobile) {
    return (
      <div className="flex h-[calc(100vh-0px)]">
        {renderSessionSidebar()}
        <div className="flex-1 flex flex-col bg-[#16181e]">
          <MarketContextBar />
          <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-700/30 bg-[#16181e]">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center border border-blue-500/15">
              <span className="text-blue-400 text-[8px] font-extrabold tracking-tight">Au</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-200 truncate">
                {sessions?.find((s) => s.id === activeSessionId)?.title ?? "GoldBias AI"}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-slate-500">在线</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" ref={chatScrollRef}>
            <div className="max-w-3xl mx-auto px-6 py-4">
              {renderMessages()}
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
            <History className="w-5 h-5 text-blue-400/70" />
            <h2 className="text-lg font-bold text-slate-100">对话记录</h2>
          </div>
          <Button
            size="sm"
            onClick={() => createSession.mutate({ title: "新对话" })}
            className="gap-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border-0 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            新对话
          </Button>
        </div>
        <div className="space-y-2">
          {sessions?.map((session) => (
            <div
              key={session.id}
              className={`rounded-xl cursor-pointer transition-all duration-150 bg-slate-800/30 border ${
                session.id === activeSessionId ? "border-blue-500/20" : "border-slate-700/30"
              }`}
              onClick={() => {
                setActiveSessionId(session.id);
                setShowSessions(false);
              }}
            >
              <div className="p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-700/30 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-200">{session.title}</div>
                    <div className="text-[10px] text-slate-500">
                      {formatDateTimeCN(session.updatedAt)}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-slate-500 hover:text-rose-400"
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
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-sm text-slate-400">暂无对话记录</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ========== Mobile: Chat view ==========
  // Chat fills the remaining space from AppLayout (header already rendered by AppLayout)
  // AppLayout sets h-[100dvh] overflow-hidden for chat page, main is flex-1 overflow-hidden
  // So this component just needs to be a flex column filling 100% of its parent
  return (
    <div className="flex flex-col h-full">
      {/* Compact market bar + session title */}
      <div className="shrink-0">
        <MarketContextBar compact />
        <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/30 bg-[#14161b]">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-slate-200"
            onClick={() => setShowSessions(true)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center border border-blue-500/15">
              <span className="text-blue-400 text-[8px] font-extrabold tracking-tight">Au</span>
            </div>
            <div className="text-sm font-semibold text-slate-200 truncate">
              {sessions?.find((s) => s.id === activeSessionId)?.title ?? "GoldBias AI"}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-slate-400 hover:text-blue-400"
            onClick={() => createSession.mutate({ title: "新对话" })}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable messages - takes all remaining space */}
      <div className="flex-1 overflow-y-auto px-3 py-3" ref={chatScrollRef}>
        {renderMessages()}
      </div>

      {/* Input area - fixed at bottom, shrink-0, with bottom padding for nav bar */}
      <div className="shrink-0 pb-16">
        {renderInputArea()}
      </div>
    </div>
  );
}
