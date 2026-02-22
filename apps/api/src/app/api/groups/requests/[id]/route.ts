import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { groupJoinRequests, groupMembers } from "@/db/schema";
import { getMyGroupMembership, requireAdmin } from "@/lib/auth";

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

  const membership = await getMyGroupMembership(request);
  if (!membership) {
    return NextResponse.json({ error: "No active group selected." }, { status: 400 });
  }

  const { id: requestId } = await params;
  if (!requestId) {
    return NextResponse.json({ error: "Request ID is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
  } | null;
  const action = typeof body?.action === "string" ? body.action.trim() : "";
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "action must be either approve or reject." },
      { status: 400 },
    );
  }

  const joinRequest = await db.query.groupJoinRequests.findFirst({
    where: and(
      eq(groupJoinRequests.id, requestId),
      eq(groupJoinRequests.groupId, membership.groupId),
    ),
    columns: {
      id: true,
      userId: true,
      status: true,
    },
  });

  if (!joinRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (joinRequest.status !== "pending") {
    return NextResponse.json(
      { error: "Request has already been reviewed." },
      { status: 400 },
    );
  }

  if (action === "approve") {
    const existingMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.groupId, membership.groupId),
        eq(groupMembers.userId, joinRequest.userId),
      ),
      columns: {
        id: true,
      },
    });

    if (!existingMembership) {
      await db.insert(groupMembers).values({
        groupId: membership.groupId,
        userId: joinRequest.userId,
        role: "member",
        canEditEventsAnnouncements: false,
      });
    }
  }

  const [updated] = await db
    .update(groupJoinRequests)
    .set({
      status: action === "approve" ? "approved" : "rejected",
      reviewedByUserId: currentUser.id,
      updatedAt: new Date(),
    })
    .where(eq(groupJoinRequests.id, joinRequest.id))
    .returning({
      id: groupJoinRequests.id,
      status: groupJoinRequests.status,
    });

  return NextResponse.json({
    ok: true,
    request: updated ?? null,
  });
}
