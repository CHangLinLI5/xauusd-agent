/**
 * useMarketSocket - WebSocket实时行情数据Hook
 *
 * 通过Socket.IO接收服务器推送的实时价格、Bias、关键位等数据
 * 自动处理连接/断线/重连
 * 断线超过 30s 时自动 fallback 到 tRPC 轮询（每 15s 拉取一次）
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";

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
  id: string;
  time: string;
  name: string;
  importance: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  currency: string;
}

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  category: string;
  impact: string;
  impactLabel: string;
  rhythm: string;
  content: string;
  publishedAt: string;
}

export interface MarketSnapshot {
  quote: MarketQuote;
  bias: BiasData;
  calendar: CalendarEvent[];
  news: NewsItem[];
  serverTime: string;
}

type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error" | "polling";

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

// ========== Constants ==========

/** If no WS data received for this many ms, switch to polling fallback */
const WS_STALE_THRESHOLD_MS = 30_000;

/** Polling interval when in fallback mode */
const POLLING_INTERVAL_MS = 15_000;

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
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastWsDataRef = useRef<number>(Date.now());

  // tRPC query for polling fallback (disabled by default, called manually)
  const snapshotQuery = trpc.market.getSnapshot.useQuery(undefined, {
    enabled: false,
    retry: 1,
  });

  const requestSnapshot = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit("market:requestSnapshot");
    }
  }, []);

  // Start polling fallback
  const startPolling = useCallback(() => {
    if (pollingRef.current) return; // Already polling
    console.log("[WS] Starting tRPC polling fallback");
    setStatus("polling");

    const poll = async () => {
      try {
        const result = await snapshotQuery.refetch();
        if (result.data) {
          const data = result.data as unknown as MarketSnapshot;
          if (data.quote) setQuote(data.quote);
          if (data.bias) setBias(data.bias);
          if (data.calendar) setCalendar(data.calendar);
          if (data.news) setNews(data.news);
          if (data.serverTime) setServerTime(data.serverTime);
          setLastUpdate(Date.now());
        }
      } catch (err) {
        console.warn("[WS] Polling fallback error:", err);
      }
    };

    poll(); // Immediate first poll
    pollingRef.current = setInterval(poll, POLLING_INTERVAL_MS);
  }, [snapshotQuery]);

  // Stop polling fallback
  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      console.log("[WS] Stopping tRPC polling fallback");
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("[WS] Connected to market feed");
      setStatus("connected");
      lastWsDataRef.current = Date.now();
      stopPolling();
      // Request fresh snapshot on initial connect
      socket.emit("market:requestSnapshot");
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
      lastWsDataRef.current = Date.now();
      stopPolling();
      // Request fresh snapshot after reconnect
      socket.emit("market:requestSnapshot");
    });

    // Market data events
    socket.on("market:quote", (data: MarketQuote) => {
      setQuote(data);
      setLastUpdate(Date.now());
      lastWsDataRef.current = Date.now();
    });

    socket.on("market:snapshot", (data: MarketSnapshot) => {
      setQuote(data.quote);
      setBias(data.bias);
      setCalendar(data.calendar);
      setNews(data.news);
      setServerTime(data.serverTime);
      setLastUpdate(Date.now());
      lastWsDataRef.current = Date.now();
    });

    // Stale data detection: if no WS data for 30s, start polling
    const staleChecker = setInterval(() => {
      const elapsed = Date.now() - lastWsDataRef.current;
      if (elapsed > WS_STALE_THRESHOLD_MS && !pollingRef.current) {
        console.warn(`[WS] No data for ${Math.round(elapsed / 1000)}s, switching to polling fallback`);
        startPolling();
      }
    }, 10_000);

    // Cleanup
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("reconnect");
      socket.off("market:quote");
      socket.off("market:snapshot");
      clearInterval(staleChecker);
      stopPolling();
      releaseSocket();
    };
  }, [startPolling, stopPolling]);

  return {
    quote,
    bias,
    calendar,
    news,
    status,
    isConnected: status === "connected" || status === "polling",
    serverTime,
    lastUpdate,
    requestSnapshot,
  };
}
