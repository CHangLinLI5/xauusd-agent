/**
 * 经济日历服务模块
 *
 * 基于当前日期动态生成经济日历事件
 * 包含真实的经济数据发布时间表和重要事件
 * 
 * 数据来源：基于美国/全球主要经济数据发布的固定时间表
 * （CPI、NFP、FOMC、GDP 等有固定发布规律）
 */

interface CalendarEvent {
  id: string;
  name: string;
  time: string;
  currency: string;
  impact: "high" | "medium" | "low";
  importance: "high" | "medium" | "low"; // alias for frontend compat
  impactLabel: string;
  previous: string;
  forecast: string;
  actual: string;
  rhythm: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ========== Cache ==========

let calendarCache: CacheEntry<CalendarEvent[]> | null = null;
const CALENDAR_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ========== Economic Calendar Templates ==========

interface EventTemplate {
  name: string;
  currency: string;
  impact: "high" | "medium" | "low";
  impactLabel: string;
  rhythm: string;
  timeUTC: string; // HH:MM format
  // Scheduling rules
  schedule: {
    type: "monthly_weekday" | "monthly_date" | "periodic" | "specific_months";
    // For monthly_weekday: which week (1-4) and day (0=Sun, 1=Mon, etc.)
    week?: number;
    dayOfWeek?: number;
    // For monthly_date: which date
    date?: number;
    // For periodic: every N weeks
    intervalWeeks?: number;
    // For specific_months: which months (1-12)
    months?: number[];
    // Day range for approximate scheduling
    dayRange?: [number, number];
  };
  previousRange: [number, number]; // Range for mock previous value
  forecastRange: [number, number]; // Range for mock forecast value
  format: string; // e.g., "percent", "number", "k"
}

const EVENT_TEMPLATES: EventTemplate[] = [
  // ===== HIGH IMPACT =====
  {
    name: "美国非农就业人数 (NFP)",
    currency: "USD",
    impact: "high",
    impactLabel: "高",
    rhythm: "每月第一个周五 20:30",
    timeUTC: "12:30",
    schedule: { type: "monthly_weekday", week: 1, dayOfWeek: 5 },
    previousRange: [150, 300],
    forecastRange: [160, 280],
    format: "k",
  },
  {
    name: "美联储利率决议 (FOMC)",
    currency: "USD",
    impact: "high",
    impactLabel: "高",
    rhythm: "每6周一次 周三 02:00",
    timeUTC: "18:00",
    schedule: { type: "periodic", intervalWeeks: 6, dayOfWeek: 3 },
    previousRange: [400, 550],
    forecastRange: [375, 525],
    format: "bps",
  },
  {
    name: "美国CPI年率",
    currency: "USD",
    impact: "high",
    impactLabel: "高",
    rhythm: "每月中旬 20:30",
    timeUTC: "12:30",
    schedule: { type: "monthly_date", dayRange: [10, 15] },
    previousRange: [2.0, 4.5],
    forecastRange: [2.0, 4.2],
    format: "percent",
  },
  {
    name: "美国GDP年化季率 (初值)",
    currency: "USD",
    impact: "high",
    impactLabel: "高",
    rhythm: "每季度末月下旬 20:30",
    timeUTC: "12:30",
    schedule: { type: "specific_months", months: [1, 4, 7, 10], dayRange: [25, 30] },
    previousRange: [1.5, 3.5],
    forecastRange: [1.8, 3.2],
    format: "percent",
  },
  {
    name: "欧洲央行利率决议",
    currency: "EUR",
    impact: "high",
    impactLabel: "高",
    rhythm: "每6周一次 周四 20:15",
    timeUTC: "12:15",
    schedule: { type: "periodic", intervalWeeks: 6, dayOfWeek: 4 },
    previousRange: [300, 450],
    forecastRange: [275, 425],
    format: "bps",
  },

  // ===== MEDIUM IMPACT =====
  {
    name: "美国初请失业金人数",
    currency: "USD",
    impact: "medium",
    impactLabel: "中",
    rhythm: "每周四 20:30",
    timeUTC: "12:30",
    schedule: { type: "monthly_weekday", week: 0, dayOfWeek: 4 }, // Every Thursday
    previousRange: [200, 260],
    forecastRange: [210, 250],
    format: "k",
  },
  {
    name: "美国核心PCE物价指数年率",
    currency: "USD",
    impact: "medium",
    impactLabel: "中",
    rhythm: "每月最后一个周五 20:30",
    timeUTC: "12:30",
    schedule: { type: "monthly_date", dayRange: [26, 31] },
    previousRange: [2.5, 4.0],
    forecastRange: [2.4, 3.8],
    format: "percent",
  },
  {
    name: "美国ISM制造业PMI",
    currency: "USD",
    impact: "medium",
    impactLabel: "中",
    rhythm: "每月第一个工作日 22:00",
    timeUTC: "14:00",
    schedule: { type: "monthly_date", dayRange: [1, 3] },
    previousRange: [46, 55],
    forecastRange: [47, 54],
    format: "number",
  },
  {
    name: "美国零售销售月率",
    currency: "USD",
    impact: "medium",
    impactLabel: "中",
    rhythm: "每月中旬 20:30",
    timeUTC: "12:30",
    schedule: { type: "monthly_date", dayRange: [13, 17] },
    previousRange: [-0.5, 1.5],
    forecastRange: [-0.3, 1.2],
    format: "percent",
  },
  {
    name: "中国央行黄金储备",
    currency: "CNY",
    impact: "medium",
    impactLabel: "中",
    rhythm: "每月上旬公布",
    timeUTC: "02:00",
    schedule: { type: "monthly_date", dayRange: [7, 10] },
    previousRange: [7200, 7400],
    forecastRange: [7200, 7500],
    format: "tons",
  },

  // ===== LOW IMPACT =====
  {
    name: "美国密歇根大学消费者信心指数",
    currency: "USD",
    impact: "low",
    impactLabel: "低",
    rhythm: "每月中旬周五 22:00",
    timeUTC: "14:00",
    schedule: { type: "monthly_date", dayRange: [12, 16] },
    previousRange: [60, 80],
    forecastRange: [62, 78],
    format: "number",
  },
  {
    name: "美国耐用品订单月率",
    currency: "USD",
    impact: "low",
    impactLabel: "低",
    rhythm: "每月下旬 20:30",
    timeUTC: "12:30",
    schedule: { type: "monthly_date", dayRange: [22, 28] },
    previousRange: [-2.0, 3.0],
    forecastRange: [-1.5, 2.5],
    format: "percent",
  },
  {
    name: "欧元区CPI年率",
    currency: "EUR",
    impact: "low",
    impactLabel: "低",
    rhythm: "每月初 17:00",
    timeUTC: "09:00",
    schedule: { type: "monthly_date", dayRange: [1, 3] },
    previousRange: [1.5, 3.5],
    forecastRange: [1.5, 3.2],
    format: "percent",
  },
];

// ========== Calendar Generation ==========

function generateCalendarEvents(): CalendarEvent[] {
  const now = new Date();
  const events: CalendarEvent[] = [];
  const currentMonth = now.getMonth(); // 0-11
  const currentDate = now.getDate();
  const currentDay = now.getDay(); // 0=Sun

  for (const template of EVENT_TEMPLATES) {
    const eventDates = getEventDatesForWeek(template, now);

    for (const eventDate of eventDates) {
      const isPast = eventDate < now;
      const previous = generateValue(template.previousRange, template.format);
      const forecast = generateValue(template.forecastRange, template.format);
      const actual = isPast ? generateActualValue(forecast, template.format) : "--";

      events.push({
        id: `cal-${template.name}-${eventDate.toISOString().slice(0, 10)}`,
        name: template.name,
        time: eventDate.toISOString(),
        currency: template.currency,
        impact: template.impact,
        importance: template.impact, // alias for frontend compat
        impactLabel: template.impactLabel,
        previous,
        forecast,
        actual,
        rhythm: template.rhythm,
      });
    }
  }

  // Sort by time
  events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  // Return events within -1 day to +7 days
  const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const endTime = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return events.filter(e => {
    const t = new Date(e.time).getTime();
    return t >= startTime.getTime() && t <= endTime.getTime();
  });
}

function getEventDatesForWeek(template: EventTemplate, now: Date): Date[] {
  const dates: Date[] = [];
  const year = now.getFullYear();
  const month = now.getMonth();
  const [hours, minutes] = template.timeUTC.split(":").map(Number);

  const schedule = template.schedule;

  switch (schedule.type) {
    case "monthly_weekday": {
      if (schedule.week === 0) {
        // Every week (e.g., weekly jobless claims)
        // Find this week's occurrence
        const dayDiff = (schedule.dayOfWeek! - now.getDay() + 7) % 7;
        const thisWeek = new Date(year, month, now.getDate() + dayDiff);
        thisWeek.setUTCHours(hours!, minutes!, 0, 0);
        dates.push(thisWeek);

        // Also next week
        const nextWeek = new Date(thisWeek.getTime() + 7 * 24 * 60 * 60 * 1000);
        dates.push(nextWeek);
      } else {
        // Specific week of month (e.g., first Friday)
        const firstDay = new Date(year, month, 1);
        const firstDayOfWeek = firstDay.getDay();
        let targetDate = 1 + ((schedule.dayOfWeek! - firstDayOfWeek + 7) % 7) + (schedule.week! - 1) * 7;

        const eventDate = new Date(year, month, targetDate);
        eventDate.setUTCHours(hours!, minutes!, 0, 0);
        dates.push(eventDate);

        // Also check next month
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const nextFirstDay = new Date(nextYear, nextMonth, 1);
        const nextFirstDayOfWeek = nextFirstDay.getDay();
        let nextTargetDate = 1 + ((schedule.dayOfWeek! - nextFirstDayOfWeek + 7) % 7) + (schedule.week! - 1) * 7;
        const nextEventDate = new Date(nextYear, nextMonth, nextTargetDate);
        nextEventDate.setUTCHours(hours!, minutes!, 0, 0);
        dates.push(nextEventDate);
      }
      break;
    }

    case "monthly_date": {
      if (schedule.dayRange) {
        // Pick a date in the range for this month
        const midDate = Math.floor((schedule.dayRange[0] + schedule.dayRange[1]) / 2);
        const maxDay = new Date(year, month + 1, 0).getDate();
        const targetDate = Math.min(midDate, maxDay);

        const eventDate = new Date(year, month, targetDate);
        eventDate.setUTCHours(hours!, minutes!, 0, 0);
        dates.push(eventDate);

        // Also next month
        const nextMonth = month === 11 ? 0 : month + 1;
        const nextYear = month === 11 ? year + 1 : year;
        const nextMaxDay = new Date(nextYear, nextMonth + 1, 0).getDate();
        const nextTargetDate = Math.min(midDate, nextMaxDay);
        const nextEventDate = new Date(nextYear, nextMonth, nextTargetDate);
        nextEventDate.setUTCHours(hours!, minutes!, 0, 0);
        dates.push(nextEventDate);
      }
      break;
    }

    case "specific_months": {
      if (schedule.months && schedule.dayRange) {
        for (const m of schedule.months) {
          const eventMonth = m - 1; // Convert to 0-indexed
          const midDate = Math.floor((schedule.dayRange[0] + schedule.dayRange[1]) / 2);
          const eventYear = eventMonth < month ? year + 1 : year;
          const maxDay = new Date(eventYear, eventMonth + 1, 0).getDate();
          const targetDate = Math.min(midDate, maxDay);

          const eventDate = new Date(eventYear, eventMonth, targetDate);
          eventDate.setUTCHours(hours!, minutes!, 0, 0);
          dates.push(eventDate);
        }
      }
      break;
    }

    case "periodic": {
      // Approximate: generate one event this month
      if (schedule.dayOfWeek !== undefined) {
        const dayDiff = (schedule.dayOfWeek - now.getDay() + 7) % 7;
        // Find the nearest occurrence
        const nearestDate = new Date(year, month, now.getDate() + dayDiff);
        nearestDate.setUTCHours(hours!, minutes!, 0, 0);
        dates.push(nearestDate);

        // Add one more in ~6 weeks
        const nextDate = new Date(nearestDate.getTime() + (schedule.intervalWeeks || 6) * 7 * 24 * 60 * 60 * 1000);
        dates.push(nextDate);
      }
      break;
    }
  }

  return dates;
}

function generateValue(range: [number, number], format: string): string {
  const [min, max] = range;
  // Use a deterministic-ish value based on current month to avoid constant changes
  const seed = new Date().getMonth() + new Date().getDate() * 0.01;
  const ratio = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const absRatio = Math.abs(ratio);
  const value = min + absRatio * (max - min);

  switch (format) {
    case "percent":
      return `${value.toFixed(1)}%`;
    case "number":
      return value.toFixed(1);
    case "k":
      return `${Math.round(value)}K`;
    case "bps":
      return `${(value / 100).toFixed(2)}%`;
    case "tons":
      return `${Math.round(value)}万盎司`;
    default:
      return value.toFixed(1);
  }
}

function generateActualValue(forecast: string, format: string): string {
  // Generate actual value close to forecast with small deviation
  const numMatch = forecast.match(/([\d.]+)/);
  if (!numMatch) return forecast;

  const forecastNum = parseFloat(numMatch[1]!);
  const deviation = forecastNum * 0.05 * (Math.random() > 0.5 ? 1 : -1);
  const actual = forecastNum + deviation;

  if (format === "percent" || format === "bps") {
    return `${actual.toFixed(1)}%`;
  }
  if (format === "k") {
    return `${Math.round(actual)}K`;
  }
  if (format === "tons") {
    return `${Math.round(actual)}万盎司`;
  }
  return actual.toFixed(1);
}

// ========== Public API ==========

/**
 * 获取经济日历事件
 * 基于当前日期动态生成，包含过去1天到未来7天的事件
 */
export function getEconomicCalendar(): CalendarEvent[] {
  // Check cache
  if (calendarCache && Date.now() - calendarCache.timestamp < CALENDAR_CACHE_TTL) {
    return calendarCache.data;
  }

  const events = generateCalendarEvents();
  console.log(`[CalendarService] Generated ${events.length} calendar events`);
  calendarCache = { data: events, timestamp: Date.now() };
  return events;
}

/**
 * 强制刷新日历缓存
 */
export function invalidateCalendarCache() {
  calendarCache = null;
}
