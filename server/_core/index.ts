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
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Serve uploaded files from /uploads directory (local storage fallback)
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Dev login (only active in non-production when OAuth is not configured)
  registerDevAuthRoutes(app);
  // Email + password authentication
  registerEmailAuthRoutes(app);
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
    // Start background cache warming so API responses are always fast
    startCacheWarming();
    // Start WebSocket realtime push
    startRealtimePush();
  });
}

startServer().catch(console.error);
