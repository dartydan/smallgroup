import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { featureBoardCards, featureBoardVotes } from "@/db/schema";
import { requireSyncedUser } from "@/lib/auth";

function getCardIdFromRequest(request: Request): string | null {
  try {
    const cardId = new URL(request.url).searchParams.get("cardId")?.trim();
    return cardId || null;
  } catch {
    return null;
  }
}

async function getVoteCount(cardId: string): Promise<number> {
  const [row] = await db
    .select({
      voteCount: sql<number>`count(*)::int`,
    })
    .from(featureBoardVotes)
    .where(eq(featureBoardVotes.cardId, cardId));

  return row?.voteCount ?? 0;
}

export async function POST(request: Request) {
  const user = await requireSyncedUser(request);
  const cardId = getCardIdFromRequest(request);
  if (!cardId) {
    return NextResponse.json({ error: "cardId is required." }, { status: 400 });
  }

  const existingCard = await db.query.featureBoardCards.findFirst({
    where: eq(featureBoardCards.id, cardId),
    columns: { id: true },
  });
  if (!existingCard) {
    return NextResponse.json({ error: "Feature card not found." }, { status: 404 });
  }

  await db
    .insert(featureBoardVotes)
    .values({
      cardId,
      userId: user.id,
    })
    .onConflictDoNothing();

  const voteCount = await getVoteCount(cardId);
  return NextResponse.json({ cardId, voteCount, hasVoted: true });
}

export async function DELETE(request: Request) {
  const user = await requireSyncedUser(request);
  const cardId = getCardIdFromRequest(request);
  if (!cardId) {
    return NextResponse.json({ error: "cardId is required." }, { status: 400 });
  }

  await db
    .delete(featureBoardVotes)
    .where(
      and(
        eq(featureBoardVotes.cardId, cardId),
        eq(featureBoardVotes.userId, user.id),
      ),
    );

  const voteCount = await getVoteCount(cardId);
  return NextResponse.json({ cardId, voteCount, hasVoted: false });
}
