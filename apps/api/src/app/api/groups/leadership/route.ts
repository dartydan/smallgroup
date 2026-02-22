import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers } from "@/db/schema";
import { getMyGroupId, requireAdmin } from "@/lib/auth";

type LeadershipTransition = "member" | "leave";

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

  const payload = (await request.json().catch(() => null)) as {
    nextLeaderUserId?: unknown;
    transition?: unknown;
  } | null;

  const nextLeaderUserId =
    typeof payload?.nextLeaderUserId === "string"
      ? payload.nextLeaderUserId.trim()
      : "";
  const transition: LeadershipTransition | null =
    payload?.transition === "member" || payload?.transition === "leave"
      ? payload.transition
      : null;

  if (!nextLeaderUserId) {
    return NextResponse.json(
      { error: "nextLeaderUserId is required." },
      { status: 400 },
    );
  }

  if (!transition) {
    return NextResponse.json(
      { error: "transition must be either member or leave." },
      { status: 400 },
    );
  }

  if (nextLeaderUserId === currentUser.id) {
    return NextResponse.json(
      { error: "Choose another member as the new leader." },
      { status: 400 },
    );
  }

  const nextLeaderMembership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, nextLeaderUserId),
    ),
    columns: {
      role: true,
    },
  });

  if (!nextLeaderMembership) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  await db.transaction(async (tx) => {
    if (nextLeaderMembership.role !== "admin") {
      await tx
        .update(groupMembers)
        .set({ role: "admin" })
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, nextLeaderUserId),
          ),
        );
    }

    if (transition === "member") {
      await tx
        .update(groupMembers)
        .set({
          role: "member",
          canEditEventsAnnouncements: false,
        })
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            eq(groupMembers.userId, currentUser.id),
          ),
        );
      return;
    }

    await tx
      .delete(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, currentUser.id),
        ),
      );
  });

  return NextResponse.json({
    ok: true,
    nextLeaderUserId,
    transition,
  });
}
