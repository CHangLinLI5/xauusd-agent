import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";
import { motion, AnimatePresence } from "framer-motion";
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
  Target,
  BarChart3,
  Clock,
  Zap,
  FileText,
} from "lucide-react";

const QUICK_QUESTIONS = [
  { text: "今天 XAUUSD 偏多还是偏空？", icon: TrendingUp },
  { text: "当前价格接近哪个关键位？", icon: Target },
  { text: "现在是消息前震荡还是消息后单边？", icon: Clock },
  { text: "给我生成今天的完整交易计划", icon: FileText },
  { text: "当前有没有优质报价区？", icon: BarChart3 },
  { text: "今天有哪些重要数据？", icon: Zap },
];

export default function Chat() {
  const { isAuthenticated } = useAuth();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [showSessions, setShowSessions] = useState(false);
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
    onSuccess: () => {
      refetchMessages();
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sendMessage.isPending]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = async (text?: string) => {
    const content = text || input.trim();
    if (!content || sendMessage.isPending) return;

    if (!activeSessionId) {
      const session = await createSession.mutateAsync({ title: content.slice(0, 30) });
      setInput("");
      await sendMessage.mutateAsync({ sessionId: session.id, content });
      return;
    }

    setInput("");
    await sendMessage.mutateAsync({ sessionId: activeSessionId, content });
  };

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-gold/20 to-gold/5 flex items-center justify-center mb-5 gold-glow">
          <Bot className="w-8 h-8 text-gold" />
        </div>
        <h2 className="text-xl font-bold mb-2">XAUUSD AI 分析师</h2>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-[280px] leading-relaxed">
          专注黄金日内交易分析，基于价格行为、关键位和基本面的专业决策辅助
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

  // Session list view
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
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`glass-card rounded-xl cursor-pointer transition-all duration-200 ${
                session.id === activeSessionId ? "border-gold/30 gold-glow" : ""
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
            </motion.div>
          ))}
          {(!sessions || sessions.length === 0) && (
            <div className="text-center py-12">
              <MessageSquare className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">暂无对话记录</p>
              <p className="text-xs text-muted-foreground/60 mt-1">开始新对话探索市场</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] max-w-lg mx-auto">
      {/* Chat Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/20 bg-background/50 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={() => setShowSessions(true)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">
            {sessions?.find((s) => s.id === activeSessionId)?.title ?? "XAUUSD Agent"}
          </div>
          <div className="flex items-center gap-1.5">
            <div className="status-dot status-dot-green" style={{ width: 4, height: 4 }} />
            <span className="text-[10px] text-muted-foreground">在线 · GPT-5.4</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-gold"
          onClick={() => createSession.mutate({ title: "新对话" })}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(!messages || messages.length === 0) && !sendMessage.isPending && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-gold" />
            </div>
            <h3 className="text-base font-bold mb-1">XAUUSD Agent</h3>
            <p className="text-xs text-muted-foreground text-center mb-5 max-w-[260px] leading-relaxed">
              专注黄金日内交易，基于价格行为与关键位分析
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {QUICK_QUESTIONS.slice(0, 4).map((q) => (
                <button
                  key={q.text}
                  className="flex items-center gap-2.5 text-left text-[13px] px-3.5 py-2.5 rounded-xl bg-surface/50 hover:bg-surface-elevated border border-border/20 hover:border-gold/20 text-foreground/80 transition-all duration-200"
                  onClick={() => handleSend(q.text)}
                >
                  <q.icon className="w-4 h-4 text-gold/60 shrink-0" />
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages?.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-gold" />
                </div>
              )}
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === "user"
                    ? "bg-gold/15 text-foreground border border-gold/10"
                    : "glass-card"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="text-[13px] prose prose-invert prose-sm max-w-none leading-relaxed [&_h1]:text-gold [&_h2]:text-gold [&_h3]:text-gold/90 [&_strong]:text-gold/90 [&_code]:text-cyan [&_code]:bg-surface/50 [&_code]:px-1 [&_code]:rounded">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <div className="text-[13px]">{msg.content}</div>
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {sendMessage.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-2.5"
          >
            <div className="w-7 h-7 rounded-lg bg-gold/10 flex items-center justify-center shrink-0">
              <Bot className="w-3.5 h-3.5 text-gold" />
            </div>
            <div className="glass-card rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-gold animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-muted-foreground">分析中...</span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border/20 bg-background/50 backdrop-blur-sm">
        {/* Quick questions scroll */}
        {(!messages || messages.length === 0) && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q.text}
                className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-surface/50 hover:bg-gold/10 border border-border/20 hover:border-gold/20 text-muted-foreground hover:text-gold transition-all whitespace-nowrap"
                onClick={() => handleSend(q.text)}
              >
                {q.text}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入交易问题..."
              className="w-full resize-none bg-surface/60 rounded-xl px-3.5 py-2.5 text-[13px] placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold/30 border border-border/20 focus:border-gold/30 min-h-[40px] max-h-[120px] transition-all"
              rows={1}
            />
          </div>
          <Button
            size="icon"
            className={`h-10 w-10 shrink-0 rounded-xl transition-all duration-200 ${
              input.trim()
                ? "bg-gold/90 hover:bg-gold text-background shadow-[0_0_16px_oklch(0.78_0.14_80/0.2)]"
                : "bg-surface text-muted-foreground"
            }`}
            onClick={() => handleSend()}
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
