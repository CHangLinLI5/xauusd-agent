/**
 * WebSocket 实时推送服务
 * 后台定期获取行情数据，通过 Socket.IO 推送给所有连接的客户端
 * 客户端不再需要轮询 market.quote / market.dailyBias
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
  quote: 10 * 1000,      // Push quote every 10 seconds
  fullSnapshot: 30 * 1000, // Push full snapshot every 30 seconds
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
    }

    // Client can request a fresh snapshot
    socket.on("market:requestSnapshot", async () => {
      const snapshot = await buildSnapshot();
      socket.emit("market:snapshot", snapshot);
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
  // Main push loop - runs every 8 seconds
  pushInterval = setInterval(async () => {
    if (!io || connectedClients === 0) return;

    const now = Date.now();

    try {
      // Always push quote (lightweight)
      if (now - lastQuotePush >= PUSH_INTERVALS.quote) {
        const quote = await getQuoteSafe();
        io.emit("market:quote", quote);
        lastQuotePush = now;
      }

      // Push full snapshot less frequently
      if (now - lastFullPush >= PUSH_INTERVALS.fullSnapshot) {
        const snapshot = await buildSnapshot();
        lastSnapshot = snapshot;
        io.emit("market:snapshot", snapshot);
        lastFullPush = now;
      }
    } catch (err) {
      console.error("[WS] Push error:", err);
    }
  }, 8000);

  // Initial snapshot build
  buildSnapshot().then((s) => {
    lastSnapshot = s;
    console.log("[WS] Initial snapshot built, realtime push started");
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
