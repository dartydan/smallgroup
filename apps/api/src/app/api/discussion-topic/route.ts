import { NextResponse } from "next/server";
import { db } from "@/db";
import { discussionTopics } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId, requireAdmin } from "@/lib/auth";
import { getMonthYearInTimeZone } from "@/lib/timezone";

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ topic: null });
  }
  const { month, year } = getMonthYearInTimeZone(new Date());
  const topic = await db.query.discussionTopics.findFirst({
    where: and(
      eq(discussionTopics.groupId, groupId),
      eq(discussionTopics.month, month),
      eq(discussionTopics.year, year)
    ),
  });
  return NextResponse.json({ topic });
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin(request);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const {
    title,
    description,
    bibleReference,
    bibleText,
    month,
    year,
  } = body as {
    title?: string;
    description?: string;
    bibleReference?: string;
    bibleText?: string;
    month?: number;
    year?: number;
  };
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  const normalizedDescription = typeof description === "string" ? description.trim() : "";
  const normalizedBibleReference =
    typeof bibleReference === "string" ? bibleReference.trim() : "";
  const normalizedBibleText = typeof bibleText === "string" ? bibleText.trim() : "";
  const current = getMonthYearInTimeZone(new Date());
  const m = month ?? current.month;
  const y = year ?? current.year;

  const existing = await db.query.discussionTopics.findFirst({
    where: and(
      eq(discussionTopics.groupId, groupId),
      eq(discussionTopics.month, m),
      eq(discussionTopics.year, y)
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(discussionTopics)
      .set({
        title: normalizedTitle,
        description: normalizedDescription || null,
        bibleReference: normalizedBibleReference || null,
        bibleText: normalizedBibleText || null,
        updatedAt: new Date(),
      })
      .where(eq(discussionTopics.id, existing.id))
      .returning();
    return NextResponse.json({ topic: updated });
  }

  const [created] = await db
    .insert(discussionTopics)
    .values({
      groupId,
      title: normalizedTitle,
      description: normalizedDescription || null,
      bibleReference: normalizedBibleReference || null,
      bibleText: normalizedBibleText || null,
      month: m,
      year: y,
    })
    .returning();
  return NextResponse.json({ topic: created });
}
