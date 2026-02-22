import { NextResponse } from "next/server";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSyncedUser, getMyGroupId } from "@/lib/auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireSyncedUser(request);
  const groupId = await getMyGroupId(request);
  const { id } = await params;

  if (!groupId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const existing = await db.query.announcements.findFirst({
    where: and(eq(announcements.id, id), eq(announcements.groupId, groupId)),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { groupMembers } = await import("@/db/schema");
  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.userId, user.id),
      eq(groupMembers.groupId, groupId),
    ),
    columns: {
      role: true,
      canEditEventsAnnouncements: true,
    },
  });
  const canEditAll =
    membership?.role === "admin" ||
    membership?.canEditEventsAnnouncements === true;
  if (!canEditAll && existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payload = await request
    .json()
    .catch(() => null) as { title?: unknown; body?: unknown; link?: unknown } | null;
  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const bodyText = typeof payload?.body === "string" ? payload.body.trim() : "";
  const link = typeof payload?.link === "string" ? payload.link.trim() : null;

  if (!title || !bodyText) {
    return NextResponse.json({ error: "title and body are required" }, { status: 400 });
  }

  await db
    .update(announcements)
    .set({
      title,
      body: bodyText,
      link: link && link.length > 0 ? link : null,
    })
    .where(eq(announcements.id, id));

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireSyncedUser(request);
  const groupId = await getMyGroupId(request);
  const { id } = await params;
  if (!groupId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const existing = await db.query.announcements.findFirst({
    where: and(
      eq(announcements.id, id),
      eq(announcements.groupId, groupId)
    ),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { groupMembers } = await import("@/db/schema");
  const membership = await db.query.groupMembers.findFirst({
    where: and(
      eq(groupMembers.userId, user.id),
      eq(groupMembers.groupId, groupId),
    ),
    columns: {
      role: true,
      canEditEventsAnnouncements: true,
    },
  });
  const canEditAll =
    membership?.role === "admin" ||
    membership?.canEditEventsAnnouncements === true;
  if (!canEditAll && existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  await db.delete(announcements).where(eq(announcements.id, id));
  return NextResponse.json({ ok: true });
}
