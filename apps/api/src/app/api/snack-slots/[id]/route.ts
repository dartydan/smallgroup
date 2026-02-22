import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { snackSlots } from "@/db/schema";
import { getMyGroupId, requireEventsAnnouncementsEditor } from "@/lib/auth";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireEventsAnnouncementsEditor(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: slotId } = await params;
  const payload = await request
    .json()
    .catch(() => null) as { reason?: unknown } | null;
  const reason =
    typeof payload?.reason === "string" ? payload.reason.trim() : "";
  if (!reason) {
    return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
  }

  const slot = await db.query.snackSlots.findFirst({
    where: and(eq(snackSlots.id, slotId), eq(snackSlots.groupId, groupId)),
  });
  if (!slot) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  await db
    .update(snackSlots)
    .set({ isCancelled: true, cancellationReason: reason })
    .where(eq(snackSlots.id, slotId));

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireEventsAnnouncementsEditor(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: slotId } = await params;
  const slot = await db.query.snackSlots.findFirst({
    where: and(eq(snackSlots.id, slotId), eq(snackSlots.groupId, groupId)),
  });
  if (!slot) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  await db
    .update(snackSlots)
    .set({ isCancelled: false, cancellationReason: null })
    .where(eq(snackSlots.id, slotId));

  return NextResponse.json({ ok: true });
}
