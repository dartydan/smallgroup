import { NextResponse } from "next/server";
import ical, {
  type EventInstance,
  type ParameterValue,
  type VEvent,
} from "node-ical";

const WINDOW_PAST_DAYS = 0;
const WINDOW_FUTURE_DAYS = 14;
const DEFAULT_CALENDAR_ID =
  "oakschurch.org_fuaufb5j000u9ib6as6d6smt0c@group.calendar.google.com";

type CalendarEventItem = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  location: string | null;
  description: string | null;
  daysOffset: number;
};

function dayStart(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(date: Date, days: number): Date {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

function dayDiff(from: Date, to: Date): number {
  const fromStart = dayStart(from).getTime();
  const toStart = dayStart(to).getTime();
  return Math.round((toStart - fromStart) / (24 * 60 * 60 * 1000));
}

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

function parseIsoDateInput(value: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export async function GET(request: Request) {
  const calendarId = getCalendarId();
  const icsUrl = buildIcsUrl(calendarId);

  const now = new Date();
  const { searchParams } = new URL(request.url);
  const startDateParam = parseIsoDateInput(searchParams.get("startDate"));
  const endDateParam = parseIsoDateInput(searchParams.get("endDate"));

  const rangeStart = dayStart(startDateParam ?? addDays(now, -WINDOW_PAST_DAYS));
  const rangeEndInclusive = dayStart(endDateParam ?? addDays(now, WINDOW_FUTURE_DAYS));
  rangeEndInclusive.setHours(23, 59, 59, 999);

  if (rangeStart.getTime() > rangeEndInclusive.getTime()) {
    return NextResponse.json({ items: [] });
  }

  try {
    const response = await fetch(icsUrl, {
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ items: [] });
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
            from: rangeStart,
            to: rangeEndInclusive,
            includeOverrides: true,
            excludeExdates: true,
          })
        : [makeSingleInstance(event)];

      for (const instance of instances) {
        if (isCancelled(instance.event.status)) continue;

        const start = new Date(instance.start);
        const end = instance.end ? new Date(instance.end) : null;
        if (start < rangeStart || start > rangeEndInclusive) {
          continue;
        }
        const daysOffset = dayDiff(now, start);

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

    return NextResponse.json({ items });
  } catch (error) {
    console.error("calendar-events route error", error);
    return NextResponse.json({ items: [] });
  }
}
