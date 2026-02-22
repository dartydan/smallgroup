import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
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

export async function PATCH(
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

  const payload = (await request.json().catch(() => null)) as {
    canEditEventsAnnouncements?: unknown;
    role?: unknown;
  } | null;
  const hasPermissionUpdate =
    payload !== null &&
    Object.prototype.hasOwnProperty.call(payload, "canEditEventsAnnouncements");
  const hasRoleUpdate =
    payload !== null && Object.prototype.hasOwnProperty.call(payload, "role");

  if (!hasPermissionUpdate && !hasRoleUpdate) {
    return NextResponse.json(
      { error: "Include role or canEditEventsAnnouncements to update." },
      { status: 400 },
    );
  }

  if (targetUserId === currentUser.id) {
    return NextResponse.json(
      { error: "Leaders can’t change their own role or permissions here." },
      { status: 400 },
    );
  }

  let nextRole: "admin" | "member" | undefined;
  if (hasRoleUpdate) {
    if (payload?.role !== "admin" && payload?.role !== "member") {
      return NextResponse.json(
        { error: "role must be either admin or member." },
        { status: 400 },
      );
    }
    nextRole = payload.role;
  }

  let nextCanEditEventsAnnouncements: boolean | undefined;
  if (hasPermissionUpdate) {
    if (typeof payload?.canEditEventsAnnouncements !== "boolean") {
      return NextResponse.json(
        { error: "canEditEventsAnnouncements must be a boolean." },
        { status: 400 },
      );
    }
    nextCanEditEventsAnnouncements = payload.canEditEventsAnnouncements;
  }

  const targetMembership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, targetUserId),
    ),
    columns: {
      role: true,
      canEditEventsAnnouncements: true,
    },
  });

  if (!targetMembership) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (
    hasPermissionUpdate &&
    targetMembership.role === "admin" &&
    nextRole !== "member"
  ) {
    return NextResponse.json(
      { error: "Leader permissions cannot be changed." },
      { status: 400 },
    );
  }

  if (targetMembership.role === "admin" && nextRole === "member") {
    const [leaderCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(groupMembers)
      .where(
        and(eq(groupMembers.groupId, groupId), eq(groupMembers.role, "admin")),
      );

    if ((leaderCount?.count ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Each group must have at least one leader." },
        { status: 400 },
      );
    }
  }

  const updates: {
    role?: "admin" | "member";
    canEditEventsAnnouncements?: boolean;
  } = {};
  if (nextRole && nextRole !== targetMembership.role) {
    updates.role = nextRole;
  }
  if (hasPermissionUpdate && nextCanEditEventsAnnouncements !== undefined) {
    updates.canEditEventsAnnouncements = nextCanEditEventsAnnouncements;
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(groupMembers)
      .set(updates)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          eq(groupMembers.userId, targetUserId),
        ),
      );
  }

  const resolvedRole = updates.role ?? targetMembership.role;
  const resolvedCanEditEventsAnnouncements =
    updates.canEditEventsAnnouncements ??
    targetMembership.canEditEventsAnnouncements;

  return NextResponse.json({
    ok: true,
    member: {
      userId: targetUserId,
      role: resolvedRole,
      canEditEventsAnnouncements: resolvedCanEditEventsAnnouncements,
    },
  });
}
