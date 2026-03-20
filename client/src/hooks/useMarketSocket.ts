/**
 * useMarketSocket - WebSocket实时行情数据Hook
 * 
 * 通过Socket.IO接收服务器推送的实时价格、Bias、关键位等数据
 * 自动处理连接/断线/重连，断线时自动fallback到tRPC轮询
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

// ========== Types ==========

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  timestamp: string;
}

interface KeyLevels {
  resistance1: number;
  resistance2: number;
  support1: number;
  support2: number;
  boxTop: number;
  boxBottom: number;
}

interface BiasData {
  bias: string;
  biasLabel: string;
  confidence: string;
  riskStatus: string;
  riskLabel: string;
  summary: string;
  keyLevels: KeyLevels;
  sessions: { asia: string; europe: string; us: string };
}

interface CalendarEvent {
  time: string;
  event: string;
  importance: string;
  forecast?: string;
  previous?: string;
  actual?: string;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  impact: string;
  impactDirection: string;
  publishedAt: string;
  tradingImpact: string;
}

export interface MarketSnapshot {
  quote: MarketQuote;
  bias: BiasData;
  calendar: CalendarEvent[];
  news: NewsItem[];
  serverTime: string;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface UseMarketSocketReturn {
  quote: MarketQuote | null;
  bias: BiasData | null;
  calendar: CalendarEvent[] | null;
  news: NewsItem[] | null;
  status: ConnectionStatus;
  isConnected: boolean;
  serverTime: string | null;
  lastUpdate: number;
  requestSnapshot: () => void;
}

// ========== Singleton Socket ==========

let globalSocket: Socket | null = null;
let socketRefCount = 0;

function getSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io({
      path: "/api/ws",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      timeout: 15000,
    });
  }
  socketRefCount++;
  return globalSocket;
}

function releaseSocket() {
  socketRefCount--;
  if (socketRefCount <= 0 && globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
    socketRefCount = 0;
  }
}

// ========== Hook ==========

export function useMarketSocket(): UseMarketSocketReturn {
  const [quote, setQuote] = useState<MarketQuote | null>(null);
  const [bias, setBias] = useState<BiasData | null>(null);
  const [calendar, setCalendar] = useState<CalendarEvent[] | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [serverTime, setServerTime] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  const requestSnapshot = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("market:requestSnapshot");
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("[WS] Connected to market feed");
      setStatus("connected");
    });

    socket.on("disconnect", (reason) => {
      console.log("[WS] Disconnected:", reason);
      setStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.warn("[WS] Connection error:", err.message);
      setStatus("error");
    });

    socket.on("reconnect", () => {
      console.log("[WS] Reconnected");
      setStatus("connected");
      // Request fresh snapshot after reconnect
      socket.emit("market:requestSnapshot");
    });

    // Market data events
    socket.on("market:quote", (data: MarketQuote) => {
      setQuote(data);
      setLastUpdate(Date.now());
    });

    socket.on("market:snapshot", (data: MarketSnapshot) => {
      setQuote(data.quote);
      setBias(data.bias);
      setCalendar(data.calendar);
      setNews(data.news);
      setServerTime(data.serverTime);
      setLastUpdate(Date.now());
    });

    // Cleanup
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("reconnect");
      socket.off("market:quote");
      socket.off("market:snapshot");
      releaseSocket();
    };
  }, []);

  return {
    quote,
    bias,
    calendar,
    news,
    status,
    isConnected: status === "connected",
    serverTime,
    lastUpdate,
    requestSnapshot,
  };
}
