import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import {
  getMyGroupMembership,
  getOrSyncUser,
  getUserGroupMemberships,
} from "@/lib/auth";
import { getApiErrorMessage } from "@/lib/api-error";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  getDisplayNameFromClerkProfile,
  resolveDisplayName,
  sanitizeDisplayName,
} from "@/lib/display-name";

type ClerkProfileName = {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
};

async function getClerkProfileName(authId: string): Promise<ClerkProfileName> {
  try {
    const client = await clerkClient();
    const profile = await client.users.getUser(authId);
    return {
      firstName: profile.firstName?.trim() || null,
      lastName: profile.lastName?.trim() || null,
      displayName: getDisplayNameFromClerkProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username,
      }),
    };
  } catch {
    return { firstName: null, lastName: null, displayName: null };
  }
}

export async function GET(request: Request) {
  try {
    const user = await getOrSyncUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const [activeMembership, memberships, clerkProfile] = await Promise.all([
      getMyGroupMembership(request),
      getUserGroupMemberships(user.id),
      getClerkProfileName(user.authId),
    ]);
    const safeStoredDisplayName = sanitizeDisplayName(user.displayName);
    const fallbackDisplayName =
      clerkProfile.displayName ??
      resolveDisplayName({
        displayName: user.displayName,
        email: user.email,
      });

    return NextResponse.json({
      id: user.id,
      authId: user.authId,
      email: user.email,
      displayName: safeStoredDisplayName ?? fallbackDisplayName,
      firstName: clerkProfile.firstName,
      lastName: clerkProfile.lastName,
      gender: user.gender,
      birthdayMonth: user.birthdayMonth,
      birthdayDay: user.birthdayDay,
      role: activeMembership?.role ?? null,
      canEditEventsAnnouncements:
        activeMembership?.canEditEventsAnnouncements ?? false,
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
        : displayName === null || !trimmedDisplayNameInput
          ? null
          : sanitizeDisplayName(trimmedDisplayNameInput);
    const nextGender =
      gender === undefined
        ? user.gender
        : gender === null
          ? null
          : (normalizedGender as "male" | "female");

    await db
      .update(users)
      .set({
        displayName: nextDisplayName,
        gender: nextGender,
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
    const clerkProfile = await getClerkProfileName(updated.authId);
    const safeStoredDisplayName = sanitizeDisplayName(updated.displayName);
    const fallbackDisplayName =
      clerkProfile.displayName ??
      resolveDisplayName({
        displayName: updated.displayName,
        email: updated.email,
      });

    return NextResponse.json({
      ...updated,
      displayName: safeStoredDisplayName ?? fallbackDisplayName,
      firstName: clerkProfile.firstName,
      lastName: clerkProfile.lastName,
    });
  } catch (e) {
    const message = getApiErrorMessage(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
