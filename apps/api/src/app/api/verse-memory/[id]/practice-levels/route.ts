import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { users, verseMemory, versePracticeCompletions } from "@/db/schema";
import { getMyGroupId, getOrSyncUser } from "@/lib/auth";

type PracticeLevel = 1 | 2 | 3;
type CompletionMember = { userId: string; firstName: string };
type CompletedByLevel = Record<PracticeLevel, CompletionMember[]>;

function emptyCompletedByLevel(): CompletedByLevel {
  return { 1: [], 2: [], 3: [] };
}

function toLevel(raw: unknown): PracticeLevel | null {
  const parsed =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? Number.parseInt(raw, 10)
        : NaN;
  if (parsed === 1 || parsed === 2 || parsed === 3) return parsed;
  return null;
}

function firstNameOnly(firstName: string | null): string {
  return firstName?.trim() || "Member";
}

function mapPracticeCompletionRows(
  rows: Array<{
    completion: {
      userId: string;
      level: number;
    };
    user: {
      firstName: string | null;
    };
  }>,
  currentUserId: string,
): { completedByLevel: CompletedByLevel; myCompletedLevels: PracticeLevel[] } {
  const completedByLevel = emptyCompletedByLevel();
  const myLevelSet = new Set<PracticeLevel>();

  for (const row of rows) {
    const level = toLevel(row.completion.level);
    if (!level) continue;

    completedByLevel[level].push({
      userId: row.completion.userId,
      firstName: firstNameOnly(row.user.firstName),
    });

    if (row.completion.userId === currentUserId) {
      myLevelSet.add(level);
    }
  }

  return {
    completedByLevel,
    myCompletedLevels: [...myLevelSet].sort((a, b) => a - b),
  };
}

async function loadPracticeLevels(verseId: string, currentUserId: string) {
  const rows = await db
    .select({
      completion: {
        userId: versePracticeCompletions.userId,
        level: versePracticeCompletions.level,
      },
      user: {
        firstName: users.firstName,
      },
    })
    .from(versePracticeCompletions)
    .innerJoin(users, eq(versePracticeCompletions.userId, users.id))
    .where(eq(versePracticeCompletions.verseId, verseId))
    .orderBy(asc(versePracticeCompletions.completedAt));

  return mapPracticeCompletionRows(rows, currentUserId);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  const { id: verseId } = await params;

  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verse = await db.query.verseMemory.findFirst({
    where: and(eq(verseMemory.id, verseId), eq(verseMemory.groupId, groupId)),
  });
  if (!verse) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = await loadPracticeLevels(verseId, user.id);
  return NextResponse.json(payload);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getOrSyncUser(request);
  const groupId = await getMyGroupId(request);
  const { id: verseId } = await params;

  if (!user || !groupId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const verse = await db.query.verseMemory.findFirst({
    where: and(eq(verseMemory.id, verseId), eq(verseMemory.groupId, groupId)),
  });
  if (!verse) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { level?: unknown };
  const level = toLevel(body.level);
  if (!level) {
    return NextResponse.json({ error: "Level must be 1, 2, or 3" }, { status: 400 });
  }

  const existing = await db.query.versePracticeCompletions.findFirst({
    where: and(
      eq(versePracticeCompletions.verseId, verseId),
      eq(versePracticeCompletions.userId, user.id),
      eq(versePracticeCompletions.level, level),
    ),
    columns: { id: true },
  });

  if (!existing) {
    await db.insert(versePracticeCompletions).values({
      verseId,
      userId: user.id,
      level,
    });
  }

  const payload = await loadPracticeLevels(verseId, user.id);
  return NextResponse.json(payload);
}
