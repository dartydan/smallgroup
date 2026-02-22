import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupJoinRequests, groupMembers, groups } from "@/db/schema";
import {
  getMyGroupMembership,
  getOrSyncUser,
  requireSyncedUser,
  getUserGroupMemberships,
  requireAdmin,
} from "@/lib/auth";

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [membershipRows, requestRows, groupRows] = await Promise.all([
    getUserGroupMemberships(user.id),
    db
      .select({
        groupId: groupJoinRequests.groupId,
        status: groupJoinRequests.status,
      })
      .from(groupJoinRequests)
      .where(eq(groupJoinRequests.userId, user.id)),
    db
      .select({
        id: groups.id,
        name: groups.name,
        createdAt: groups.createdAt,
        memberCount: sql<number>`cast(count(${groupMembers.id}) as integer)`,
      })
      .from(groups)
      .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .groupBy(groups.id)
      .orderBy(asc(groups.name)),
  ]);

  const roleByGroupId = new Map(
    membershipRows.map((membership) => [membership.groupId, membership.role]),
  );
  const requestStatusByGroupId = new Map(
    requestRows.map((request) => [request.groupId, request.status]),
  );

  return NextResponse.json({
    groups: groupRows.map((group) => {
      const myRole = roleByGroupId.get(group.id) ?? null;
      const requestStatus = requestStatusByGroupId.get(group.id) ?? null;
      return {
        id: group.id,
        name: group.name,
        createdAt: group.createdAt,
        memberCount: group.memberCount,
        myRole,
        requestStatus,
        canRequest: myRole === null && requestStatus !== "pending",
      };
    }),
  });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireSyncedUser(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: "Group name must be between 2 and 80 characters." },
      { status: 400 },
    );
  }

  const createdGroup = await db.transaction(async (tx) => {
    const [insertedGroup] = await tx
      .insert(groups)
      .values({ name })
      .returning({
        id: groups.id,
        name: groups.name,
      });

    if (!insertedGroup) return null;

    await tx.insert(groupMembers).values({
      groupId: insertedGroup.id,
      userId: user.id,
      role: "admin",
    });

    return insertedGroup;
  });

  if (!createdGroup) {
    return NextResponse.json({ error: "Unable to create group." }, { status: 500 });
  }

  return NextResponse.json(
    {
      group: {
        id: createdGroup.id,
        name: createdGroup.name,
        role: "admin",
      },
    },
    { status: 201 },
  );
}

export async function PATCH(request: Request) {
  try {
    await requireAdmin(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const membership = await getMyGroupMembership(request);
  if (!membership) {
    return NextResponse.json({ error: "No active group selected." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    return NextResponse.json(
      { error: "Group name must be between 2 and 80 characters." },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(groups)
    .set({ name })
    .where(eq(groups.id, membership.groupId))
    .returning({
      id: groups.id,
      name: groups.name,
    });

  if (!updated) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  return NextResponse.json({ group: updated });
}
