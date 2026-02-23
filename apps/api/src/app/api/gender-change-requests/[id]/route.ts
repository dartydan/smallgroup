import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { genderChangeRequests, users } from "@/db/schema";
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
    return NextResponse.json(
      { error: "No active group selected." },
      { status: 400 },
    );
  }

  const { id: requestId } = await params;
  if (!requestId) {
    return NextResponse.json(
      { error: "Request ID is required." },
      { status: 400 },
    );
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

  const pendingRequest = await db.query.genderChangeRequests.findFirst({
    where: and(
      eq(genderChangeRequests.id, requestId),
      eq(genderChangeRequests.groupId, membership.groupId),
    ),
    columns: {
      id: true,
      userId: true,
      status: true,
      requestedGender: true,
    },
  });

  if (!pendingRequest) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (pendingRequest.status !== "pending") {
    return NextResponse.json(
      { error: "Request has already been reviewed." },
      { status: 400 },
    );
  }

  const updated = await db.transaction(async (tx) => {
    if (action === "approve") {
      await tx
        .update(users)
        .set({
          gender: pendingRequest.requestedGender,
          updatedAt: new Date(),
        })
        .where(eq(users.id, pendingRequest.userId));
    }

    const [requestRow] = await tx
      .update(genderChangeRequests)
      .set({
        status: action === "approve" ? "approved" : "rejected",
        reviewedByUserId: currentUser.id,
        updatedAt: new Date(),
      })
      .where(eq(genderChangeRequests.id, pendingRequest.id))
      .returning({
        id: genderChangeRequests.id,
        userId: genderChangeRequests.userId,
        currentGender: genderChangeRequests.currentGender,
        requestedGender: genderChangeRequests.requestedGender,
        status: genderChangeRequests.status,
        createdAt: genderChangeRequests.createdAt,
        updatedAt: genderChangeRequests.updatedAt,
      });

    return requestRow ?? null;
  });

  return NextResponse.json({
    ok: true,
    request: updated,
  });
}
