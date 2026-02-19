import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";

const DAY_MS = 24 * 60 * 60 * 1000;

function getUtcDayStartTime(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function getDaysUntilBirthday(month: number | null, day: number | null, now = new Date()): number | null {
  if (month == null || day == null) return null;
  const todayStart = getUtcDayStartTime(now);
  let nextBirthday = Date.UTC(now.getUTCFullYear(), month - 1, day);
  if (nextBirthday < todayStart) {
    nextBirthday = Date.UTC(now.getUTCFullYear() + 1, month - 1, day);
  }
  return Math.floor((nextBirthday - todayStart) / DAY_MS);
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
  const within = Math.min(90, Math.max(1, parseInt(searchParams.get("within") ?? "30", 10) || 30));

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
      const daysUntil = getDaysUntilBirthday(m.birthdayMonth, m.birthdayDay);
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
    .filter((m) => m.daysUntil != null && m.daysUntil >= 0 && m.daysUntil <= within)
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
