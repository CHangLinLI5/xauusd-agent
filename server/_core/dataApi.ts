/**
 * Data API 调用模块
 * 
 * 支持两种数据源：
 * 1. Forge API (BUILT_IN_FORGE_API_URL) - 生产环境
 * 2. Manus API Hub (apiproxy.v1.ApiProxyService/CallApi) - 开发/沙盒环境
 * 
 * 当 Forge API 不可用时，自动 fallback 到 Manus API Hub
 */
import { ENV } from "./env";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

// ========== Manus API Hub (Sandbox fallback) ==========

let _sandboxToken: string | null = null;

function getSandboxToken(): string | null {
  if (_sandboxToken !== null) return _sandboxToken || null;
  
  // Try to read sandbox token from well-known location
  const tokenPath = join(homedir(), ".secrets", "sandbox_api_token");
  try {
    if (existsSync(tokenPath)) {
      _sandboxToken = readFileSync(tokenPath, "utf-8").trim();
      return _sandboxToken;
    }
  } catch {
    // ignore
  }
  
  // Fallback: use OPENAI_API_KEY which is the same token in sandbox
  const envToken = process.env.OPENAI_API_KEY || process.env.BUILT_IN_FORGE_API_KEY || "";
  _sandboxToken = envToken;
  return envToken || null;
}

function getManusApiHubUrl(): string {
  const host = process.env.RUNTIME_API_HOST || "https://api.manus.im";
  return `${host}/apiproxy.v1.ApiProxyService/CallApi`;
}

async function callManusApiHub(
  apiId: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  const token = getSandboxToken();
  if (!token) {
    throw new Error("No sandbox token available for Manus API Hub");
  }

  const url = getManusApiHubUrl();
  
  // Convert boolean values to strings (required by Manus API Hub)
  function convertBools(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
    if (!obj) return obj;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "boolean") {
        result[key] = String(value);
      } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        result[key] = convertBools(value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-sandbox-token": token,
    },
    body: JSON.stringify({
      apiId,
      query: convertBools(options.query),
      body: convertBools(options.body),
      path_params: convertBools(options.pathParams),
      multipart_form_data: convertBools(options.formData),
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Manus API Hub request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === "object" && "jsonData" in payload) {
    try {
      return JSON.parse((payload as Record<string, string>).jsonData ?? "{}");
    } catch {
      return (payload as Record<string, unknown>).jsonData;
    }
  }
  return payload;
}

// ========== Forge API (Production) ==========

async function callForgeApi(
  apiId: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
    throw new Error("Forge API is not configured");
  }

  // Build the full URL
  const baseUrl = ENV.forgeApiUrl.endsWith("/") ? ENV.forgeApiUrl : `${ENV.forgeApiUrl}/`;
  const fullUrl = new URL("webdevtoken.v1.WebDevService/CallApi", baseUrl).toString();

  const response = await fetch(fullUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "connect-protocol-version": "1",
      authorization: `Bearer ${ENV.forgeApiKey}`,
    },
    body: JSON.stringify({
      apiId,
      query: options.query,
      body: options.body,
      path_params: options.pathParams,
      multipart_form_data: options.formData,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Forge API request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (payload && typeof payload === "object" && "jsonData" in payload) {
    try {
      return JSON.parse((payload as Record<string, string>).jsonData ?? "{}");
    } catch {
      return (payload as Record<string, unknown>).jsonData;
    }
  }
  return payload;
}

// ========== Public API ==========

/**
 * 调用数据 API
 * 优先使用 Forge API（生产环境），不可用时 fallback 到 Manus API Hub（沙盒环境）
 */
export async function callDataApi(
  apiId: string,
  options: DataApiCallOptions = {}
): Promise<unknown> {
  // Check if Forge API is properly configured (not just OPENAI_BASE_URL fallback)
  const hasForgeApi = !!process.env.BUILT_IN_FORGE_API_URL;
  
  if (hasForgeApi) {
    try {
      return await callForgeApi(apiId, options);
    } catch (error) {
      console.warn(`[DataApi] Forge API failed, trying Manus API Hub:`, error);
      // Fall through to Manus API Hub
    }
  }

  // Use Manus API Hub (sandbox/development)
  return await callManusApiHub(apiId, options);
}
