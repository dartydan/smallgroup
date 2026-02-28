import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { weeklyCheckIns, users } from "@/db/schema";
import { getApiErrorMessage } from "@/lib/api-error";
import { getRequestAuthContext } from "@/lib/auth";
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

export async function GET(request: Request) {
  try {
    const context = await getRequestAuthContext(request);
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, membership } = context;
    if (!membership) {
      return NextResponse.json({ isLeader: false, items: [] });
    }

    const isLeader = membership.role === "admin";
    const rows = await db
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
      .orderBy(desc(weeklyCheckIns.createdAt));

    return NextResponse.json({
      isLeader,
      items: rows.map((row) => ({
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
      })),
    });
  } catch (error) {
    const message = getApiErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await getRequestAuthContext(request);
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, membership } = context;
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

    const [created] = await db
      .insert(weeklyCheckIns)
      .values({
        groupId: membership.groupId,
        userId: user.id,
        status,
        notes,
      })
      .returning();

    return NextResponse.json(created);
  } catch (error) {
    const message = getApiErrorMessage(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
