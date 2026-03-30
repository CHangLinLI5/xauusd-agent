/**
 * 全局时间工具函数
 * 所有时间显示统一使用中国时间（UTC+8 / Asia/Shanghai）
 */

const CHINA_TZ = "Asia/Shanghai";

/**
 * 格式化时间戳为中国时间的时分秒
 */
export function formatTimeCN(ts: string | undefined): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: CHINA_TZ,
    });
  } catch {
    return "";
  }
}

/**
 * 格式化时间戳为中国时间的时分
 */
export function formatTimeShortCN(ts: string | undefined): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: CHINA_TZ,
    });
  } catch {
    return "";
  }
}

/**
 * 格式化为中国时间的完整日期时间
 */
export function formatDateTimeCN(ts: string | number | Date | undefined): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: CHINA_TZ,
    });
  } catch {
    return "";
  }
}

/**
 * 格式化为中国时间的日期
 */
export function formatDateCN(ts: string | number | Date | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleDateString("zh-CN", {
      timeZone: CHINA_TZ,
      ...options,
    });
  } catch {
    return "";
  }
}

/**
 * 获取当前中国时间的日期字符串（月日）
 */
export function getTodayDateCN(): string {
  return new Date().toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    timeZone: CHINA_TZ,
  });
}

/**
 * 获取当前中国时间的完整日期
 */
export function getFullDateCN(): string {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    timeZone: CHINA_TZ,
  });
}
