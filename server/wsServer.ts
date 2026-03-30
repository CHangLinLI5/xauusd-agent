/**
 * WebSocket 实时推送服务 v5
 *
 * v5 改进：
 * - 使用真实新闻源（Google News RSS）替代 Mock 新闻
 * - 使用动态经济日历替代 Mock 日历
 * - 优化推送策略：报价 3s，快照 20s（减少 API 压力）
 * - 新闻独立刷新周期（5分钟），不阻塞报价推送
 * - 连接时立即推送缓存数据
 */
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { getRealQuote, calculateKeyLevels, getRealDailyBias } from "./marketData";
import { getMockQuote, getMockDailyBias } from "./mockData";
import { getGoldNews } from "./newsService";
import { getEconomicCalendar } from "./calendarService";
import type { MarketQuote } from "./mockData";

// ========== Types ==========

interface MarketSnapshot {
  quote: MarketQuote;
  bias: {
    bias: string;
    biasLabel: string;
    confidence: string;
    riskStatus: string;
    riskLabel: string;
    summary: string;
    keyLevels: {
      resistance1: number;
      resistance2: number;
      support1: number;
      support2: number;
      boxTop: number;
      boxBottom: number;
    };
    sessions: { asia: string; europe: string; us: string };
  };
  calendar: ReturnType<typeof getEconomicCalendar>;
  news: Awaited<ReturnType<typeof getGoldNews>>;
  serverTime: string;
}

// ========== State ==========

let io: Server | null = null;
let pushInterval: ReturnType<typeof setInterval> | null = null;
let lastSnapshot: MarketSnapshot | null = null;
let connectedClients = 0;

// Separate news cache to avoid blocking quote pushes
let cachedNews: Awaited<ReturnType<typeof getGoldNews>> | null = null;
let lastNewsFetch = 0;
const NEWS_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// ========== Push Intervals ==========

const PUSH_INTERVALS = {
  quote: 3 * 1000,          // Push quote every 3 seconds
  fullSnapshot: 20 * 1000,  // Push full snapshot every 20 seconds
};

// ========== Initialize ==========

export function initWebSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    path: "/api/ws",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.on("connection", (socket: Socket) => {
    connectedClients++;
    console.log(`[WS] Client connected (${connectedClients} total)`);

    // Send last snapshot immediately on connect (from cache, no new API call)
    if (lastSnapshot) {
      socket.emit("market:snapshot", lastSnapshot);
    } else {
      // No cached snapshot yet — build one for this client
      buildSnapshot().then((snapshot) => {
        lastSnapshot = snapshot;
        socket.emit("market:snapshot", snapshot);
      }).catch(() => {
        getQuoteSafe().then((quote) => {
          socket.emit("market:quote", quote);
        });
      });
    }

    // Client can request a fresh snapshot
    socket.on("market:requestSnapshot", async () => {
      try {
        const snapshot = await buildSnapshot();
        lastSnapshot = snapshot;
        socket.emit("market:snapshot", snapshot);
      } catch (err) {
        console.error("[WS] Failed to build snapshot on request:", (err as Error).message?.slice(0, 80));
      }
    });

    socket.on("disconnect", () => {
      connectedClients--;
      console.log(`[WS] Client disconnected (${connectedClients} total)`);
    });

    socket.on("error", (err) => {
      console.error("[WS] Socket error:", err);
    });
  });

  console.log("[WS] WebSocket server initialized on /api/ws");
  return io;
}

// ========== Data Push Loop ==========

let lastQuotePush = 0;
let lastFullPush = 0;

export function startRealtimePush() {
  // Pre-fetch news in background (non-blocking)
  refreshNews();

  // Main push loop - runs every 3 seconds
  pushInterval = setInterval(async () => {
    if (!io || connectedClients === 0) return;

    const now = Date.now();

    // Push quote every 3s
    if (now - lastQuotePush >= PUSH_INTERVALS.quote) {
      try {
        const quote = await getQuoteSafe();
        io.emit("market:quote", quote);
        lastQuotePush = now;
      } catch (err) {
        console.error("[WS] Quote push error:", (err as Error).message?.slice(0, 80));
      }
    }

    // Push full snapshot every 20s
    if (now - lastFullPush >= PUSH_INTERVALS.fullSnapshot) {
      try {
        const snapshot = await buildSnapshot();
        lastSnapshot = snapshot;
        io.emit("market:snapshot", snapshot);
        lastFullPush = now;
      } catch (err) {
        console.error("[WS] Snapshot push error:", (err as Error).message?.slice(0, 80));
      }
    }
  }, 3000);

  // Initial snapshot build
  buildSnapshot().then((s) => {
    lastSnapshot = s;
    console.log(`[WS] Initial snapshot built ($${s.quote.price}), realtime push started (3s quote / 20s snapshot)`);
  }).catch(() => {
    console.warn("[WS] Initial snapshot build failed, will retry");
  });
}

export function stopRealtimePush() {
  if (pushInterval) {
    clearInterval(pushInterval);
    pushInterval = null;
  }
}

// ========== Helpers ==========

async function getQuoteSafe(): Promise<MarketQuote> {
  try {
    return await getRealQuote();
  } catch {
    return getMockQuote();
  }
}

async function refreshNews() {
  const now = Date.now();
  if (cachedNews && now - lastNewsFetch < NEWS_REFRESH_INTERVAL) {
    return;
  }

  try {
    cachedNews = await getGoldNews();
    lastNewsFetch = now;
  } catch (err) {
    console.warn("[WS] News refresh failed:", (err as Error).message?.slice(0, 80));
  }
}

async function buildSnapshot(): Promise<MarketSnapshot> {
  let quote: MarketQuote;
  let bias;

  try {
    quote = await getRealQuote();
  } catch {
    quote = getMockQuote();
  }

  try {
    bias = await getRealDailyBias();
  } catch {
    bias = getMockDailyBias();
  }

  // Get calendar (synchronous, dynamic generation)
  const calendar = getEconomicCalendar();

  // Get news (use cached or refresh in background)
  let news = cachedNews;
  if (!news) {
    // First time: try to fetch, but don't block too long
    try {
      const newsPromise = getGoldNews();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
      const result = await Promise.race([newsPromise, timeoutPromise]);
      if (result) {
        news = result;
        cachedNews = result;
        lastNewsFetch = Date.now();
      }
    } catch {
      // ignore
    }
  }

  // Fallback to mock if still no news
  if (!news || news.length === 0) {
    const { getMockNews } = await import("./mockData");
    news = getMockNews();
  }

  // Trigger background news refresh if stale
  if (Date.now() - lastNewsFetch > NEWS_REFRESH_INTERVAL) {
    refreshNews(); // fire and forget
  }

  return {
    quote,
    bias,
    calendar,
    news,
    serverTime: new Date().toISOString(),
  };
}

export function getConnectionCount() {
  return connectedClients;
}
