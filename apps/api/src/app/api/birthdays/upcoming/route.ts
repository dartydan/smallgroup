import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";
import {
  buildDateKey,
  dayDiffFromDateKeys,
  getMonthYearInTimeZone,
  getTodayDateKeyInTimeZone,
} from "@/lib/timezone";

function getBirthdayDayOffset(
  month: number | null,
  day: number | null,
  pastWindow: number,
  now = new Date(),
): number | null {
  if (month == null || day == null) return null;
  const todayDateKey = getTodayDateKeyInTimeZone(now);
  const current = getMonthYearInTimeZone(now);
  const thisYearBirthdayDateKey = buildDateKey(current.year, month, day);
  if (!thisYearBirthdayDateKey) return null;

  const thisYearOffset = dayDiffFromDateKeys(todayDateKey, thisYearBirthdayDateKey);
  if (thisYearOffset >= 0) {
    return thisYearOffset;
  }

  const daysAgo = Math.abs(thisYearOffset);
  if (daysAgo <= pastWindow) {
    return -daysAgo;
  }

  const nextYearBirthdayDateKey = buildDateKey(current.year + 1, month, day);
  if (!nextYearBirthdayDateKey) return null;
  return dayDiffFromDateKeys(todayDateKey, nextYearBirthdayDateKey);
}

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ birthdays: [] });
  }
  const { searchParams } = new URL(request.url);
  const within = Math.min(
    90,
    Math.max(1, parseInt(searchParams.get("within") ?? "30", 10) || 30),
  );
  const past = Math.min(
    30,
    Math.max(0, parseInt(searchParams.get("past") ?? "0", 10) || 0),
  );

  const members = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      birthdayMonth: users.birthdayMonth,
      birthdayDay: users.birthdayDay,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const birthdays = members
    .map((m) => {
      const daysUntil = getBirthdayDayOffset(
        m.birthdayMonth,
        m.birthdayDay,
        past,
      );
      return {
        id: m.id,
        displayName: resolveDisplayName({
          displayName: m.displayName,
          email: m.email,
          fallback: "A group member",
        }),
        birthdayMonth: m.birthdayMonth,
        birthdayDay: m.birthdayDay,
        daysUntil,
      };
    })
    .filter((m) => m.daysUntil != null && m.daysUntil >= -past && m.daysUntil <= within)
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0))
    .map((m) => ({
      id: m.id,
      displayName: m.displayName,
      birthdayMonth: m.birthdayMonth,
      birthdayDay: m.birthdayDay,
      daysUntil: m.daysUntil ?? 0,
    }));

  return NextResponse.json({ birthdays });
}
