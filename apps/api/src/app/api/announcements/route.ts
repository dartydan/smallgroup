import { NextResponse } from "next/server";
import { db } from "@/db";
import { announcements } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  getOrSyncUser,
  getMyGroupId,
  requireEventsAnnouncementsEditor,
} from "@/lib/auth";

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
    .select()
    .from(announcements)
    .where(eq(announcements.groupId, groupId))
    .orderBy(desc(announcements.createdAt));
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  let user;
  try {
    const result = await requireEventsAnnouncementsEditor(request);
    user = result.user;
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = await request.json();
  const { title, body: bodyText, link } = raw as { title?: string; body?: string; link?: string };
  if (!title || !bodyText) {
    return NextResponse.json(
      { error: "title and body are required" },
      { status: 400 }
    );
  }
  const [created] = await db
    .insert(announcements)
    .values({
      groupId,
      authorId: user.id,
      title,
      body: bodyText,
      link: link ?? null,
    })
    .returning();
  return NextResponse.json(created);
}
