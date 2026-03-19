import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Streamdown } from "streamdown";
import {
  Send,
  Plus,
  Trash2,
  MessageSquare,
  LogIn,
  Loader2,
  ChevronLeft,
} from "lucide-react";

const QUICK_QUESTIONS = [
  "今天 XAUUSD 偏多还是偏空？",
  "当前价格接近哪个关键位？",
  "现在是消息前震荡还是消息后单边？",
  "给我生成今天的完整交易计划",
  "当前有没有优质报价区？",
  "今天有哪些重要数据？",
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

  // Auto-resize textarea
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <MessageSquare className="w-12 h-12 text-primary mb-4" />
        <h2 className="text-lg font-semibold mb-2">AI 交易分析对话</h2>
        <p className="text-sm text-muted-foreground text-center mb-4">
          登录后即可与 XAUUSD Agent 进行专业交易分析对话
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

  // Session list view
  if (showSessions) {
    return (
      <div className="px-4 py-4 max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">对话记录</h2>
          <Button
            size="sm"
            onClick={() => createSession.mutate({ title: "新对话" })}
            className="gap-1"
          >
            <Plus className="w-4 h-4" />
            新对话
          </Button>
        </div>
        <div className="space-y-2">
          {sessions?.map((session) => (
            <Card
              key={session.id}
              className={`cursor-pointer transition-colors ${
                session.id === activeSessionId ? "border-primary/50" : "border-border/50 hover:border-border"
              }`}
              onClick={() => {
                setActiveSessionId(session.id);
                setShowSessions(false);
              }}
            >
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{session.title}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(session.updatedAt).toLocaleString("zh-CN")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession.mutate({ sessionId: session.id });
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
          {(!sessions || sessions.length === 0) && (
            <div className="text-center text-muted-foreground py-8">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">暂无对话记录</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] max-w-lg mx-auto">
      {/* Chat Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowSessions(true)}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {sessions?.find((s) => s.id === activeSessionId)?.title ?? "XAUUSD Agent"}
          </div>
          <div className="text-[10px] text-muted-foreground">专业黄金交易分析</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => createSession.mutate({ title: "新对话" })}
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {(!messages || messages.length === 0) && !sendMessage.isPending && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-medium mb-1">XAUUSD Agent</h3>
            <p className="text-xs text-muted-foreground text-center mb-4 max-w-[250px]">
              专注黄金日内交易分析，基于价格行为、关键位和基本面
            </p>
            <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
              {QUICK_QUESTIONS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  className="text-left text-xs px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground transition-colors"
                  onClick={() => handleSend(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages?.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="text-sm prose prose-invert prose-sm max-w-none">
                  <Streamdown>{msg.content}</Streamdown>
                </div>
              ) : (
                <div className="text-sm">{msg.content}</div>
              )}
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="bg-secondary/50 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                分析中...
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border/30">
        <div className="flex items-end gap-2">
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
            placeholder="输入你的问题..."
            className="flex-1 resize-none bg-secondary/50 rounded-xl px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 min-h-[40px] max-h-[120px]"
            rows={1}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl"
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
