import { NextResponse } from "next/server";
import { db } from "@/db";
import { snackSlots, snackSignups, users } from "@/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { getRequestAuthContext } from "@/lib/auth";
import {
  resolveDisplayName,
} from "@/lib/display-name";
import {
  addDaysToDateKey,
  getTodayDateKeyInTimeZone,
  getWeekdayFromDateKey,
  parseDateKeyInput,
} from "@/lib/timezone";

function nextMeetingDates(count: number, fromDateKey: string): string[] {
  const out: string[] = [];
  const daysUntilWednesday = (3 - getWeekdayFromDateKey(fromDateKey) + 7) % 7;
  let dateKey = addDaysToDateKey(fromDateKey, daysUntilWednesday);
  for (let i = 0; i < count; i++) {
    out.push(dateKey);
    dateKey = addDaysToDateKey(dateKey, 7);
  }
  return out;
}

function parseIsoDate(value: string | null): string | null {
  return parseDateKeyInput(value);
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function GET(request: Request) {
  const context = await getRequestAuthContext(request);
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groupId = context.membership?.groupId ?? null;
  if (!groupId) {
    return NextResponse.json({ slots: [], removedSlots: [] });
  }

  const today = getTodayDateKeyInTimeZone();
  const { searchParams } = new URL(request.url);
  const includeRemoved = searchParams.get("includeRemoved") !== "0";
  const startDate = parseIsoDate(searchParams.get("startDate")) ?? today;
  const endDate = parseIsoDate(searchParams.get("endDate")) ?? "9999-12-31";
  const limit = clampInt(searchParams.get("limit"), 8, 1, 104);
  const removedLimit = clampInt(searchParams.get("removedLimit"), 16, 0, 208);
  const hasCustomRange =
    searchParams.get("startDate") != null || searchParams.get("endDate") != null;
  let allSlots = await db
    .select()
    .from(snackSlots)
    .where(eq(snackSlots.groupId, groupId))
    .orderBy(asc(snackSlots.slotDate));

  let activeSlots = allSlots.filter(
    (slot) =>
      !slot.isCancelled &&
      slot.slotDate >= startDate &&
      slot.slotDate <= endDate
  );

  if (!hasCustomRange && activeSlots.length < limit) {
    const existingDates = new Set(allSlots.map((s) => s.slotDate));
    const toCreate = nextMeetingDates(52, today).filter(
      (d) => d >= today && !existingDates.has(d)
    );
    for (const slotDate of toCreate.slice(0, limit - activeSlots.length)) {
      await db.insert(snackSlots).values({ groupId, slotDate });
    }
    allSlots = await db
      .select()
      .from(snackSlots)
      .where(eq(snackSlots.groupId, groupId))
      .orderBy(asc(snackSlots.slotDate));
    activeSlots = allSlots.filter(
      (slot) =>
        !slot.isCancelled &&
        slot.slotDate >= startDate &&
        slot.slotDate <= endDate
    );
  }

  const visibleActiveSlots = activeSlots.slice(0, limit);
  const slotIds = visibleActiveSlots.map((slot) => slot.id);
  const signupRows =
    slotIds.length === 0
      ? []
      : await db
          .select({
            slotId: snackSignups.slotId,
            id: users.id,
            displayName: users.displayName,
            email: users.email,
            createdAt: snackSignups.createdAt,
          })
          .from(snackSignups)
          .innerJoin(users, eq(snackSignups.userId, users.id))
          .where(inArray(snackSignups.slotId, slotIds));

  const signupsBySlotId = new Map<
    string,
    Array<{ id: string; displayName: string; email: string; createdAt: Date }>
  >();
  for (const row of signupRows) {
    const current = signupsBySlotId.get(row.slotId) ?? [];
    current.push({
      id: row.id,
      displayName: resolveDisplayName({
        displayName: row.displayName,
        email: row.email,
        fallback: "Member",
      }),
      email: row.email,
      createdAt: row.createdAt,
    });
    signupsBySlotId.set(row.slotId, current);
  }

  const slotsWithSignups = visibleActiveSlots.map((slot) => ({
    id: slot.id,
    slotDate: slot.slotDate,
    signups: signupsBySlotId.get(slot.id) ?? [],
  }));

  const removedSlots = includeRemoved
    ? allSlots
        .filter(
          (slot) =>
            slot.isCancelled &&
            slot.slotDate >= startDate &&
            slot.slotDate <= endDate
        )
        .map((slot) => ({
          id: slot.id,
          slotDate: slot.slotDate,
          cancellationReason: slot.cancellationReason ?? null,
        }))
        .slice(0, removedLimit)
    : [];

  return NextResponse.json({
    slots: slotsWithSignups,
    removedSlots,
  });
}
