import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";
import { getMyGroupId, requireAdmin } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const { id: targetUserId } = await params;
  if (!targetUserId) {
    return NextResponse.json({ error: "Member ID is required" }, { status: 400 });
  }

  if (targetUserId === currentUser.id) {
    return NextResponse.json(
      { error: "Leaders can’t remove themselves." },
      { status: 400 },
    );
  }

  const targetMembership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, targetUserId),
    ),
  });
  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  await db
    .delete(groupMembers)
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        eq(groupMembers.userId, targetUserId),
      ),
    );

  return NextResponse.json({ ok: true });
}
