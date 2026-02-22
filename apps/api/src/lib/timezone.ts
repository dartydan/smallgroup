export const APP_TIME_ZONE = "America/Indiana/Indianapolis";
export const APP_TIME_ZONE_LABEL = "EST - Indiana";

const DAY_MS = 24 * 60 * 60 * 1000;

type DateParts = {
  year: number;
  month: number;
  day: number;
};

const datePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseDatePartsFromKey(value: string): DateParts | null {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const normalized = buildDateKey(year, month, day);
  if (!normalized || normalized !== value) return null;
  return { year, month, day };
}

export function getDatePartsFromDateKey(dateKey: string): DateParts {
  const parsed = parseDatePartsFromKey(dateKey);
  if (!parsed) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return parsed;
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function buildDateKey(
  year: number,
  month: number,
  day: number,
): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  const test = new Date(Date.UTC(year, month - 1, day));
  if (
    test.getUTCFullYear() !== year ||
    test.getUTCMonth() + 1 !== month ||
    test.getUTCDate() !== day
  ) {
    return null;
  }
  return formatDateKey(year, month, day);
}

export function parseDateKeyInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = parseDatePartsFromKey(normalized);
  if (!parsed) return null;
  return formatDateKey(parsed.year, parsed.month, parsed.day);
}

export function getDatePartsInTimeZone(date: Date): DateParts {
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;

  for (const part of datePartsFormatter.formatToParts(date)) {
    if (part.type === "year") year = Number.parseInt(part.value, 10);
    if (part.type === "month") month = Number.parseInt(part.value, 10);
    if (part.type === "day") day = Number.parseInt(part.value, 10);
  }

  if (year == null || month == null || day == null) {
    throw new Error("Could not resolve timezone date parts.");
  }

  return { year, month, day };
}

export function getDateKeyInTimeZone(date: Date): string {
  const parts = getDatePartsInTimeZone(date);
  return formatDateKey(parts.year, parts.month, parts.day);
}

export function getMonthYearInTimeZone(
  date: Date,
): { month: number; year: number } {
  const parts = getDatePartsInTimeZone(date);
  return { month: parts.month, year: parts.year };
}

export function getTodayDateKeyInTimeZone(now: Date = new Date()): string {
  return getDateKeyInTimeZone(now);
}

export function getUtcMsForDateKey(dateKey: string): number {
  const parsed = parseDatePartsFromKey(dateKey);
  if (!parsed) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return Date.UTC(parsed.year, parsed.month - 1, parsed.day);
}

export function dayDiffFromDateKeys(
  fromDateKey: string,
  toDateKey: string,
): number {
  const from = getUtcMsForDateKey(fromDateKey);
  const to = getUtcMsForDateKey(toDateKey);
  return Math.round((to - from) / DAY_MS);
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const utcMs = getUtcMsForDateKey(dateKey);
  const shifted = new Date(utcMs + days * DAY_MS);
  return formatDateKey(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth() + 1,
    shifted.getUTCDate(),
  );
}

export function getWeekdayFromDateKey(dateKey: string): number {
  return new Date(getUtcMsForDateKey(dateKey)).getUTCDay();
}

export function formatDateInTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: APP_TIME_ZONE,
  }).format(date);
}

export function formatTimeInTimeZone(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return formatDateInTimeZone(date, options);
}
