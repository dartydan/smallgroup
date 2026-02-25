import { NextResponse } from "next/server";
import { desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { featureBoardCards, featureBoardVotes } from "@/db/schema";
import {
  getUserGroupMemberships,
  isDeveloperUser,
  requireDeveloper,
  requireSyncedUser,
} from "@/lib/auth";
import { resolveDisplayName } from "@/lib/display-name";
import {
  sortFeatureBoardRows,
  toFeatureBoardCardDto,
} from "@/lib/feature-board";

function getCardIdFromRequest(request: Request): string | null {
  try {
    const cardId = new URL(request.url).searchParams.get("cardId")?.trim();
    return cardId || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await requireSyncedUser(request);
  const memberships = await getUserGroupMemberships(user.id);
  const hasAnyAdminMembership = memberships.some(
    (membership) => membership.role === "admin",
  );
  const isDeveloper = isDeveloperUser(
    user,
    hasAnyAdminMembership ? "admin" : null,
  );
  const rowsPromise = isDeveloper
    ? db.select().from(featureBoardCards)
    : db
        .select()
        .from(featureBoardCards)
        .where(ne(featureBoardCards.status, "suggested"));

  const [rows, voteCountRows, myVoteRows] = await Promise.all([
    rowsPromise,
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
      .where(eq(featureBoardVotes.userId, user.id)),
  ]);

  const voteCountByCardId = new Map(
    voteCountRows.map((row) => [row.cardId, row.voteCount]),
  );
  const myVoteCardIds = new Set(myVoteRows.map((row) => row.cardId));

  return NextResponse.json({
    cards: sortFeatureBoardRows(rows, { voteCountByCardId }).map((row) => {
      const visibleRow = isDeveloper
        ? row
        : {
            ...row,
            assignedToUserId: null,
            assignedToName: null,
          };
      return toFeatureBoardCardDto(visibleRow, {
        voteCount: voteCountByCardId.get(row.id) ?? 0,
        hasVoted: myVoteCardIds.has(row.id),
      });
    }),
  });
}

export async function POST(request: Request) {
  const user = await requireSyncedUser(request);

  const payload = (await request
    .json()
    .catch(() => null)) as { title?: unknown; description?: unknown } | null;

  const title = typeof payload?.title === "string" ? payload.title.trim() : "";
  const description =
    typeof payload?.description === "string" ? payload.description.trim() : "";

  if (title.length < 3 || title.length > 160) {
    return NextResponse.json(
      { error: "Title must be between 3 and 160 characters." },
      { status: 400 },
    );
  }

  if (description.length > 4000) {
    return NextResponse.json(
      { error: "Details can be at most 4000 characters." },
      { status: 400 },
    );
  }

  const [lastSuggested] = await db
    .select({ sortOrder: featureBoardCards.sortOrder })
    .from(featureBoardCards)
    .where(eq(featureBoardCards.status, "suggested"))
    .orderBy(desc(featureBoardCards.sortOrder))
    .limit(1);

  const suggesterName = resolveDisplayName({
    displayName: user.displayName,
    email: user.email,
    fallback: "Member",
  });

  const [created] = await db
    .insert(featureBoardCards)
    .values({
      title,
      description: description.length > 0 ? description : null,
      status: "suggested",
      sortOrder: (lastSuggested?.sortOrder ?? -1) + 1,
      suggestedByUserId: user.id,
      suggestedByName: suggesterName,
      suggestedByEmail: user.email,
    })
    .returning();

  return NextResponse.json({
    card: toFeatureBoardCardDto(created, {
      voteCount: 0,
      hasVoted: false,
    }),
  });
}

export async function DELETE(request: Request) {
  try {
    await requireDeveloper(request);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const cardId = getCardIdFromRequest(request);
  if (!cardId) {
    return NextResponse.json({ error: "cardId is required." }, { status: 400 });
  }

  const card = await db.query.featureBoardCards.findFirst({
    where: eq(featureBoardCards.id, cardId),
    columns: {
      id: true,
      status: true,
    },
  });

  if (!card) {
    return NextResponse.json({ error: "Feature card not found." }, { status: 404 });
  }

  if (card.status !== "suggested") {
    return NextResponse.json(
      { error: "Only Inbox cards can be deleted." },
      { status: 400 },
    );
  }

  await db.delete(featureBoardCards).where(eq(featureBoardCards.id, card.id));

  return NextResponse.json({
    ok: true,
    cardId: card.id,
  });
}
