/**
 * Twelve Data WebSocket 客户端
 *
 * 功能：
 * - 持久连接 Twelve Data WebSocket，订阅 XAU/USD 实时价格推送
 * - 推送的价格直接更新到内存缓存
 * - 自动重连（指数退避）
 * - 心跳检测
 *
 * 这样 REST API 只用于 K 线数据，每天约 200-300 次，远低于 800 上限
 */
import WebSocket from "ws";
import { ENV } from "./_core/env";

// ========== Types ==========

interface TDWsPrice {
  event: "price";
  symbol: string;
  currency: string;
  currency_base: string;
  currency_quote: string;
  exchange: string;
  type: string;
  timestamp: number;
  price: number;
}

interface TDWsSubscribeStatus {
  event: "subscribe-status";
  status: string;
  success: Array<{ symbol: string; exchange: string; type: string }> | null;
  fails: Array<{ symbol: string; msg: string }> | null;
}

interface TDWsHeartbeat {
  event: "heartbeat";
  status: string;
}

type TDWsMessage = TDWsPrice | TDWsSubscribeStatus | TDWsHeartbeat;

// ========== State ==========

const API_KEY = ENV.twelveDataApiKey || process.env.TWELVE_DATA_API_KEY || "f92ddfeaf4fb4a44bbc78eebd0f1801c";
const WS_URL = `wss://ws.twelvedata.com/v1/quotes/price?apikey=${API_KEY}`;
const SYMBOL = "XAU/USD";

let ws: WebSocket | null = null;
let isConnected = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let lastPriceTime = 0;

// Price cache - updated by WebSocket
let latestPrice: number | null = null;
let latestTimestamp: number = 0;

// Callbacks
type PriceCallback = (price: number, timestamp: number) => void;
const priceCallbacks: PriceCallback[] = [];

// ========== Public API ==========

/**
 * 获取 WebSocket 推送的最新价格
 * 如果 WebSocket 断线超过 60 秒，返回 null（让调用方 fallback 到 REST）
 */
export function getWsPrice(): { price: number; timestamp: number } | null {
  if (!latestPrice || !latestTimestamp) return null;

  // 如果价格超过 60 秒没更新（可能断线了），返回 null
  const age = Date.now() - lastPriceTime;
  if (age > 60 * 1000) return null;

  return { price: latestPrice, timestamp: latestTimestamp };
}

/**
 * 注册价格更新回调
 */
export function onPriceUpdate(callback: PriceCallback) {
  priceCallbacks.push(callback);
  return () => {
    const idx = priceCallbacks.indexOf(callback);
    if (idx >= 0) priceCallbacks.splice(idx, 1);
  };
}

/**
 * WebSocket 是否已连接
 */
export function isWsConnected(): boolean {
  return isConnected;
}

/**
 * 启动 WebSocket 连接
 */
export function startTDWebSocket() {
  if (ws) {
    console.log("[TDWebSocket] Already connected or connecting");
    return;
  }

  connect();
}

/**
 * 停止 WebSocket 连接
 */
export function stopTDWebSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  isConnected = false;
  console.log("[TDWebSocket] Stopped");
}

// ========== Internal ==========

function connect() {
  try {
    console.log(`[TDWebSocket] Connecting to Twelve Data WebSocket... (attempt ${reconnectAttempts + 1})`);

    ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      console.log("[TDWebSocket] Connected!");
      isConnected = true;
      reconnectAttempts = 0;

      // Subscribe to XAU/USD
      const subscribeMsg = JSON.stringify({
        action: "subscribe",
        params: { symbols: SYMBOL },
      });
      ws!.send(subscribeMsg);
      console.log(`[TDWebSocket] Subscribed to ${SYMBOL}`);

      // Start heartbeat check
      startHeartbeat();
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        const msg = JSON.parse(data.toString()) as TDWsMessage;

        if (msg.event === "price") {
          const priceMsg = msg as TDWsPrice;
          const price = typeof priceMsg.price === "number" ? priceMsg.price : parseFloat(String(priceMsg.price));

          if (price > 1000) {
            latestPrice = price;
            latestTimestamp = priceMsg.timestamp;
            lastPriceTime = Date.now();

            // Notify callbacks
            for (const cb of priceCallbacks) {
              try { cb(price, priceMsg.timestamp); } catch { /* silent */ }
            }
          }
        } else if (msg.event === "subscribe-status") {
          const status = msg as TDWsSubscribeStatus;
          if (status.status === "ok" && status.success) {
            console.log(`[TDWebSocket] Subscription confirmed: ${status.success.map(s => s.symbol).join(", ")}`);
          }
          if (status.fails && status.fails.length > 0) {
            console.error(`[TDWebSocket] Subscription failed:`, status.fails);
          }
        } else if (msg.event === "heartbeat") {
          // Heartbeat received, connection is alive
        }
      } catch (err) {
        console.error("[TDWebSocket] Parse error:", (err as Error).message?.slice(0, 80));
      }
    });

    ws.on("close", (code, reason) => {
      console.log(`[TDWebSocket] Disconnected (code=${code}, reason=${reason?.toString()?.slice(0, 50)})`);
      isConnected = false;
      ws = null;
      stopHeartbeat();
      scheduleReconnect();
    });

    ws.on("error", (err) => {
      console.error("[TDWebSocket] Error:", (err as Error).message?.slice(0, 80));
      // close event will follow, which triggers reconnect
    });

  } catch (err) {
    console.error("[TDWebSocket] Connection failed:", (err as Error).message?.slice(0, 80));
    ws = null;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;

  reconnectAttempts++;
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
  console.log(`[TDWebSocket] Reconnecting in ${delay / 1000}s...`);

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function startHeartbeat() {
  stopHeartbeat();
  // Check every 30s if we received data recently
  heartbeatTimer = setInterval(() => {
    if (!isConnected || !ws) return;

    const sinceLastPrice = Date.now() - lastPriceTime;
    // If no price update in 60s during market hours, try ping
    if (sinceLastPrice > 60000 && lastPriceTime > 0) {
      console.log("[TDWebSocket] No price update in 60s, sending ping...");
      try {
        ws.ping();
      } catch {
        // If ping fails, close and reconnect
        console.log("[TDWebSocket] Ping failed, reconnecting...");
        ws.close();
      }
    }
  }, 30000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
