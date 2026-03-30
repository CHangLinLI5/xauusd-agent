/**
 * WebSocket 实时推送服务 v3
 *
 * 优化点：
 * - 推送间隔从 3s/15s 优化为 2s/10s，价格更新更快
 * - 连接时立即推送最新数据 + 主动构建快照
 * - 增加错误隔离，单次推送失败不影响后续
 * - 增加连接状态日志
 */
import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import { getRealQuote, calculateKeyLevels, getRealDailyBias } from "./marketData";
import { getMockQuote, getMockDailyBias, getMockEconomicCalendar, getMockNews } from "./mockData";
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
  calendar: ReturnType<typeof getMockEconomicCalendar>;
  news: ReturnType<typeof getMockNews>;
  serverTime: string;
}

// ========== State ==========

let io: Server | null = null;
let pushInterval: ReturnType<typeof setInterval> | null = null;
let lastSnapshot: MarketSnapshot | null = null;
let connectedClients = 0;

// ========== Push Intervals ==========

const PUSH_INTERVALS = {
  quote: 2 * 1000,        // Push quote every 2 seconds
  fullSnapshot: 10 * 1000, // Push full snapshot every 10 seconds
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

    // Send last snapshot immediately on connect
    if (lastSnapshot) {
      socket.emit("market:snapshot", lastSnapshot);
    } else {
      // No cached snapshot yet — build one for this client
      buildSnapshot().then((snapshot) => {
        lastSnapshot = snapshot;
        socket.emit("market:snapshot", snapshot);
      }).catch(() => {
        // If snapshot build fails, at least send a quote
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
        console.error("[WS] Failed to build snapshot on request:", err);
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
  // Main push loop - runs every 2 seconds
  pushInterval = setInterval(async () => {
    if (!io || connectedClients === 0) return;

    const now = Date.now();

    // Always push quote (lightweight, every 2s)
    if (now - lastQuotePush >= PUSH_INTERVALS.quote) {
      try {
        const quote = await getQuoteSafe();
        io.emit("market:quote", quote);
        lastQuotePush = now;
      } catch (err) {
        console.error("[WS] Quote push error:", err);
      }
    }

    // Push full snapshot less frequently (every 10s)
    if (now - lastFullPush >= PUSH_INTERVALS.fullSnapshot) {
      try {
        const snapshot = await buildSnapshot();
        lastSnapshot = snapshot;
        io.emit("market:snapshot", snapshot);
        lastFullPush = now;
      } catch (err) {
        console.error("[WS] Snapshot push error:", err);
      }
    }
  }, 2000);

  // Initial snapshot build
  buildSnapshot().then((s) => {
    lastSnapshot = s;
    console.log(`[WS] Initial snapshot built ($${s.quote.price}), realtime push started (2s quote / 10s snapshot)`);
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

  const calendar = getMockEconomicCalendar();
  const news = getMockNews();

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
