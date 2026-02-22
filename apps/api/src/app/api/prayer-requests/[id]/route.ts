import { NextResponse } from "next/server";
import { db } from "@/db";
import { groupMembers, prayerRequestRecipients, prayerRequests } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId } from "@/lib/auth";

type PrayerVisibility = "everyone" | "my_gender" | "specific_people";

function parseVisibility(value: unknown): PrayerVisibility | null {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  const { id } = await params;
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await db.query.prayerRequests.findFirst({
    where: and(
      eq(prayerRequests.id, id),
      eq(prayerRequests.groupId, groupId)
    ),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await request.json();
  const { prayed, visibility: rawVisibility, recipientIds, content } = body as {
    prayed?: unknown;
    visibility?: unknown;
    recipientIds?: unknown;
    content?: unknown;
  };
  const updates: Partial<typeof prayerRequests.$inferInsert> = {};
  const touchingAudience = rawVisibility !== undefined || recipientIds !== undefined;
  const touchingContent = content !== undefined;
  let nextRecipientIds: string[] | null = null;

  if (typeof prayed === "boolean") {
    updates.prayed = prayed;
  }

  if (touchingContent) {
    if (existing.authorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 },
      );
    }
    updates.content = content.trim();
  }

  if (touchingAudience) {
    if (existing.authorId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const currentVisibility: PrayerVisibility =
      existing.visibility ?? (existing.isPrivate ? "specific_people" : "everyone");
    let nextVisibility: PrayerVisibility = currentVisibility;

    if (rawVisibility !== undefined) {
      const parsedVisibility = parseVisibility(rawVisibility);
      if (!parsedVisibility) {
        return NextResponse.json(
          {
            error:
              "visibility must be one of: everyone, my_gender, specific_people",
          },
          { status: 400 },
        );
      }
      nextVisibility = parsedVisibility;
    }

    if (nextVisibility === "my_gender" && user.gender !== "male" && user.gender !== "female") {
      return NextResponse.json(
        { error: "Set your gender in Settings before using 'Gender Specific'." },
        { status: 400 },
      );
    }

    let resolvedRecipientIds: string[] = [];
    if (recipientIds === undefined) {
      if (nextVisibility === "specific_people") {
        const existingRecipients = await db
          .select({ userId: prayerRequestRecipients.userId })
          .from(prayerRequestRecipients)
          .where(eq(prayerRequestRecipients.prayerRequestId, id));
        resolvedRecipientIds = existingRecipients.map((row) => row.userId);
      }
    } else {
      if (!Array.isArray(recipientIds)) {
        return NextResponse.json(
          { error: "recipientIds must be an array of user ids." },
          { status: 400 },
        );
      }
      resolvedRecipientIds = Array.from(
        new Set(
          recipientIds
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim())
            .filter((value) => value.length > 0 && value !== user.id),
        ),
      );
    }

    if (nextVisibility !== "specific_people") {
      if (recipientIds !== undefined && resolvedRecipientIds.length > 0) {
        return NextResponse.json(
          { error: "recipientIds can only be provided for 'Specific People'." },
          { status: 400 },
        );
      }
      resolvedRecipientIds = [];
    }

    if (nextVisibility === "specific_people" && resolvedRecipientIds.length === 0) {
      return NextResponse.json(
        { error: "Select at least one person for 'Specific People'." },
        { status: 400 },
      );
    }

    if (nextVisibility === "specific_people" && resolvedRecipientIds.length > 0) {
      const allowedRecipients = await db
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupId, groupId),
            inArray(groupMembers.userId, resolvedRecipientIds),
          ),
        );

      if (allowedRecipients.length !== resolvedRecipientIds.length) {
        return NextResponse.json(
          { error: "Some selected people are not in your group." },
          { status: 400 },
        );
      }
    }

    updates.visibility = nextVisibility;
    updates.isPrivate = false;
    nextRecipientIds = resolvedRecipientIds;
  }

  if (
    updates.prayed === undefined &&
    updates.content === undefined &&
    updates.visibility === undefined &&
    updates.isPrivate === undefined
  ) {
    return NextResponse.json(
      { error: "Nothing to update" },
      { status: 400 },
    );
  }

  const updated = await db.transaction(async (tx) => {
    const [updatedRow] = await tx
      .update(prayerRequests)
      .set(updates)
      .where(eq(prayerRequests.id, id))
      .returning();

    if (touchingAudience && nextRecipientIds !== null) {
      await tx
        .delete(prayerRequestRecipients)
        .where(eq(prayerRequestRecipients.prayerRequestId, id));
      if (nextRecipientIds.length > 0) {
        await tx.insert(prayerRequestRecipients).values(
          nextRecipientIds.map((recipientId) => ({
            prayerRequestId: id,
            userId: recipientId,
          })),
        );
      }
    }

    return updatedRow;
  });

  if (touchingAudience && nextRecipientIds !== null) {
    return NextResponse.json({
      ...updated,
      recipientIds: nextRecipientIds,
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  const { id } = await params;
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await db.query.prayerRequests.findFirst({
    where: and(
      eq(prayerRequests.id, id),
      eq(prayerRequests.groupId, groupId)
    ),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await db.delete(prayerRequests).where(eq(prayerRequests.id, id));
  return NextResponse.json({ ok: true });
}
