import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupJoinRequests, groupMembers, groups, users } from "@/db/schema";
import { getRequestAuthContext, getOrSyncUser } from "@/lib/auth";
import { formatNameFromEmail, sanitizeDisplayName } from "@/lib/display-name";

export async function GET(request: Request) {
  const context = await getRequestAuthContext(request);
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (context.membership?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const groupId = context.membership.groupId;
  if (!groupId) {
    return NextResponse.json({ error: "No active group selected." }, { status: 400 });
  }

  const pendingRequests = await db
    .select({
      id: groupJoinRequests.id,
      userId: users.id,
      displayName: users.displayName,
      email: users.email,
      createdAt: groupJoinRequests.createdAt,
    })
    .from(groupJoinRequests)
    .innerJoin(users, eq(groupJoinRequests.userId, users.id))
    .where(
      and(
        eq(groupJoinRequests.groupId, groupId),
        eq(groupJoinRequests.status, "pending"),
      ),
    )
    .orderBy(desc(groupJoinRequests.createdAt));

  const requests = pendingRequests
    .filter((item) => item.userId !== context.user.id)
    .map((item) => ({
      id: item.id,
      userId: item.userId,
      email: item.email,
      displayName:
        sanitizeDisplayName(item.displayName) ??
        formatNameFromEmail(item.email, "Member"),
      createdAt: item.createdAt,
    }));

  return NextResponse.json({
    requests,
  });
}

export async function POST(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    groupId?: unknown;
  } | null;
  const groupId = typeof body?.groupId === "string" ? body.groupId.trim() : "";
  if (!groupId) {
    return NextResponse.json({ error: "groupId is required." }, { status: 400 });
  }

  const targetGroup = await db.query.groups.findFirst({
    where: eq(groups.id, groupId),
    columns: {
      id: true,
      name: true,
    },
  });
  if (!targetGroup) {
    return NextResponse.json({ error: "Group not found." }, { status: 404 });
  }

  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.groupId, groupId),
      eq(groupMembers.userId, user.id),
    ),
    columns: {
      id: true,
      role: true,
    },
  });
  if (membership) {
    return NextResponse.json({
      alreadyMember: true,
      requestStatus: "approved",
      group: targetGroup,
    });
  }

  const existing = await db.query.groupJoinRequests.findFirst({
    where: and(
      eq(groupJoinRequests.groupId, groupId),
      eq(groupJoinRequests.userId, user.id),
    ),
    columns: {
      id: true,
      status: true,
    },
  });

  if (existing?.status === "pending") {
    return NextResponse.json({
      alreadyRequested: true,
      requestStatus: "pending",
      group: targetGroup,
    });
  }

  if (existing) {
    const [updated] = await db
      .update(groupJoinRequests)
      .set({
        status: "pending",
        reviewedByUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(groupJoinRequests.id, existing.id))
      .returning({
        id: groupJoinRequests.id,
        status: groupJoinRequests.status,
      });

    return NextResponse.json({
      alreadyRequested: false,
      requestStatus: updated?.status ?? "pending",
      group: targetGroup,
    });
  }

  const [created] = await db
    .insert(groupJoinRequests)
    .values({
      groupId,
      userId: user.id,
      status: "pending",
    })
    .returning({
      id: groupJoinRequests.id,
      status: groupJoinRequests.status,
    });

  return NextResponse.json(
    {
      alreadyRequested: false,
      requestStatus: created?.status ?? "pending",
      group: targetGroup,
    },
    { status: 201 },
  );
}
