import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { featureBoardCards, featureBoardVotes } from "@/db/schema";
import { requireDeveloper } from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";
import { toFeatureBoardCardDto } from "@/lib/feature-board";

export async function POST(request: Request) {
  let developer: Awaited<ReturnType<typeof requireDeveloper>>;
  try {
    developer = await requireDeveloper(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const payload = (await request
    .json()
    .catch(() => null)) as { cardId?: unknown } | null;
  const cardId = typeof payload?.cardId === "string" ? payload.cardId.trim() : "";

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required." }, { status: 400 });
  }

  const existing = await db.query.featureBoardCards.findFirst({
    where: eq(featureBoardCards.id, cardId),
    columns: { id: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Feature card not found." }, { status: 404 });
  }

  const assignedToName = resolveDisplayName({
    displayName: developer.user.displayName,
    email: developer.user.email,
    fallback: "Developer",
  });

  const [updated] = await db
    .update(featureBoardCards)
    .set({
      assignedToUserId: developer.user.id,
      assignedToName,
      updatedAt: new Date(),
    })
    .where(eq(featureBoardCards.id, cardId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Feature card not found." }, { status: 404 });
  }

  const [[voteCountRow], myVoteRow] = await Promise.all([
    db
      .select({
        voteCount: sql<number>`count(*)::int`,
      })
      .from(featureBoardVotes)
      .where(eq(featureBoardVotes.cardId, cardId)),
    db.query.featureBoardVotes.findFirst({
      where: and(
        eq(featureBoardVotes.cardId, cardId),
        eq(featureBoardVotes.userId, developer.user.id),
      ),
      columns: {
        userId: true,
      },
    }),
  ]);

  const hasVoted = myVoteRow?.userId === developer.user.id;

  return NextResponse.json({
    card: toFeatureBoardCardDto(updated, {
      voteCount: voteCountRow?.voteCount ?? 0,
      hasVoted,
    }),
  });
}
