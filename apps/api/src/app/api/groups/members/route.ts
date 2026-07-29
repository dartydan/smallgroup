import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupJoinRequests, groupMembers, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getRequestAuthContext, getMyGroupId, requireAdmin } from "@/lib/auth";
import {
  resolvePersonName,
  type ResolvedPersonName,
} from "@/lib/display-name";
import { repairMissingGroupMemberNames } from "@/lib/member-name-repair";

function resolveMemberNameParts(
  member: {
    displayName: string | null;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  },
): ResolvedPersonName {
  return resolvePersonName({
    ...member,
    fallback: "Member",
  });
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

  if (context.membership?.role === "admin") {
    try {
      const repairedFieldCount = await repairMissingGroupMemberNames(groupId);
      if (repairedFieldCount > 0) {
        console.info("Repaired blank group-member name fields.", {
          repairedFieldCount,
        });
      }
    } catch {
      console.error("Unable to repair blank group-member name fields.");
    }
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

  const resolvedMembers = members.map((member) => {
    const { firstName, lastName, fullName } = resolveMemberNameParts({
      ...member,
    });
    return {
      id: member.id,
      displayName: fullName,
      firstName,
      lastName,
      fullName,
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

  const targetUsers = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      firstName: users.firstName,
      lastName: users.lastName,
      birthdayMonth: users.birthdayMonth,
      birthdayDay: users.birthdayDay,
      isDeveloper: users.isDeveloper,
    })
    .from(users)
    .where(sql`lower(btrim(${users.email})) = ${emailInput}`)
    .limit(2);

  if (targetUsers.length > 1) {
    return NextResponse.json(
      {
        error:
          "Multiple accounts share that email. Reconcile them before adding this member.",
      },
      { status: 409 },
    );
  }

  const [targetUser] = targetUsers;
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
    const { firstName, lastName, fullName } = resolveMemberNameParts(targetUser);
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
        displayName: fullName,
        firstName,
        lastName,
        fullName,
        birthdayMonth: targetUser.birthdayMonth,
        birthdayDay: targetUser.birthdayDay,
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

  const { firstName, lastName, fullName } = resolveMemberNameParts(targetUser);

  return NextResponse.json(
    {
      alreadyMember: false,
      member: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: fullName,
        firstName,
        lastName,
        fullName,
        birthdayMonth: targetUser.birthdayMonth,
        birthdayDay: targetUser.birthdayDay,
        role,
        canEditEventsAnnouncements: false,
        isDeveloper: targetUser.isDeveloper,
      },
    },
    { status: 201 },
  );
}
