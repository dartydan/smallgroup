import ical, {
  type EventInstance,
  type ParameterValue,
  type VEvent,
} from "node-ical";
import {
  addDaysToDateKey,
  dayDiffFromDateKeys,
  getDateKeyInTimeZone,
  getTodayDateKeyInTimeZone,
  getUtcMsForDateKey,
} from "@/lib/timezone";

const WINDOW_PAST_DAYS = 0;
const WINDOW_FUTURE_DAYS = 14;
const DEFAULT_CALENDAR_ID =
  "oakschurch.org_fuaufb5j000u9ib6as6d6smt0c@group.calendar.google.com";
const CALENDAR_CACHE_TTL_MS = 30_000;

type CachedCalendarEvents = {
  expiresAt: number;
  items: CalendarEventItem[];
};

const calendarCache = new Map<string, CachedCalendarEvents>();
const inFlightCalendarRequests = new Map<string, Promise<CalendarEventItem[]>>();

export type CalendarEventItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  location: string | null;
  description: string | null;
  daysOffset: number;
};

export type CalendarEventsWindowResult = {
  items: CalendarEventItem[];
  rangeStartDateKey: string;
  rangeEndDateKey: string;
};

function valueToText(value: ParameterValue<string> | undefined): string {
  if (!value) return "";
  return typeof value === "string" ? value : value.val;
}

function getCalendarId(): string {
  return (
    process.env.GOOGLE_EVENTS_CALENDAR_ID?.trim() ??
    process.env.GOOGLE_CALENDAR_ID?.trim() ??
    DEFAULT_CALENDAR_ID
  );
}

function buildIcsUrl(calendarId: string): string {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/full.ics`;
}

function makeSingleInstance(event: VEvent): EventInstance {
  return {
    start: event.start,
    end: event.end ?? event.start,
    summary: event.summary,
    isFullDay: event.datetype === "date",
    isRecurring: false,
    isOverride: false,
    event,
  };
}

function isCancelled(status: string | undefined): boolean {
  return status?.toUpperCase() === "CANCELLED";
}

function cleanupExpiredCache(nowMs: number) {
  for (const [key, value] of calendarCache.entries()) {
    if (value.expiresAt <= nowMs) {
      calendarCache.delete(key);
    }
  }
}

async function fetchCalendarEventsForRange(
  calendarId: string,
  todayDateKey: string,
  rangeStartDateKey: string,
  rangeEndDateKey: string,
): Promise<CalendarEventItem[]> {
  const icsUrl = buildIcsUrl(calendarId);

  const expandFrom = new Date(
    getUtcMsForDateKey(addDaysToDateKey(rangeStartDateKey, -1)),
  );
  const expandTo = new Date(
    getUtcMsForDateKey(addDaysToDateKey(rangeEndDateKey, 1)),
  );
  expandTo.setUTCHours(23, 59, 59, 999);

  const response = await fetch(icsUrl, {
    cache: "no-store",
  });
  if (!response.ok) {
    return [];
  }

  const icsText = await response.text();
  const parsed = ical.sync.parseICS(icsText);
  const events = Object.values(parsed).filter(
    (entry): entry is VEvent => entry?.type === "VEVENT",
  );

  const seen = new Set<string>();
  const items: CalendarEventItem[] = [];

  for (const event of events) {
    if (isCancelled(event.status)) continue;

    const instances = event.rrule
      ? ical.expandRecurringEvent(event, {
          from: expandFrom,
          to: expandTo,
          includeOverrides: true,
          excludeExdates: true,
        })
      : [makeSingleInstance(event)];

    for (const instance of instances) {
      if (isCancelled(instance.event.status)) continue;

      const start = new Date(instance.start);
      const end = instance.end ? new Date(instance.end) : null;
      const startDateKey = getDateKeyInTimeZone(start);
      if (startDateKey < rangeStartDateKey || startDateKey > rangeEndDateKey) {
        continue;
      }
      const daysOffset = dayDiffFromDateKeys(todayDateKey, startDateKey);

      const id = `${instance.event.uid}:${start.toISOString()}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const title =
        valueToText(instance.summary as ParameterValue<string>) ||
        valueToText(event.summary) ||
        "Event";

      const description =
        valueToText(instance.event.description as ParameterValue<string>) || null;
      const location =
        valueToText(instance.event.location as ParameterValue<string>) || null;

      items.push({
        id,
        title,
        startAt: start.toISOString(),
        endAt: end?.toISOString() ?? null,
        isAllDay: instance.isFullDay,
        location,
        description,
        daysOffset,
      });
    }
  }

  items.sort((a, b) => {
    const absDiff = Math.abs(a.daysOffset) - Math.abs(b.daysOffset);
    if (absDiff !== 0) return absDiff;
    if (a.daysOffset !== b.daysOffset) return b.daysOffset - a.daysOffset;
    return a.startAt.localeCompare(b.startAt);
  });

  return items;
}

export async function getCalendarEventsWindow(options: {
  startDateKey?: string;
  endDateKey?: string;
  now?: Date;
} = {}): Promise<CalendarEventsWindowResult> {
  const now = options.now ?? new Date();
  const todayDateKey = getTodayDateKeyInTimeZone(now);
  const rangeStartDateKey =
    options.startDateKey ?? addDaysToDateKey(todayDateKey, -WINDOW_PAST_DAYS);
  const rangeEndDateKey =
    options.endDateKey ?? addDaysToDateKey(todayDateKey, WINDOW_FUTURE_DAYS);

  if (rangeStartDateKey > rangeEndDateKey) {
    return {
      items: [],
      rangeStartDateKey,
      rangeEndDateKey,
    };
  }

  const calendarId = getCalendarId();
  const cacheKey = `${calendarId}|${rangeStartDateKey}|${rangeEndDateKey}`;
  const nowMs = Date.now();

  cleanupExpiredCache(nowMs);
  const cached = calendarCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    return {
      items: cached.items,
      rangeStartDateKey,
      rangeEndDateKey,
    };
  }

  const existingInFlight = inFlightCalendarRequests.get(cacheKey);
  if (existingInFlight) {
    const items = await existingInFlight;
    return {
      items,
      rangeStartDateKey,
      rangeEndDateKey,
    };
  }

  const requestPromise = fetchCalendarEventsForRange(
    calendarId,
    todayDateKey,
    rangeStartDateKey,
    rangeEndDateKey,
  )
    .then((items) => {
      calendarCache.set(cacheKey, {
        expiresAt: Date.now() + CALENDAR_CACHE_TTL_MS,
        items,
      });
      return items;
    })
    .finally(() => {
      inFlightCalendarRequests.delete(cacheKey);
    });

  inFlightCalendarRequests.set(cacheKey, requestPromise);

  const items = await requestPromise;
  return {
    items,
    rangeStartDateKey,
    rangeEndDateKey,
  };
}
