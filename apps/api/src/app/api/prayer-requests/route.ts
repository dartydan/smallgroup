import { NextResponse } from "next/server";
import { db } from "@/db";
import { prayerRequests, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";

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
      prayed: prayerRequests.prayed,
      createdAt: prayerRequests.createdAt,
      authorName: users.displayName,
      authorEmail: users.email,
    })
    .from(prayerRequests)
    .leftJoin(users, eq(prayerRequests.authorId, users.id))
    .where(eq(prayerRequests.groupId, groupId))
    .orderBy(desc(prayerRequests.createdAt));

  const filtered = items
    .filter((row) => !row.isPrivate || row.authorId === user.id)
    .map((row) => {
      const { authorEmail, ...rest } = row;
      return {
        ...rest,
        authorName: resolveDisplayName({
          displayName: row.authorName,
          email: authorEmail,
          fallback: "Someone",
        }),
      };
    });
  return NextResponse.json({ items: filtered });
}

export async function POST(request: Request) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { content, isPrivate } = body as { content?: string; isPrivate?: boolean };
  if (!content || typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }
  const [created] = await db
    .insert(prayerRequests)
    .values({
      groupId,
      authorId: user.id,
      content: content.trim(),
      isPrivate: isPrivate === true,
    })
    .returning();
  return NextResponse.json(created);
}
