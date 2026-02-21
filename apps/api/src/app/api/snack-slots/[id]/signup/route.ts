import { NextResponse } from "next/server";
import { db } from "@/db";
import { snackSlots, snackSignups } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId } from "@/lib/auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  const { id: slotId } = await params;
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const slot = await db.query.snackSlots.findFirst({
    where: and(
      eq(snackSlots.id, slotId),
      eq(snackSlots.groupId, groupId)
    ),
  });
  if (!slot) {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }
  if (slot.isCancelled) {
    return NextResponse.json({ error: "Meeting has been removed" }, { status: 400 });
  }

  const existing = await db.query.snackSignups.findFirst({
    where: and(
      eq(snackSignups.slotId, slotId),
      eq(snackSignups.userId, user.id)
    ),
  });
  if (existing) {
    return NextResponse.json({ message: "Already signed up", ok: true });
  }

  await db.insert(snackSignups).values({ slotId, userId: user.id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getOrSyncUser(request);
  const { id: slotId } = await params;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signup = await db.query.snackSignups.findFirst({
    where: and(
      eq(snackSignups.slotId, slotId),
      eq(snackSignups.userId, user.id)
    ),
  });
  if (!signup) {
    return NextResponse.json({ message: "Not signed up", ok: true });
  }

  await db.delete(snackSignups).where(eq(snackSignups.id, signup.id));
  return NextResponse.json({ ok: true });
}
