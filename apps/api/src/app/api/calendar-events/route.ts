import { NextResponse } from "next/server";
import { getCalendarEventsWindow } from "@/lib/calendar-events";
import { parseDateKeyInput } from "@/lib/timezone";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDateParam = parseDateKeyInput(searchParams.get("startDate"));
  const endDateParam = parseDateKeyInput(searchParams.get("endDate"));

  try {
    const { items } = await getCalendarEventsWindow({
      startDateKey: startDateParam ?? undefined,
      endDateKey: endDateParam ?? undefined,
    });
    return NextResponse.json({ items });
  } catch (error) {
    console.error("calendar-events route error", error);
    return NextResponse.json({ items: [] });
  }
}
