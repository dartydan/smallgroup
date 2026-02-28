import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getRequestAuthContext,
  getOrSyncUser,
  isDeveloperUser,
  isLeadDeveloperUser,
} from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-error";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  resolveDisplayName,
  sanitizeDisplayName,
} from "@/lib/display-name";

export async function GET(request: Request) {
  try {
    const context = await getRequestAuthContext(request);
    if (!context) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, membership: activeMembership, memberships } = context;
    const hasAnyAdminMembership = memberships.some(
      (membership) => membership.role === "admin",
    );
    const safeStoredDisplayName = sanitizeDisplayName(user.displayName);

    return NextResponse.json({
      id: user.id,
      authId: user.authId,
      email: user.email,
      displayName:
        safeStoredDisplayName ??
        resolveDisplayName({
          displayName: user.displayName,
          email: user.email,
        }),
      firstName: null,
      lastName: null,
      gender: user.gender,
      birthdayMonth: user.birthdayMonth,
      birthdayDay: user.birthdayDay,
      role: activeMembership?.role ?? null,
      canEditEventsAnnouncements:
        activeMembership?.canEditEventsAnnouncements ?? false,
      isDeveloper: isDeveloperUser(user, hasAnyAdminMembership ? "admin" : null),
      isLeadDeveloper: isLeadDeveloperUser(user),
      activeGroupId: activeMembership?.groupId ?? null,
      groups: memberships.map((membership) => ({
        id: membership.groupId,
        name: membership.groupName,
        role: membership.role,
      })),
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
    const { firstName, lastName, displayName, birthdayMonth, birthdayDay, gender } =
      body as {
        firstName?: string | null;
        lastName?: string | null;
        displayName?: string | null;
        birthdayMonth?: number | null;
        birthdayDay?: number | null;
        gender?: string | null;
      };

    if (
      firstName !== undefined &&
      firstName !== null &&
      typeof firstName !== "string"
    ) {
      return NextResponse.json(
        { error: "firstName must be a string or null." },
        { status: 400 }
      );
    }

    if (
      lastName !== undefined &&
      lastName !== null &&
      typeof lastName !== "string"
    ) {
      return NextResponse.json(
        { error: "lastName must be a string or null." },
        { status: 400 }
      );
    }

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

    if (
      gender !== undefined &&
      gender !== null &&
      typeof gender !== "string"
    ) {
      return NextResponse.json(
        { error: "gender must be a string or null." },
        { status: 400 }
      );
    }

    const normalizedGender =
      typeof gender === "string" ? gender.trim().toLowerCase() : null;
    if (
      gender !== undefined &&
      gender !== null &&
      normalizedGender !== "male" &&
      normalizedGender !== "female"
    ) {
      return NextResponse.json(
        { error: "Gender must be male or female." },
        { status: 400 }
      );
    }

    const lockedGender =
      user.gender === "male" || user.gender === "female" ? user.gender : null;
    if (lockedGender) {
      if (
        gender !== undefined &&
        (gender === null || normalizedGender !== lockedGender)
      ) {
        return NextResponse.json(
          { error: "Gender is locked after setup and cannot be changed." },
          { status: 400 }
        );
      }
    } else if (
      gender === undefined ||
      gender === null ||
      (normalizedGender !== "male" && normalizedGender !== "female")
    ) {
      return NextResponse.json(
        { error: "Choose your gender to finish setup." },
        { status: 400 }
      );
    }

    const trimmedDisplayNameInput =
      typeof displayName === "string" ? displayName.trim() : null;
    const trimmedFirstNameInput =
      typeof firstName === "string" ? firstName.trim() : null;
    const trimmedLastNameInput =
      typeof lastName === "string" ? lastName.trim() : null;

    if (
      firstName !== undefined &&
      firstName !== null &&
      trimmedFirstNameInput &&
      !sanitizeDisplayName(trimmedFirstNameInput)
    ) {
      return NextResponse.json(
        { error: "Please enter a valid first name." },
        { status: 400 }
      );
    }

    if (
      lastName !== undefined &&
      lastName !== null &&
      trimmedLastNameInput &&
      !sanitizeDisplayName(trimmedLastNameInput)
    ) {
      return NextResponse.json(
        { error: "Please enter a valid last name." },
        { status: 400 }
      );
    }

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

    const shouldUpdateClerkName = firstName !== undefined || lastName !== undefined;
    if (shouldUpdateClerkName) {
      const client = await clerkClient();
      await client.users.updateUser(user.authId, {
        firstName:
          firstName === undefined ? undefined : (trimmedFirstNameInput || undefined),
        lastName:
          lastName === undefined ? undefined : (trimmedLastNameInput || undefined),
      });
    }

    const isValidBirthday = (
      month: number | null | undefined,
      day: number | null | undefined,
    ) =>
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      (month as number) >= 1 &&
      (month as number) <= 12 &&
      (day as number) >= 1 &&
      (day as number) <= new Date(Date.UTC(2000, month as number, 0)).getUTCDate();

    const hasLockedBirthday = isValidBirthday(user.birthdayMonth, user.birthdayDay);
    let nextBirthdayMonth: number;
    let nextBirthdayDay: number;

    if (hasLockedBirthday) {
      const requestedBirthdayMonth =
        birthdayMonth === undefined ? user.birthdayMonth : birthdayMonth;
      const requestedBirthdayDay =
        birthdayDay === undefined ? user.birthdayDay : birthdayDay;
      if (
        !isValidBirthday(requestedBirthdayMonth, requestedBirthdayDay) ||
        requestedBirthdayMonth !== user.birthdayMonth ||
        requestedBirthdayDay !== user.birthdayDay
      ) {
        return NextResponse.json(
          { error: "Birthday is locked after setup and cannot be changed." },
          { status: 400 },
        );
      }
      nextBirthdayMonth = user.birthdayMonth as number;
      nextBirthdayDay = user.birthdayDay as number;
    } else {
      if (!isValidBirthday(birthdayMonth, birthdayDay)) {
        return NextResponse.json(
          { error: "Choose your birthday to finish setup." },
          { status: 400 },
        );
      }
      nextBirthdayMonth = birthdayMonth as number;
      nextBirthdayDay = birthdayDay as number;
    }

    const nextDisplayName =
      displayName === undefined
        ? user.displayName
        : displayName === null || !trimmedDisplayNameInput
          ? null
          : sanitizeDisplayName(trimmedDisplayNameInput);
    const nextGender: "male" | "female" = lockedGender
      ? lockedGender
      : (normalizedGender as "male" | "female");

    await db
      .update(users)
      .set({
        displayName: nextDisplayName,
        gender: nextGender,
        birthdayMonth: nextBirthdayMonth,
        birthdayDay: nextBirthdayDay,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
    const updated = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    if (!updated) {
      return NextResponse.json({ error: "Unable to load updated profile." }, { status: 500 });
    }
    const safeStoredDisplayName = sanitizeDisplayName(updated.displayName);

    return NextResponse.json({
      ...updated,
      displayName:
        safeStoredDisplayName ??
        resolveDisplayName({
          displayName: updated.displayName,
          email: updated.email,
        }),
      firstName: null,
      lastName: null,
    });
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
