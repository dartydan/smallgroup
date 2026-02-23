import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { genderChangeRequests, users } from "@/db/schema";
import { getMyGroupMembership, getOrSyncUser } from "@/lib/auth";
import { formatNameFromEmail, sanitizeDisplayName } from "@/lib/display-name";

type GenderValue = "male" | "female";

function toRequestResponse(request: {
  id: string;
  userId: string;
  currentGender: GenderValue;
  requestedGender: GenderValue;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: request.id,
    userId: request.userId,
    currentGender: request.currentGender,
    requestedGender: request.requestedGender,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
  };
}

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMyGroupMembership(request);
  if (!membership) {
    return NextResponse.json({ myPendingRequest: null, pendingRequests: [] });
  }

  const myPendingRequest = await db.query.genderChangeRequests.findFirst({
    where: and(
      eq(genderChangeRequests.groupId, membership.groupId),
      eq(genderChangeRequests.userId, user.id),
      eq(genderChangeRequests.status, "pending"),
    ),
    orderBy: [desc(genderChangeRequests.createdAt)],
    columns: {
      id: true,
      userId: true,
      currentGender: true,
      requestedGender: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (membership.role !== "admin") {
    return NextResponse.json({
      myPendingRequest: myPendingRequest ? toRequestResponse(myPendingRequest) : null,
      pendingRequests: [],
    });
  }

  const rows = await db
    .select({
      id: genderChangeRequests.id,
      userId: genderChangeRequests.userId,
      currentGender: genderChangeRequests.currentGender,
      requestedGender: genderChangeRequests.requestedGender,
      status: genderChangeRequests.status,
      createdAt: genderChangeRequests.createdAt,
      updatedAt: genderChangeRequests.updatedAt,
      displayName: users.displayName,
      email: users.email,
    })
    .from(genderChangeRequests)
    .innerJoin(users, eq(genderChangeRequests.userId, users.id))
    .where(
      and(
        eq(genderChangeRequests.groupId, membership.groupId),
        eq(genderChangeRequests.status, "pending"),
      ),
    )
    .orderBy(desc(genderChangeRequests.createdAt));

  return NextResponse.json({
    myPendingRequest: myPendingRequest ? toRequestResponse(myPendingRequest) : null,
    pendingRequests: rows.map((row) => ({
      ...toRequestResponse(row),
      displayName:
        sanitizeDisplayName(row.displayName) ??
        formatNameFromEmail(row.email, "Member"),
      email: row.email,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await getMyGroupMembership(request);
  if (!membership) {
    return NextResponse.json(
      { error: "No active group selected." },
      { status: 400 },
    );
  }

  const currentGender =
    user.gender === "male" || user.gender === "female" ? user.gender : null;
  if (!currentGender) {
    return NextResponse.json(
      { error: "Set your gender first before requesting a change." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    requestedGender?: unknown;
  } | null;
  const requestedGender =
    typeof body?.requestedGender === "string"
      ? body.requestedGender.trim().toLowerCase()
      : "";

  if (requestedGender !== "male" && requestedGender !== "female") {
    return NextResponse.json(
      { error: "requestedGender must be male or female." },
      { status: 400 },
    );
  }

  if (requestedGender === currentGender) {
    return NextResponse.json(
      { error: "Choose a different gender than your current one." },
      { status: 400 },
    );
  }

  const existingPendingRequest = await db.query.genderChangeRequests.findFirst({
    where: and(
      eq(genderChangeRequests.groupId, membership.groupId),
      eq(genderChangeRequests.userId, user.id),
      eq(genderChangeRequests.status, "pending"),
    ),
    columns: {
      id: true,
    },
  });

  if (existingPendingRequest) {
    return NextResponse.json(
      { error: "You already have a pending gender change request." },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(genderChangeRequests)
    .values({
      groupId: membership.groupId,
      userId: user.id,
      currentGender,
      requestedGender,
      status: "pending",
    })
    .returning({
      id: genderChangeRequests.id,
      userId: genderChangeRequests.userId,
      currentGender: genderChangeRequests.currentGender,
      requestedGender: genderChangeRequests.requestedGender,
      status: genderChangeRequests.status,
      createdAt: genderChangeRequests.createdAt,
      updatedAt: genderChangeRequests.updatedAt,
    });

  return NextResponse.json(
    {
      ok: true,
      request: created ? toRequestResponse(created) : null,
    },
    { status: 201 },
  );
}
