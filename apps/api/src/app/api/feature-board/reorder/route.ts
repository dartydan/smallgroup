import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { featureBoardCards, featureBoardVotes } from "@/db/schema";
import { requireDeveloper } from "@/lib/auth";
import {
  FEATURE_BOARD_STATUS_ORDER,
  parseFeatureBoardColumns,
  sortFeatureBoardRows,
  toFeatureBoardCardDto,
} from "@/lib/feature-board";

export async function PATCH(request: Request) {
  let userId = "";
  try {
    const result = await requireDeveloper(request);
    userId = result.user.id;
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const payload = (await request
    .json()
    .catch(() => null)) as { columns?: unknown } | null;
  const columns = parseFeatureBoardColumns(payload?.columns);
  if (!columns) {
    return NextResponse.json(
      { error: "columns must include suggested, planned, in_progress, and done arrays." },
      { status: 400 },
    );
  }

  const existingCards = await db.select({ id: featureBoardCards.id }).from(featureBoardCards);
  const existingIds = new Set(existingCards.map((card) => card.id));

  const nextIds = FEATURE_BOARD_STATUS_ORDER.flatMap((status) => columns[status]);
  const uniqueNextIds = new Set(nextIds);

  if (uniqueNextIds.size !== nextIds.length) {
    return NextResponse.json({ error: "Each card ID can only appear once." }, { status: 400 });
  }

  if (uniqueNextIds.size !== existingIds.size) {
    return NextResponse.json(
      { error: "columns must include all existing card IDs exactly once." },
      { status: 400 },
    );
  }

  for (const cardId of uniqueNextIds) {
    if (!existingIds.has(cardId)) {
      return NextResponse.json(
        { error: `Unknown card ID: ${cardId}` },
        { status: 400 },
      );
    }
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const status of FEATURE_BOARD_STATUS_ORDER) {
      for (let index = 0; index < columns[status].length; index += 1) {
        const cardId = columns[status][index];
        await tx
          .update(featureBoardCards)
          .set({
            status,
            sortOrder: index,
            updatedAt: now,
          })
          .where(eq(featureBoardCards.id, cardId));
      }
    }
  });

  const [updatedRows, voteCountRows, myVoteRows] = await Promise.all([
    db.select().from(featureBoardCards),
    db
      .select({
        cardId: featureBoardVotes.cardId,
        voteCount: sql<number>`count(*)::int`,
      })
      .from(featureBoardVotes)
      .groupBy(featureBoardVotes.cardId),
    db
      .select({
        cardId: featureBoardVotes.cardId,
      })
      .from(featureBoardVotes)
      .where(eq(featureBoardVotes.userId, userId)),
  ]);

  const voteCountByCardId = new Map(
    voteCountRows.map((row) => [row.cardId, row.voteCount]),
  );
  const myVoteCardIds = new Set(myVoteRows.map((row) => row.cardId));

  return NextResponse.json({
    cards: sortFeatureBoardRows(updatedRows, { voteCountByCardId }).map((row) =>
      toFeatureBoardCardDto(row, {
        voteCount: voteCountByCardId.get(row.id) ?? 0,
        hasVoted: myVoteCardIds.has(row.id),
      }),
    ),
  });
}
