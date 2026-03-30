/**
 * Storage module v2
 *
 * v2 改进：
 * - 当 Forge 存储不可用时，降级到本地文件存储
 * - 图片保存到 /uploads 目录，通过 Express 静态文件提供访问
 * - 确保图表分析功能在任何环境下都能工作
 */

import { ENV } from './_core/env';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

type StorageConfig = { baseUrl: string; apiKey: string };

// ========== Local Storage Fallback ==========

const UPLOADS_DIR = join(process.cwd(), 'uploads');

function ensureUploadsDir() {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true });
  }
}

// ========== Forge Storage (Production) ==========

function getStorageConfig(): StorageConfig | null {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetch(downloadApiUrl, {
    method: "GET",
    headers: buildAuthHeaders(apiKey),
  });
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

// ========== Public API ==========

/**
 * 上传文件到存储
 * 优先使用 Forge 存储，不可用时降级到本地文件
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();

  // Try Forge storage first
  if (config) {
    try {
      const key = normalizeKey(relKey);
      const uploadUrl = buildUploadUrl(config.baseUrl, key);
      const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: buildAuthHeaders(config.apiKey),
        body: formData,
      });

      if (response.ok) {
        const url = (await response.json()).url;
        return { key, url };
      }
      console.warn(`[Storage] Forge upload failed (${response.status}), falling back to local`);
    } catch (error) {
      console.warn("[Storage] Forge upload error, falling back to local:", (error as Error).message);
    }
  }

  // Fallback: save to local filesystem
  ensureUploadsDir();

  const ext = getExtFromContentType(contentType);
  const fileName = `${randomUUID()}${ext}`;
  const filePath = join(UPLOADS_DIR, fileName);

  if (typeof data === "string") {
    // Handle base64 data
    if (data.startsWith("data:")) {
      const base64Data = data.split(",")[1] || data;
      writeFileSync(filePath, Buffer.from(base64Data, "base64"));
    } else {
      writeFileSync(filePath, data);
    }
  } else {
    writeFileSync(filePath, data);
  }

  const key = `uploads/${fileName}`;
  const url = `/uploads/${fileName}`;

  console.log(`[Storage] File saved locally: ${filePath}`);
  return { key, url };
}

/**
 * 获取文件下载 URL
 * 优先使用 Forge 存储，不可用时返回本地路径
 */
export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const config = getStorageConfig();
  const key = normalizeKey(relKey);

  // Try Forge storage first
  if (config) {
    try {
      return {
        key,
        url: await buildDownloadUrl(config.baseUrl, key, config.apiKey),
      };
    } catch (error) {
      console.warn("[Storage] Forge download URL failed, trying local:", (error as Error).message);
    }
  }

  // Fallback: local file
  const localPath = join(UPLOADS_DIR, key.replace(/^uploads\//, ""));
  if (existsSync(localPath)) {
    return { key, url: `/${key}` };
  }

  // If key starts with uploads/, try direct path
  if (key.startsWith("uploads/")) {
    return { key, url: `/${key}` };
  }

  return { key, url: `/uploads/${key}` };
}

// ========== Helpers ==========

function getExtFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/svg+xml": ".svg",
    "application/pdf": ".pdf",
    "application/json": ".json",
    "text/plain": ".txt",
  };
  return map[contentType] || ".bin";
}
