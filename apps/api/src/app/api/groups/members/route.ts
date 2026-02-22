import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupJoinRequests, groupMembers, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getMyGroupId, getOrSyncUser, requireAdmin } from "@/lib/auth";
import { formatNameFromEmail, sanitizeDisplayName } from "@/lib/display-name";
import { clerkClient } from "@clerk/nextjs/server";

function toNameParts(displayName: string): { firstName: string; lastName: string } {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts[0] ?? "Member",
    lastName: nameParts.slice(1).join(" "),
  };
}

function hasMultipleNameParts(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.trim().split(/\s+/).filter(Boolean).length > 1;
}

function getFullNameFromClerkProfile(profile: {
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}): string | null {
  const fullName = [profile.firstName, profile.lastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .trim();
  const safeFullName = sanitizeDisplayName(fullName);
  if (safeFullName) return safeFullName;

  const safeFirstName = sanitizeDisplayName(profile.firstName);
  if (safeFirstName) return safeFirstName;

  const safeLastName = sanitizeDisplayName(profile.lastName);
  if (safeLastName) return safeLastName;

  const safeUsername = sanitizeDisplayName(profile.username);
  if (safeUsername) return safeUsername;

  return null;
}

async function getNameFromClerkByAuthId(
  authId: string | null | undefined,
  cache: Map<string, string | null>,
): Promise<string | null> {
  if (!authId) return null;
  if (cache.has(authId)) return cache.get(authId) ?? null;

  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(authId);
    const fullName = getFullNameFromClerkProfile({
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      username: clerkUser.username,
    });
    cache.set(authId, fullName);
    return fullName;
  } catch {
    cache.set(authId, null);
    return null;
  }
}

async function resolveMemberNameParts(
  member: {
    displayName: string | null;
    email: string;
    authId?: string | null;
  },
  cache: Map<string, string | null>,
): Promise<{ displayName: string; firstName: string; lastName: string }> {
  const safeStoredDisplayName = sanitizeDisplayName(member.displayName);
  const needsClerkLookup = !hasMultipleNameParts(safeStoredDisplayName);
  const clerkDisplayName =
    needsClerkLookup && member.authId
      ? await getNameFromClerkByAuthId(member.authId, cache)
      : null;
  const resolvedDisplayName =
    clerkDisplayName ??
    safeStoredDisplayName ??
    formatNameFromEmail(member.email, "Member");
  const { firstName, lastName } = toNameParts(resolvedDisplayName);

  return {
    displayName: resolvedDisplayName,
    firstName,
    lastName,
  };
}

export async function GET(request: Request) {
  const me = await getOrSyncUser(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ members: [] });
  }

  const members = await db
    .select({
      id: users.id,
      authId: users.authId,
      displayName: users.displayName,
      email: users.email,
      birthdayMonth: users.birthdayMonth,
      birthdayDay: users.birthdayDay,
      role: groupMembers.role,
      canEditEventsAnnouncements: groupMembers.canEditEventsAnnouncements,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const clerkNameCache = new Map<string, string | null>();
  const resolvedMembers = await Promise.all(
    members.map(async ({ authId, ...member }) => ({
      ...member,
      ...(await resolveMemberNameParts({ ...member, authId }, clerkNameCache)),
    })),
  );

  return NextResponse.json({
    members: resolvedMembers,
  });
}

export async function POST(request: Request) {
  let currentUser;
  try {
    currentUser = await requireAdmin(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
  } | null;
  const emailInput =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!emailInput || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const [targetUser] = await db
    .select({
      id: users.id,
      authId: users.authId,
      email: users.email,
      displayName: users.displayName,
    })
    .from(users)
    .where(sql`lower(${users.email}) = ${emailInput}`)
    .limit(1);

  if (!targetUser) {
    return NextResponse.json(
      {
        error:
          "That email has not signed in yet. Ask them to create an account first.",
      },
      { status: 404 },
    );
  }

  const existingMembership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, targetUser.id),
    ),
    columns: {
      role: true,
      canEditEventsAnnouncements: true,
    },
  });

  if (existingMembership) {
    const { displayName, firstName, lastName } = await resolveMemberNameParts(
      targetUser,
      new Map<string, string | null>(),
    );
    await db
      .update(groupJoinRequests)
      .set({
        status: "approved",
        reviewedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(groupJoinRequests.groupId, groupId),
          eq(groupJoinRequests.userId, targetUser.id),
        ),
      );

    return NextResponse.json({
      alreadyMember: true,
      member: {
        id: targetUser.id,
        email: targetUser.email,
        displayName,
        firstName,
        lastName,
        role: existingMembership.role,
        canEditEventsAnnouncements: existingMembership.canEditEventsAnnouncements,
      },
    });
  }

  const role: "admin" | "member" =
    targetUser.id === currentUser.id ? "admin" : "member";
  await db.insert(groupMembers).values({
    groupId,
    userId: targetUser.id,
    role,
    canEditEventsAnnouncements: false,
  });

  await db
    .update(groupJoinRequests)
    .set({
      status: "approved",
      reviewedByUserId: currentUser.id,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(groupJoinRequests.groupId, groupId),
        eq(groupJoinRequests.userId, targetUser.id),
      ),
    );

  const { displayName, firstName, lastName } = await resolveMemberNameParts(
    targetUser,
    new Map<string, string | null>(),
  );

  return NextResponse.json(
    {
      alreadyMember: false,
      member: {
        id: targetUser.id,
        email: targetUser.email,
        displayName,
        firstName,
        lastName,
        role,
        canEditEventsAnnouncements: false,
      },
    },
    { status: 201 },
  );
}
