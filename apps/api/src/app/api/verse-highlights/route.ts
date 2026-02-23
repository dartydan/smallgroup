import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verseHighlights } from "@/db/schema";
import { getMyGroupId, getOrSyncUser } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";

function normalizeBook(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function parseChapterValue(raw: string | null): number {
  if (!raw) return Number.NaN;
  return Number.parseInt(raw, 10);
}

function parseLimitValue(raw: string | null, fallback = 20): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(100, Math.max(1, parsed));
}

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const rawBook = searchParams.get("book");
  const rawChapter = searchParams.get("chapter");
  const hasBookParam = rawBook !== null;
  const hasChapterParam = rawChapter !== null;
  const hasLimitParam = searchParams.get("limit") !== null;
  const limit = parseLimitValue(searchParams.get("limit"), 20);

  if (hasBookParam !== hasChapterParam) {
    return NextResponse.json(
      { error: "Provide both book and chapter, or neither." },
      { status: 400 },
    );
  }

  let items: Array<{
    id: string;
    verseReference: string;
    verseNumber: number;
    book: string;
    chapter: number;
    createdAt: Date;
    userId: string;
    userName: string | null;
    userEmail: string | null;
  }> = [];

  if (hasBookParam && hasChapterParam) {
    const chapter = parseChapterValue(rawChapter);
    const book = rawBook ? normalizeBook(rawBook) : "";

    if (!book || !/^[0-9A-Za-z\s'-]+$/.test(book)) {
      return NextResponse.json(
        { error: "Invalid book parameter" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > 200) {
      return NextResponse.json(
        { error: "Invalid chapter parameter" },
        { status: 400 },
      );
    }

    const chapterQuery = db
      .select({
        id: verseHighlights.id,
        verseReference: verseHighlights.verseReference,
        verseNumber: verseHighlights.verseNumber,
        book: verseHighlights.book,
        chapter: verseHighlights.chapter,
        createdAt: verseHighlights.createdAt,
        userId: verseHighlights.userId,
        userName: users.displayName,
        userEmail: users.email,
      })
      .from(verseHighlights)
      .leftJoin(users, eq(verseHighlights.userId, users.id))
      .where(
        and(
          eq(verseHighlights.groupId, groupId),
          eq(verseHighlights.book, book),
          eq(verseHighlights.chapter, chapter),
        ),
      )
      .orderBy(desc(verseHighlights.createdAt), desc(verseHighlights.id));
    items = hasLimitParam ? await chapterQuery.limit(limit) : await chapterQuery;
  } else {
    items = await db
      .select({
        id: verseHighlights.id,
        verseReference: verseHighlights.verseReference,
        verseNumber: verseHighlights.verseNumber,
        book: verseHighlights.book,
        chapter: verseHighlights.chapter,
        createdAt: verseHighlights.createdAt,
        userId: verseHighlights.userId,
        userName: users.displayName,
        userEmail: users.email,
      })
      .from(verseHighlights)
      .leftJoin(users, eq(verseHighlights.userId, users.id))
      .where(eq(verseHighlights.groupId, groupId))
      .orderBy(desc(verseHighlights.createdAt), desc(verseHighlights.id))
      .limit(limit);
  }

  return NextResponse.json({
    highlights: items.map((item) => ({
      id: item.id,
      verseReference: item.verseReference,
      verseNumber: item.verseNumber,
      book: item.book,
      chapter: item.chapter,
      createdAt: item.createdAt,
      userId: item.userId,
      userName: resolveDisplayName({
        displayName: item.userName,
        email: item.userEmail,
        fallback: "Member",
      }),
      isMine: item.userId === user.id,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    book?: string;
    chapter?: number;
    verseNumber?: number;
    verseReference?: string;
  } | null;

  const book = normalizeBook(body?.book ?? "");
  const chapter = Number(body?.chapter);
  const verseNumber = Number(body?.verseNumber);
  const verseReference = (body?.verseReference ?? "").trim();

  if (!book || !/^[0-9A-Za-z\s'-]+$/.test(book)) {
    return NextResponse.json({ error: "Invalid book value" }, { status: 400 });
  }
  if (!Number.isFinite(chapter) || chapter < 1 || chapter > 200) {
    return NextResponse.json(
      { error: "Invalid chapter value" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(verseNumber) || verseNumber < 1 || verseNumber > 250) {
    return NextResponse.json(
      { error: "Invalid verse number value" },
      { status: 400 },
    );
  }
  if (!verseReference) {
    return NextResponse.json(
      { error: "verseReference is required" },
      { status: 400 },
    );
  }

  const existing = await db.query.verseHighlights.findFirst({
    where: and(
      eq(verseHighlights.groupId, groupId),
      eq(verseHighlights.userId, user.id),
      eq(verseHighlights.book, book),
      eq(verseHighlights.chapter, chapter),
      eq(verseHighlights.verseNumber, verseNumber),
    ),
  });
  if (existing) {
    return NextResponse.json({ highlight: existing });
  }

  const [created] = await db
    .insert(verseHighlights)
    .values({
      groupId,
      userId: user.id,
      book,
      chapter,
      verseNumber,
      verseReference,
    })
    .returning();

  return NextResponse.json({ highlight: created });
}
