import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerDevAuthRoutes } from "./devAuth";
import { registerEmailAuthRoutes } from "./emailAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { startCacheWarming } from "../marketData";
import { initWebSocket, startRealtimePush } from "../wsServer";
import { registerStreamRoutes } from "../streamChat";
import { startTDWebSocket } from "../tdWebSocket";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const tester = net.createServer();
    tester.listen(port, "0.0.0.0", () => {
      tester.close(() => resolve(true));
    });
    tester.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Trust proxy (required for rate limiting and secure cookies behind reverse proxy)
  app.set("trust proxy", 1);

  // Security headers
  try {
    const helmet = (await import("helmet")).default;
    app.use(helmet());
  } catch {
    console.warn("[Server] helmet not installed, skipping security headers. Run: pnpm add helmet");
  }

  // Rate limiting for API routes
  try {
    const { rateLimit } = await import("express-rate-limit");
    app.use("/api", rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }));
  } catch {
    console.warn("[Server] express-rate-limit not installed, skipping rate limiting. Run: pnpm add express-rate-limit");
  }

  // Configure body parser with reasonable size limit
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // Serve uploaded files: in development open static, in production require auth
  if (process.env.NODE_ENV !== "production") {
    app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  } else {
    // In production, serve uploads through a controlled route
    // TODO: Add authentication middleware and signed URL support
    app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
    console.warn("[Server] /uploads is publicly accessible. Consider adding auth middleware for production.");
  }
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Dev login (only active in non-production when OAuth is not configured)
  registerDevAuthRoutes(app);
  // Email + password authentication
  registerEmailAuthRoutes(app);
  // Stream chat SSE endpoint (before tRPC)
  registerStreamRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Initialize WebSocket before listen
  initWebSocket(server);

  server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${port}/`);
    // Start Twelve Data WebSocket for real-time XAU/USD price (no API cost)
    startTDWebSocket();
    // Start background cache warming (K-lines only, REST API)
    startCacheWarming();
    // Start WebSocket realtime push to frontend clients
    startRealtimePush();
  });
}

startServer().catch(console.error);
