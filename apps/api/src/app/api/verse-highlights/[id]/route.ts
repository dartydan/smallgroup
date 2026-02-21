import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { verseHighlights } from "@/db/schema";
import { getMyGroupId, getOrSyncUser } from "@/lib/auth";

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

  const existing = await db.query.verseHighlights.findFirst({
    where: and(
      eq(verseHighlights.id, id),
      eq(verseHighlights.groupId, groupId),
    ),
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.userId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db.delete(verseHighlights).where(eq(verseHighlights.id, id));
  return NextResponse.json({ ok: true });
}
