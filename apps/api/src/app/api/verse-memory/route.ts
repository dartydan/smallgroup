import { NextResponse } from "next/server";
import { db } from "@/db";
import { verseMemory, verseMemoryProgress } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import {
  getOrSyncUser,
  getMyGroupId,
  requireEventsAnnouncementsEditor,
} from "@/lib/auth";
import { getMonthYearInTimeZone } from "@/lib/timezone";

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ verses: [] });
  }
  const { month, year } = getMonthYearInTimeZone(new Date());
  const verse = await db.query.verseMemory.findFirst({
    where: and(
      eq(verseMemory.groupId, groupId),
      eq(verseMemory.month, month),
      eq(verseMemory.year, year),
    ),
    orderBy: [desc(verseMemory.createdAt), desc(verseMemory.id)],
  });
  if (!verse) {
    return NextResponse.json({ verses: [] });
  }

  const progress = await db.query.verseMemoryProgress.findFirst({
    where: and(
      eq(verseMemoryProgress.verseId, verse.id),
      eq(verseMemoryProgress.userId, user.id),
    ),
  });
  return NextResponse.json({
    verses: [
      {
        id: verse.id,
        verseReference: verse.verseReference,
        verseSnippet: verse.verseSnippet,
        month: verse.month,
        year: verse.year,
        memorized: progress?.memorized ?? false,
      },
    ],
  });
}

export async function POST(request: Request) {
  try {
    await requireEventsAnnouncementsEditor(request);
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const { verseReference, verseSnippet } = body as {
    verseReference?: string;
    verseSnippet?: string;
  };
  if (!verseReference || !verseReference.trim()) {
    return NextResponse.json(
      { error: "verseReference is required" },
      { status: 400 }
    );
  }
  const { month, year } = getMonthYearInTimeZone(new Date());
  const existing = await db.query.verseMemory.findFirst({
    where: and(
      eq(verseMemory.groupId, groupId),
      eq(verseMemory.month, month),
      eq(verseMemory.year, year),
    ),
    orderBy: [desc(verseMemory.createdAt), desc(verseMemory.id)],
  });
  if (existing) {
    const [updated] = await db
      .update(verseMemory)
      .set({
        verseReference: verseReference.trim(),
        verseSnippet: verseSnippet?.trim() ?? null,
      })
      .where(eq(verseMemory.id, existing.id))
      .returning();
    return NextResponse.json({ verse: updated });
  }
  const [created] = await db
    .insert(verseMemory)
    .values({
      groupId,
      verseReference: verseReference.trim(),
      verseSnippet: verseSnippet?.trim() ?? null,
      month,
      year,
    })
    .returning();
  return NextResponse.json({ verse: created });
}
