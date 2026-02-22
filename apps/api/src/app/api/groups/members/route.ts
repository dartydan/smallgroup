import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupJoinRequests, groupMembers, users } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getMyGroupId, getOrSyncUser, requireAdmin } from "@/lib/auth";
import { formatNameFromEmail, sanitizeDisplayName } from "@/lib/display-name";

function toNameParts(displayName: string): { firstName: string; lastName: string } {
  const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: nameParts[0] ?? "Member",
    lastName: nameParts.slice(1).join(" "),
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

  return NextResponse.json({
    members: members.map((member) => {
      const resolvedDisplayName =
        sanitizeDisplayName(member.displayName) ??
        formatNameFromEmail(member.email, "Member");
      const { firstName, lastName } = toNameParts(resolvedDisplayName);
      return {
        ...member,
        displayName: resolvedDisplayName,
        firstName,
        lastName,
      };
    }),
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
    const resolvedDisplayName =
      sanitizeDisplayName(targetUser.displayName) ??
      formatNameFromEmail(targetUser.email, "Member");
    const { firstName, lastName } = toNameParts(resolvedDisplayName);
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
        displayName: resolvedDisplayName,
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

  const resolvedDisplayName =
    sanitizeDisplayName(targetUser.displayName) ??
    formatNameFromEmail(targetUser.email, "Member");
  const { firstName, lastName } = toNameParts(resolvedDisplayName);

  return NextResponse.json(
    {
      alreadyMember: false,
      member: {
        id: targetUser.id,
        email: targetUser.email,
        displayName: resolvedDisplayName,
        firstName,
        lastName,
        role,
        canEditEventsAnnouncements: false,
      },
    },
    { status: 201 },
  );
}
