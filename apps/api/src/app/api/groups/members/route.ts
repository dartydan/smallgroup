import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getOrSyncUser } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";

export async function GET(request: Request) {
  const me = await getOrSyncUser(request);
  if (!me) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const myMembership = await db.query.groupMembers.findFirst({
    where: eq(groupMembers.userId, me.id),
    columns: { groupId: true },
  });
  if (!myMembership) {
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
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, myMembership.groupId));

  return NextResponse.json({
    members: members.map((member) => ({
      ...member,
      displayName: resolveDisplayName({
        displayName: member.displayName,
        email: member.email,
        fallback: "Member",
      }),
    })),
  });
}
