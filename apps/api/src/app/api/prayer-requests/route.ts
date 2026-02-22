import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  groupMembers,
  prayerRequestActivity,
  prayerRequestRecipients,
  prayerRequests,
  users,
} from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";

type PrayerVisibility = "everyone" | "my_gender" | "specific_people";

function parseVisibility(value: unknown): PrayerVisibility | null {
  if (value === undefined || value === null) {
    return "everyone";
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "everyone" ||
    normalized === "my_gender" ||
    normalized === "specific_people"
  ) {
    return normalized;
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ items: [] });
  }
  const items = await db
    .select({
      id: prayerRequests.id,
      authorId: prayerRequests.authorId,
      content: prayerRequests.content,
      isPrivate: prayerRequests.isPrivate,
      visibility: prayerRequests.visibility,
      prayed: prayerRequests.prayed,
      createdAt: prayerRequests.createdAt,
      authorName: users.displayName,
      authorEmail: users.email,
      authorGender: users.gender,
    })
    .from(prayerRequests)
    .leftJoin(users, eq(prayerRequests.authorId, users.id))
    .where(eq(prayerRequests.groupId, groupId))
    .orderBy(desc(prayerRequests.createdAt));

  const prayerIds = items.map((row) => row.id);
  const recipientRows =
    prayerIds.length === 0
      ? []
      : await db
          .select({
            prayerRequestId: prayerRequestRecipients.prayerRequestId,
            userId: prayerRequestRecipients.userId,
          })
          .from(prayerRequestRecipients)
          .where(inArray(prayerRequestRecipients.prayerRequestId, prayerIds));

  const recipientIdsByPrayer = new Map<string, Set<string>>();
  recipientRows.forEach((row) => {
    const current = recipientIdsByPrayer.get(row.prayerRequestId) ?? new Set<string>();
    current.add(row.userId);
    recipientIdsByPrayer.set(row.prayerRequestId, current);
  });

  const viewerGender =
    user.gender === "male" || user.gender === "female" ? user.gender : null;

  const filtered = items
    .filter((row) => {
      if (row.authorId === user.id) return true;

      const visibility: PrayerVisibility =
        row.visibility ?? (row.isPrivate ? "specific_people" : "everyone");
      if (visibility === "everyone") return true;

      if (visibility === "my_gender") {
        return (
          viewerGender !== null &&
          (row.authorGender === "male" || row.authorGender === "female") &&
          row.authorGender === viewerGender
        );
      }

      const recipients = recipientIdsByPrayer.get(row.id);
      return recipients?.has(user.id) ?? false;
    })
    .map((row) => {
      const recipients = recipientIdsByPrayer.get(row.id);
      const { authorEmail, authorGender: _authorGender, ...rest } = row;
      return {
        ...rest,
        visibility:
          row.visibility ?? (row.isPrivate ? "specific_people" : "everyone"),
        recipientIds: row.authorId === user.id ? Array.from(recipients ?? []) : undefined,
        authorName: resolveDisplayName({
          displayName: row.authorName,
          email: authorEmail,
          fallback: "Someone",
        }),
      };
    });

  const visiblePrayerIds = filtered.map((item) => item.id);
  let activityRows: Array<{
    id: string;
    prayerRequestId: string;
    actorId: string;
    activityType: "prayed" | "comment";
    comment: string | null;
    createdAt: Date;
    actorName: string | null;
    actorEmail: string | null;
  }> = [];
  if (visiblePrayerIds.length > 0) {
    try {
      activityRows = await db
        .select({
          id: prayerRequestActivity.id,
          prayerRequestId: prayerRequestActivity.prayerRequestId,
          actorId: prayerRequestActivity.actorId,
          activityType: prayerRequestActivity.activityType,
          comment: prayerRequestActivity.comment,
          createdAt: prayerRequestActivity.createdAt,
          actorName: users.displayName,
          actorEmail: users.email,
        })
        .from(prayerRequestActivity)
        .leftJoin(users, eq(prayerRequestActivity.actorId, users.id))
        .where(inArray(prayerRequestActivity.prayerRequestId, visiblePrayerIds))
        .orderBy(desc(prayerRequestActivity.createdAt));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const lower = message.toLowerCase();
      const isMissingActivityTable =
        lower.includes("prayer_request_activity") &&
        (lower.includes("does not exist") || lower.includes("relation"));

      if (!isMissingActivityTable) {
        console.error("Failed to load prayer activity", error);
      }
      activityRows = [];
    }
  }

  const activityByPrayer = new Map<
    string,
    Array<{
      id: string;
      prayerRequestId: string;
      actorId: string;
      type: "prayed" | "comment";
      comment: string | null;
      createdAt: Date;
      actorName: string;
    }>
  >();

  activityRows.forEach((row) => {
    const entry = {
      id: row.id,
      prayerRequestId: row.prayerRequestId,
      actorId: row.actorId,
      type: row.activityType,
      comment: row.comment,
      createdAt: row.createdAt,
      actorName: resolveDisplayName({
        displayName: row.actorName,
        email: row.actorEmail,
        fallback: "Someone",
      }),
    };
    const current = activityByPrayer.get(row.prayerRequestId) ?? [];
    current.push(entry);
    activityByPrayer.set(row.prayerRequestId, current);
  });

  return NextResponse.json({
    items: filtered.map((item) => ({
      ...item,
      activity: activityByPrayer.get(item.id) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { content, isPrivate, visibility: rawVisibility, recipientIds } = body as {
    content?: string;
    isPrivate?: boolean;
    visibility?: unknown;
    recipientIds?: unknown;
  };
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  let visibility = parseVisibility(rawVisibility);
  if (visibility === null) {
    return NextResponse.json(
      {
        error:
          "visibility must be one of: everyone, my_gender, specific_people",
      },
      { status: 400 },
    );
  }

  const usingLegacyPrivateFlag =
    (rawVisibility === undefined || rawVisibility === null) && isPrivate === true;
  if (usingLegacyPrivateFlag) {
    visibility = "specific_people";
  }

  if (visibility === "my_gender" && user.gender !== "male" && user.gender !== "female") {
    return NextResponse.json(
      { error: "Set your gender in Settings before using 'Gender Specific'." },
      { status: 400 },
    );
  }

  const requestedRecipientIds = Array.isArray(recipientIds)
    ? recipientIds
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    : [];
  const uniqueRecipientIds = Array.from(new Set(requestedRecipientIds)).filter(
    (id) => id !== user.id,
  );

  if (
    visibility === "specific_people" &&
    uniqueRecipientIds.length === 0 &&
    !usingLegacyPrivateFlag
  ) {
    return NextResponse.json(
      { error: "Select at least one person for 'Specific People'." },
      { status: 400 },
    );
  }

  if (visibility !== "specific_people" && uniqueRecipientIds.length > 0) {
    return NextResponse.json(
      { error: "recipientIds can only be provided for 'Specific People'." },
      { status: 400 },
    );
  }

  if (visibility === "specific_people" && uniqueRecipientIds.length > 0) {
    const allowedRecipients = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(
        and(
          eq(groupMembers.groupId, groupId),
          inArray(groupMembers.userId, uniqueRecipientIds),
        ),
      );

    if (allowedRecipients.length !== uniqueRecipientIds.length) {
      return NextResponse.json(
        { error: "Some selected people are not in your group." },
        { status: 400 },
      );
    }
  }

  const [created] = await db
    .insert(prayerRequests)
    .values({
      groupId,
      authorId: user.id,
      content: content.trim(),
      visibility,
      isPrivate: usingLegacyPrivateFlag,
    })
    .returning();

  if (visibility === "specific_people" && uniqueRecipientIds.length > 0) {
    await db.insert(prayerRequestRecipients).values(
      uniqueRecipientIds.map((recipientId) => ({
        prayerRequestId: created.id,
        userId: recipientId,
      })),
    );
  }

  return NextResponse.json(created);
}
