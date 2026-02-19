import { NextResponse } from "next/server";
import { getOrSyncUser } from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-error";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sanitizeDisplayName } from "@/lib/display-name";

export async function GET(request: Request) {
  try {
    const user = await getOrSyncUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const membership = await db.query.groupMembers.findFirst({
      where: eq(groupMembers.userId, user.id),
      columns: { role: true },
    });
    return NextResponse.json({
      id: user.id,
      authId: user.authId,
      email: user.email,
      displayName: sanitizeDisplayName(user.displayName),
      birthdayMonth: user.birthdayMonth,
      birthdayDay: user.birthdayDay,
      role: membership?.role ?? "member",
    });
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getOrSyncUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await request.json();
    const { displayName, birthdayMonth, birthdayDay } = body as {
      displayName?: string | null;
      birthdayMonth?: number | null;
      birthdayDay?: number | null;
    };

    if (
      displayName !== undefined &&
      displayName !== null &&
      typeof displayName !== "string"
    ) {
      return NextResponse.json(
        { error: "displayName must be a string or null." },
        { status: 400 }
      );
    }

    const trimmedDisplayNameInput =
      typeof displayName === "string" ? displayName.trim() : null;
    if (
      displayName !== undefined &&
      displayName !== null &&
      trimmedDisplayNameInput &&
      !sanitizeDisplayName(trimmedDisplayNameInput)
    ) {
      return NextResponse.json(
        { error: "Please enter your real name, not an ID." },
        { status: 400 }
      );
    }

    const nextBirthdayMonth = birthdayMonth !== undefined ? birthdayMonth : user.birthdayMonth;
    const nextBirthdayDay = birthdayDay !== undefined ? birthdayDay : user.birthdayDay;
    const hasBirthdayMonth = nextBirthdayMonth !== null && nextBirthdayMonth !== undefined;
    const hasBirthdayDay = nextBirthdayDay !== null && nextBirthdayDay !== undefined;
    const hasBirthdayPart = hasBirthdayMonth || hasBirthdayDay;

    if (hasBirthdayPart && (nextBirthdayMonth == null || nextBirthdayDay == null)) {
      return NextResponse.json(
        { error: "Set both birthday month and day, or clear both." },
        { status: 400 }
      );
    }

    if (nextBirthdayMonth != null && nextBirthdayDay != null) {
      if (
        !Number.isInteger(nextBirthdayMonth) ||
        nextBirthdayMonth < 1 ||
        nextBirthdayMonth > 12 ||
        !Number.isInteger(nextBirthdayDay) ||
        nextBirthdayDay < 1 ||
        nextBirthdayDay > 31
      ) {
        return NextResponse.json(
          { error: "Birthday must be month 1-12 and day 1-31." },
          { status: 400 }
        );
      }
    }

    const nextDisplayName =
      displayName === undefined
        ? user.displayName
        : displayName === null
          ? null
          : sanitizeDisplayName(displayName);

    await db
      .update(users)
      .set({
        displayName: nextDisplayName,
        birthdayMonth: nextBirthdayMonth ?? null,
        birthdayDay: nextBirthdayDay ?? null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (!updated) {
      return NextResponse.json({ error: "Unable to load updated profile." }, { status: 500 });
    }
    return NextResponse.json({
      ...updated,
      displayName: sanitizeDisplayName(updated.displayName),
    });
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
