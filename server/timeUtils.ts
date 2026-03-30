/**
 * 后端时间工具函数
 * 所有面向用户的时间显示统一使用中国时间（UTC+8 / Asia/Shanghai）
 */

const CHINA_TZ = "Asia/Shanghai";

/**
 * 获取当前中国时间的 ISO-like 字符串（带 UTC+8 标识）
 */
export function nowChinaISO(): string {
  return new Date().toLocaleString("sv-SE", { timeZone: CHINA_TZ }).replace(" ", "T") + "+08:00";
}

/**
 * 获取当前中国时间的日期字符串 YYYY-MM-DD
 */
export function todayChinaDate(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: CHINA_TZ });
}

/**
 * 获取当前中国时间的小时数（0-23）
 */
export function chinaNowHour(): number {
  const timeStr = new Date().toLocaleTimeString("en-US", {
    timeZone: CHINA_TZ,
    hour12: false,
    hour: "2-digit",
  });
  return parseInt(timeStr, 10);
}

/**
 * 格式化时间戳为中国时间的 HH:mm
 */
export function formatTimeShortCN(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("zh-CN", {
      timeZone: CHINA_TZ,
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts.split("T")[1]?.slice(0, 5) ?? "";
  }
}
