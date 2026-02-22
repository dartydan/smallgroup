import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";
import { getMyGroupMembership, requireSyncedUser } from "@/lib/auth";

export async function DELETE(request: Request) {
  let user;
  try {
    user = await requireSyncedUser(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const membership = await getMyGroupMembership(request);
  if (!membership) {
    return NextResponse.json({ error: "No active group selected." }, { status: 400 });
  }

  if (membership.role === "admin") {
    return NextResponse.json(
      { error: "Leaders can’t leave their group." },
      { status: 400 },
    );
  }

  await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, membership.groupId),
        eq(groupMembers.userId, user.id),
      ),
    );

  return NextResponse.json({
    ok: true,
    groupId: membership.groupId,
  });
}
