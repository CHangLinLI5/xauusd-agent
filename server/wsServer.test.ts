import { describe, expect, it } from "vitest";

describe("WebSocket Server", () => {
  it("wsServer module exports required functions", async () => {
    const ws = await import("./wsServer");
    expect(typeof ws.initWebSocket).toBe("function");
    expect(typeof ws.startRealtimePush).toBe("function");
    expect(typeof ws.stopRealtimePush).toBe("function");
    expect(typeof ws.getConnectionCount).toBe("function");
  });

  it("getConnectionCount returns 0 before any connections", async () => {
    const { getConnectionCount } = await import("./wsServer");
    expect(getConnectionCount()).toBe(0);
  });

  it("stopRealtimePush does not throw when called without start", async () => {
    const { stopRealtimePush } = await import("./wsServer");
    expect(() => stopRealtimePush()).not.toThrow();
  });
});
