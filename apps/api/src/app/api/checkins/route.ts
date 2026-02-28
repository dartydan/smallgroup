import { NextResponse } from "next/server";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { weeklyCheckIns, users } from "@/db/schema";
import { getApiErrorMessage } from "@/lib/api-error";
import { getMyGroupMembership, requireSyncedUser } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";

type WeeklyCheckInStatus = "great" | "okay" | "struggling";

const CHECK_IN_STATUSES: WeeklyCheckInStatus[] = ["great", "okay", "struggling"];

function parseStatus(value: unknown): WeeklyCheckInStatus | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (CHECK_IN_STATUSES.includes(normalized as WeeklyCheckInStatus)) {
    return normalized as WeeklyCheckInStatus;
  }
  return null;
}

function parseNotes(value: unknown): { valid: boolean; value: string | null } {
  if (value === undefined || value === null) {
    return { valid: true, value: null };
  }
  if (typeof value !== "string") {
    return { valid: false, value: null };
  }
  const trimmed = value.trim();
  return { valid: true, value: trimmed.length > 0 ? trimmed : null };
}

function getUtcMonthRange(now = new Date()): { start: Date; end: Date; key: string } {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  return { start, end, key };
}

function mapCheckInRow(row: {
  id: string;
  userId: string;
  groupId: string;
  status: WeeklyCheckInStatus;
  notes: string | null;
  createdAt: Date;
  userName: string | null;
  userEmail: string | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    groupId: row.groupId,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    userName: resolveDisplayName({
      displayName: row.userName,
      email: row.userEmail,
      fallback: "Member",
    }),
  };
}

export async function GET(request: Request) {
  try {
    let user;
    try {
      user = await requireSyncedUser(request);
    } catch (error) {
      if (error instanceof Response) return error;
      throw error;
    }
    const membership = await getMyGroupMembership(request);
    const monthRange = getUtcMonthRange();

    if (!membership) {
      return NextResponse.json({
        isLeader: false,
        monthKey: monthRange.key,
        currentMonthSubmitted: false,
        myItems: [],
        items: [],
      });
    }

    const isLeader = membership.role === "admin";
    const [rows, myCurrentMonthRows] = await Promise.all([
      db
        .select({
          id: weeklyCheckIns.id,
          userId: weeklyCheckIns.userId,
          groupId: weeklyCheckIns.groupId,
          status: weeklyCheckIns.status,
          notes: weeklyCheckIns.notes,
          createdAt: weeklyCheckIns.createdAt,
          userName: users.displayName,
          userEmail: users.email,
        })
        .from(weeklyCheckIns)
        .leftJoin(users, eq(weeklyCheckIns.userId, users.id))
        .where(
          isLeader
            ? eq(weeklyCheckIns.groupId, membership.groupId)
            : and(
                eq(weeklyCheckIns.groupId, membership.groupId),
                eq(weeklyCheckIns.userId, user.id),
              ),
        )
        .orderBy(desc(weeklyCheckIns.createdAt)),
      db
        .select({ id: weeklyCheckIns.id })
        .from(weeklyCheckIns)
        .where(
          and(
            eq(weeklyCheckIns.groupId, membership.groupId),
            eq(weeklyCheckIns.userId, user.id),
            gte(weeklyCheckIns.createdAt, monthRange.start),
            lt(weeklyCheckIns.createdAt, monthRange.end),
          ),
        )
        .limit(1),
    ]);

    const mapped = rows.map(mapCheckInRow);
    const myItems = mapped.filter((row) => row.userId === user.id);

    return NextResponse.json({
      isLeader,
      monthKey: monthRange.key,
      currentMonthSubmitted: myCurrentMonthRows.length > 0,
      myItems,
      items: isLeader ? mapped : [],
    });
  } catch (error) {
    const message = getApiErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let user;
    try {
      user = await requireSyncedUser(request);
    } catch (error) {
      if (error instanceof Response) return error;
      throw error;
    }
    const membership = await getMyGroupMembership(request);
    if (!membership) {
      return NextResponse.json({ error: "Join a group to submit a check-in." }, { status: 403 });
    }

    const body = (await request.json()) as { status?: unknown; notes?: unknown };
    const status = parseStatus(body.status);
    if (!status) {
      return NextResponse.json(
        {
          error: "status is required and must be one of: great, okay, struggling",
        },
        { status: 400 },
      );
    }

    const parsedNotes = parseNotes(body.notes);
    if (!parsedNotes.valid) {
      return NextResponse.json(
        { error: "notes must be a string." },
        { status: 400 },
      );
    }
    const notes = parsedNotes.value;

    if (notes && notes.length > 2000) {
      return NextResponse.json(
        { error: "notes must be 2000 characters or fewer." },
        { status: 400 },
      );
    }

    const monthRange = getUtcMonthRange();
    const [existingForMonth] = await db
      .select({
        id: weeklyCheckIns.id,
      })
      .from(weeklyCheckIns)
      .where(
        and(
          eq(weeklyCheckIns.groupId, membership.groupId),
          eq(weeklyCheckIns.userId, user.id),
          gte(weeklyCheckIns.createdAt, monthRange.start),
          lt(weeklyCheckIns.createdAt, monthRange.end),
        ),
      )
      .orderBy(desc(weeklyCheckIns.createdAt))
      .limit(1);

    let created;
    if (existingForMonth) {
      const [updated] = await db
        .update(weeklyCheckIns)
        .set({
          status,
          notes,
          createdAt: new Date(),
        })
        .where(eq(weeklyCheckIns.id, existingForMonth.id))
        .returning();
      created = updated;
    } else {
      const [inserted] = await db
        .insert(weeklyCheckIns)
        .values({
          groupId: membership.groupId,
          userId: user.id,
          status,
          notes,
        })
        .returning();
      created = inserted;
    }

    return NextResponse.json(created);
  } catch (error) {
    const message = getApiErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
