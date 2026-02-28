import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupJoinRequests, groupMembers, users } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getRequestAuthContext, getMyGroupId, requireAdmin } from "@/lib/auth";
import { formatNameFromEmail, sanitizeDisplayName } from "@/lib/display-name";

type NameProfile = {
  displayName: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function getNameCompletenessScore(name: NameProfile) {
  let score = 0;
  if (name.firstName?.trim()) score += 2;
  if (name.lastName?.trim()) score += 2;
  return score;
}

function pickPreferredNameProfile(primary: NameProfile, alternate?: NameProfile | null): NameProfile {
  if (!alternate) return primary;
  return getNameCompletenessScore(alternate) > getNameCompletenessScore(primary)
    ? alternate
    : primary;
}

function resolveMemberNameParts(
  member: {
    displayName: string | null;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  },
): { displayName: string; firstName: string; lastName: string } {
  const resolvedDisplayName =
    sanitizeDisplayName(member.displayName) ??
    formatNameFromEmail(member.email, "Member");

  return {
    displayName: resolvedDisplayName,
    firstName: member.firstName?.trim() || "",
    lastName: member.lastName?.trim() || "",
  };
}

export async function GET(request: Request) {
  const context = await getRequestAuthContext(request);
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groupId = context.membership?.groupId ?? null;
  if (!groupId) {
    return NextResponse.json({ members: [] });
  }

  const members = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      birthdayMonth: users.birthdayMonth,
      birthdayDay: users.birthdayDay,
      role: groupMembers.role,
      canEditEventsAnnouncements: groupMembers.canEditEventsAnnouncements,
      isDeveloper: users.isDeveloper,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, groupId));

  const memberEmails = Array.from(
    new Set(members.map((member) => member.email.trim().toLowerCase()).filter(Boolean)),
  );
  const relatedUsersByEmail =
    memberEmails.length === 0
      ? []
      : await db
          .select({
            email: users.email,
            displayName: users.displayName,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(inArray(sql`lower(${users.email})`, memberEmails));
  const bestNameByEmail = new Map<string, NameProfile>();
  for (const relatedUser of relatedUsersByEmail) {
    const key = relatedUser.email.trim().toLowerCase();
    const currentBest = bestNameByEmail.get(key);
    if (!currentBest) {
      bestNameByEmail.set(key, relatedUser);
      continue;
    }
    if (getNameCompletenessScore(relatedUser) > getNameCompletenessScore(currentBest)) {
      bestNameByEmail.set(key, relatedUser);
    }
  }

  const resolvedMembers = members.map((member) => {
    const emailKey = member.email.trim().toLowerCase();
    const bestName = bestNameByEmail.get(emailKey);
    const preferredName = pickPreferredNameProfile(
      {
        displayName: member.displayName,
        firstName: member.firstName,
        lastName: member.lastName,
      },
      bestName,
    );
    const { displayName, firstName, lastName } = resolveMemberNameParts({
      ...member,
      displayName: preferredName.displayName,
      firstName: preferredName.firstName ?? null,
      lastName: preferredName.lastName ?? null,
    });
    return {
      id: member.id,
      displayName,
      firstName,
      lastName,
      email: member.email,
      birthdayMonth: member.birthdayMonth,
      birthdayDay: member.birthdayDay,
      role: member.role,
      canEditEventsAnnouncements: member.canEditEventsAnnouncements,
      isDeveloper: member.isDeveloper,
    };
  });

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
      email: users.email,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      isDeveloper: users.isDeveloper,
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
    const { displayName, firstName, lastName } = resolveMemberNameParts(targetUser);
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
        isDeveloper: targetUser.isDeveloper,
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

  const { displayName, firstName, lastName } = resolveMemberNameParts(targetUser);

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
        isDeveloper: targetUser.isDeveloper,
      },
    },
    { status: 201 },
  );
}
