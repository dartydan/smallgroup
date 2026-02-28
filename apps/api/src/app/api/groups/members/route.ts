import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupJoinRequests, groupMembers, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getRequestAuthContext, getMyGroupId, requireAdmin } from "@/lib/auth";
import { formatNameFromEmail, sanitizeDisplayName } from "@/lib/display-name";
import { getClerkNamePartsByAuthIds } from "@/lib/clerk-name-parts";

function resolveMemberNameParts(
  member: {
    authId: string;
    displayName: string | null;
    email: string;
  },
  clerkNamePartsByAuthId: Map<string, { firstName: string; lastName: string }>,
): { displayName: string; firstName: string; lastName: string } {
  const resolvedDisplayName =
    sanitizeDisplayName(member.displayName) ??
    formatNameFromEmail(member.email, "Member");
  const nameParts = clerkNamePartsByAuthId.get(member.authId);

  return {
    displayName: resolvedDisplayName,
    firstName: nameParts?.firstName ?? "",
    lastName: nameParts?.lastName ?? "",
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
      authId: users.authId,
      displayName: users.displayName,
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

  const clerkNamePartsByAuthId = await getClerkNamePartsByAuthIds(
    members.map((member) => member.authId),
  );

  const resolvedMembers = members.map((member) => {
    const { displayName, firstName, lastName } = resolveMemberNameParts(
      member,
      clerkNamePartsByAuthId,
    );
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
      authId: users.authId,
      email: users.email,
      displayName: users.displayName,
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

  const clerkNamePartsByAuthId = await getClerkNamePartsByAuthIds([targetUser.authId]);

  if (existingMembership) {
    const { displayName, firstName, lastName } = resolveMemberNameParts(
      targetUser,
      clerkNamePartsByAuthId,
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

  const { displayName, firstName, lastName } = resolveMemberNameParts(
    targetUser,
    clerkNamePartsByAuthId,
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
        isDeveloper: targetUser.isDeveloper,
      },
    },
    { status: 201 },
  );
}
