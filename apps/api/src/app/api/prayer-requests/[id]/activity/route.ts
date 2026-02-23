import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  prayerRequestActivity,
  prayerRequestRecipients,
  prayerRequests,
  users,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getMyGroupId, getOrSyncUser } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";

type PrayerVisibility = "everyone" | "my_gender" | "specific_people";
type PrayerActivityType = "prayed" | "comment";

function parseActivityType(value: unknown): PrayerActivityType | null {
  if (value === "prayed" || value === "comment") {
    return value;
  }
  return null;
}

function parseDeleteActivityType(value: string | null): "prayed" | null {
  if (value === "prayed") {
    return value;
  }
  return null;
}

function resolvePrayerVisibility(
  value: PrayerVisibility | null | undefined,
  isPrivate: boolean | null | undefined,
): PrayerVisibility {
  return value ?? (isPrivate ? "specific_people" : "everyone");
}

function isMissingActivityTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("prayer_request_activity") &&
    (lower.includes("does not exist") || lower.includes("relation"))
  );
}

function missingActivitySetupResponse() {
  return NextResponse.json(
    { error: "Prayer activity setup is still in progress. Please try again shortly." },
    { status: 503 },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  const { id } = await params;
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    type?: unknown;
    comment?: unknown;
  };
  const activityType = parseActivityType(body.type);
  if (!activityType) {
    return NextResponse.json(
      { error: "type must be one of: prayed, comment" },
      { status: 400 },
    );
  }

  const commentText =
    typeof body.comment === "string" ? body.comment.trim() : "";
  if (activityType === "comment" && !commentText) {
    return NextResponse.json(
      { error: "comment is required for comment activity." },
      { status: 400 },
    );
  }
  if (commentText.length > 500) {
    return NextResponse.json(
      { error: "comment must be 500 characters or less." },
      { status: 400 },
    );
  }

  const [targetPrayer] = await db
    .select({
      id: prayerRequests.id,
      authorId: prayerRequests.authorId,
      visibility: prayerRequests.visibility,
      isPrivate: prayerRequests.isPrivate,
      authorGender: users.gender,
    })
    .from(prayerRequests)
    .leftJoin(users, eq(prayerRequests.authorId, users.id))
    .where(
      and(
        eq(prayerRequests.id, id),
        eq(prayerRequests.groupId, groupId),
      ),
    )
    .limit(1);

  if (!targetPrayer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAuthor = targetPrayer.authorId === user.id;
  const visibility = resolvePrayerVisibility(
    targetPrayer.visibility,
    targetPrayer.isPrivate,
  );
  const viewerGender =
    user.gender === "male" || user.gender === "female" ? user.gender : null;
  const authorGender =
    targetPrayer.authorGender === "male" || targetPrayer.authorGender === "female"
      ? targetPrayer.authorGender
      : null;

  let canViewPrayer = isAuthor || visibility === "everyone";
  if (!canViewPrayer && visibility === "my_gender") {
    canViewPrayer =
      viewerGender !== null && authorGender !== null && viewerGender === authorGender;
  }
  if (!canViewPrayer && visibility === "specific_people") {
    const [recipient] = await db
      .select({ id: prayerRequestRecipients.id })
      .from(prayerRequestRecipients)
      .where(
        and(
          eq(prayerRequestRecipients.prayerRequestId, id),
          eq(prayerRequestRecipients.userId, user.id),
        ),
      )
      .limit(1);
    canViewPrayer = Boolean(recipient);
  }

  if (!canViewPrayer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (activityType === "prayed") {
    let existingPrayed:
      | {
          id: string;
          prayerRequestId: string;
          actorId: string;
          activityType: "prayed" | "comment";
          comment: string | null;
          createdAt: Date;
        }
      | undefined;
    try {
      [existingPrayed] = await db
        .select({
          id: prayerRequestActivity.id,
          prayerRequestId: prayerRequestActivity.prayerRequestId,
          actorId: prayerRequestActivity.actorId,
          activityType: prayerRequestActivity.activityType,
          comment: prayerRequestActivity.comment,
          createdAt: prayerRequestActivity.createdAt,
        })
        .from(prayerRequestActivity)
        .where(
          and(
            eq(prayerRequestActivity.prayerRequestId, id),
            eq(prayerRequestActivity.actorId, user.id),
            eq(prayerRequestActivity.activityType, "prayed"),
          ),
        )
        .limit(1);
    } catch (error) {
      if (isMissingActivityTableError(error)) {
        return missingActivitySetupResponse();
      }
      throw error;
    }

    if (existingPrayed) {
      return NextResponse.json({
        id: existingPrayed.id,
        prayerRequestId: existingPrayed.prayerRequestId,
        actorId: existingPrayed.actorId,
        type: existingPrayed.activityType,
        comment: existingPrayed.comment,
        createdAt: existingPrayed.createdAt,
        actorName: resolveDisplayName({
          displayName: user.displayName,
          email: user.email,
          fallback: "Someone",
        }),
      });
    }
  }

  let created:
    | {
        id: string;
        prayerRequestId: string;
        actorId: string;
        activityType: "prayed" | "comment";
        comment: string | null;
        createdAt: Date;
      }
    | undefined;
  try {
    [created] = await db
      .insert(prayerRequestActivity)
      .values({
        groupId,
        prayerRequestId: id,
        actorId: user.id,
        activityType,
        comment: activityType === "comment" ? commentText : null,
      })
      .returning({
        id: prayerRequestActivity.id,
        prayerRequestId: prayerRequestActivity.prayerRequestId,
        actorId: prayerRequestActivity.actorId,
        activityType: prayerRequestActivity.activityType,
        comment: prayerRequestActivity.comment,
        createdAt: prayerRequestActivity.createdAt,
      });
  } catch (error) {
    if (isMissingActivityTableError(error)) {
      return missingActivitySetupResponse();
    }
    throw error;
  }
  if (!created) {
    return NextResponse.json(
      { error: "Failed to record prayer activity." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: created.id,
    prayerRequestId: created.prayerRequestId,
    actorId: created.actorId,
    type: created.activityType,
    comment: created.comment,
    createdAt: created.createdAt,
    actorName: resolveDisplayName({
      displayName: user.displayName,
      email: user.email,
      fallback: "Someone",
    }),
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  const { id } = await params;
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const activityType = parseDeleteActivityType(url.searchParams.get("type"));
  if (!activityType) {
    return NextResponse.json(
      { error: "type must be: prayed" },
      { status: 400 },
    );
  }

  const [targetPrayer] = await db
    .select({
      id: prayerRequests.id,
      authorId: prayerRequests.authorId,
      visibility: prayerRequests.visibility,
      isPrivate: prayerRequests.isPrivate,
      authorGender: users.gender,
    })
    .from(prayerRequests)
    .leftJoin(users, eq(prayerRequests.authorId, users.id))
    .where(
      and(
        eq(prayerRequests.id, id),
        eq(prayerRequests.groupId, groupId),
      ),
    )
    .limit(1);

  if (!targetPrayer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isAuthor = targetPrayer.authorId === user.id;
  const visibility = resolvePrayerVisibility(
    targetPrayer.visibility,
    targetPrayer.isPrivate,
  );
  const viewerGender =
    user.gender === "male" || user.gender === "female" ? user.gender : null;
  const authorGender =
    targetPrayer.authorGender === "male" || targetPrayer.authorGender === "female"
      ? targetPrayer.authorGender
      : null;

  let canViewPrayer = isAuthor || visibility === "everyone";
  if (!canViewPrayer && visibility === "my_gender") {
    canViewPrayer =
      viewerGender !== null && authorGender !== null && viewerGender === authorGender;
  }
  if (!canViewPrayer && visibility === "specific_people") {
    const [recipient] = await db
      .select({ id: prayerRequestRecipients.id })
      .from(prayerRequestRecipients)
      .where(
        and(
          eq(prayerRequestRecipients.prayerRequestId, id),
          eq(prayerRequestRecipients.userId, user.id),
        ),
      )
      .limit(1);
    canViewPrayer = Boolean(recipient);
  }

  if (!canViewPrayer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await db
      .delete(prayerRequestActivity)
      .where(
        and(
          eq(prayerRequestActivity.groupId, groupId),
          eq(prayerRequestActivity.prayerRequestId, id),
          eq(prayerRequestActivity.actorId, user.id),
          eq(prayerRequestActivity.activityType, activityType),
        ),
      );
  } catch (error) {
    if (isMissingActivityTableError(error)) {
      return missingActivitySetupResponse();
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
