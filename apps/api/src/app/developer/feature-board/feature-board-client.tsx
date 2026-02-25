"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { ArrowLeft, GripVertical, Plus, RefreshCw, ThumbsUp } from "lucide-react";
import {
  api,
  type FeatureBoardCard,
  type FeatureBoardColumns,
  type FeatureBoardStatus,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const FEATURE_COLUMNS: Array<{ status: FeatureBoardStatus; label: string }> = [
  { status: "suggested", label: "Inbox" },
  { status: "planned", label: "Planned" },
  { status: "in_progress", label: "In Progress" },
  { status: "done", label: "Done" },
];

type FeatureBoardCardColumns = Record<FeatureBoardStatus, FeatureBoardCard[]>;
type DropTarget = FeatureBoardStatus | null;
type CardContextMenu = {
  cardId: string;
  x: number;
  y: number;
} | null;

function createEmptyColumns(): FeatureBoardCardColumns {
  return {
    suggested: [],
    planned: [],
    in_progress: [],
    done: [],
  };
}

function groupCardsByStatus(cards: FeatureBoardCard[]): FeatureBoardCardColumns {
  const columns = createEmptyColumns();
  for (const card of cards) {
    columns[card.status].push(card);
  }

  for (const { status } of FEATURE_COLUMNS) {
    const column = columns[status];
    if (status === "done") {
      column.sort((a, b) => {
        const positionDelta = a.position - b.position;
        if (positionDelta !== 0) return positionDelta;

        const updatedDelta = Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
        if (Number.isFinite(updatedDelta) && updatedDelta !== 0) return updatedDelta;

        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
      continue;
    }

    column.sort((a, b) => {
      const voteDelta = b.voteCount - a.voteCount;
      if (voteDelta !== 0) return voteDelta;

      const positionDelta = a.position - b.position;
      if (positionDelta !== 0) return positionDelta;

      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
  }

  return columns;
}

function flattenColumns(columns: FeatureBoardCardColumns): FeatureBoardCard[] {
  return FEATURE_COLUMNS.flatMap(({ status }) => columns[status]);
}

function getColumnIdMap(columns: FeatureBoardCardColumns): FeatureBoardColumns {
  return {
    suggested: columns.suggested.map((card) => card.id),
    planned: columns.planned.map((card) => card.id),
    in_progress: columns.in_progress.map((card) => card.id),
    done: columns.done.map((card) => card.id),
  };
}

function moveCardInColumns(
  columns: FeatureBoardCardColumns,
  cardId: string,
  targetStatus: FeatureBoardStatus,
  targetIndex: number,
): FeatureBoardCardColumns | null {
  const next = createEmptyColumns();
  for (const { status } of FEATURE_COLUMNS) {
    next[status] = [...columns[status]];
  }

  let sourceStatus: FeatureBoardStatus | null = null;
  let sourceIndex = -1;
  for (const { status } of FEATURE_COLUMNS) {
    const index = next[status].findIndex((card) => card.id === cardId);
    if (index >= 0) {
      sourceStatus = status;
      sourceIndex = index;
      break;
    }
  }

  if (!sourceStatus || sourceIndex < 0) return null;

  const sourceCards = next[sourceStatus];
  const [dragged] = sourceCards.splice(sourceIndex, 1);
  if (!dragged) return null;

  const destinationCards = next[targetStatus];
  const adjustedIndex =
    sourceStatus === targetStatus && sourceIndex < targetIndex
      ? targetIndex - 1
      : targetIndex;
  const clampedIndex = Math.max(0, Math.min(adjustedIndex, destinationCards.length));

  destinationCards.splice(clampedIndex, 0, {
    ...dragged,
    status: targetStatus,
  });

  for (const { status } of FEATURE_COLUMNS) {
    next[status] = next[status].map((card, index) => ({
      ...card,
      status,
      position: index,
    }));
  }

  return next;
}

function formatCardDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type FeatureBoardClientProps = {
  embedded?: boolean;
};

export function FeatureBoardClient({ embedded = false }: FeatureBoardClientProps = {}) {
  const router = useRouter();
  const { getToken, isLoaded } = useAuth();

  const [cards, setCards] = useState<FeatureBoardCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const [cardContextMenu, setCardContextMenu] = useState<CardContextMenu>(null);
  const [deletePendingCardId, setDeletePendingCardId] = useState<string | null>(null);
  const [votePendingIds, setVotePendingIds] = useState<Set<string>>(() => new Set());
  const [assignPendingIds, setAssignPendingIds] = useState<Set<string>>(() => new Set());
  const [newFeatureTitle, setNewFeatureTitle] = useState("");
  const [newFeatureDescription, setNewFeatureDescription] = useState("");
  const [newFeatureDialogOpen, setNewFeatureDialogOpen] = useState(false);
  const [newFeatureSubmitting, setNewFeatureSubmitting] = useState(false);

  const getAuthToken = useCallback(async () => {
    if (!isLoaded) return null;
    const token = await getToken();
    if (!token) {
      router.push("/sign-in");
      return null;
    }
    return token;
  }, [getToken, isLoaded, router]);

  const loadCards = useCallback(async () => {
    const token = await getAuthToken();
    if (!token) return;

    setLoading(true);
    setError(null);
    try {
      const [nextCards, me] = await Promise.all([
        api.getFeatureBoardCards(token),
        api.getMe(token),
      ]);
      setCards(Array.isArray(nextCards) ? nextCards : []);
      setIsDeveloper(me?.isDeveloper === true);
      setCurrentUserId(me?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void loadCards();
  }, [isLoaded, loadCards]);

  const cardsByStatus = useMemo(() => groupCardsByStatus(cards), [cards]);
  const visibleColumns = useMemo(
    () =>
      isDeveloper
        ? FEATURE_COLUMNS
        : FEATURE_COLUMNS.filter((column) => column.status !== "suggested"),
    [isDeveloper],
  );

  const persistCardOrder = useCallback(
    async (nextColumns: FeatureBoardCardColumns) => {
      if (!isDeveloper) return;
      const token = await getAuthToken();
      if (!token) return;

      setSaving(true);
      try {
        const reordered = await api.reorderFeatureBoard(token, getColumnIdMap(nextColumns));
        setCards(Array.isArray(reordered) ? reordered : []);
      } finally {
        setSaving(false);
      }
    },
    [getAuthToken, isDeveloper],
  );

  const handleCreateFeature = useCallback(async () => {
    if (!isDeveloper) return;

    const title = newFeatureTitle.trim();
    const description = newFeatureDescription.trim();
    if (title.length < 3) {
      setError("Feature title must be at least 3 characters.");
      return;
    }

    const token = await getAuthToken();
    if (!token) return;

    setNewFeatureSubmitting(true);
    setError(null);
    try {
      await api.suggestFeature(token, {
        title,
        description,
      });
      setNewFeatureTitle("");
      setNewFeatureDescription("");
      setNewFeatureDialogOpen(false);
      await loadCards();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setNewFeatureSubmitting(false);
    }
  }, [getAuthToken, isDeveloper, loadCards, newFeatureDescription, newFeatureTitle]);

  const handleToggleVote = useCallback(
    async (card: FeatureBoardCard) => {
      const token = await getAuthToken();
      if (!token) return;

      const previousVoteCount = card.voteCount;
      const previousHasVoted = card.hasVoted;

      setVotePendingIds((current) => {
        const next = new Set(current);
        next.add(card.id);
        return next;
      });

      setCards((current) =>
        current.map((item) =>
          item.id === card.id
            ? {
                ...item,
                hasVoted: !previousHasVoted,
                voteCount: Math.max(
                  0,
                  previousVoteCount + (previousHasVoted ? -1 : 1),
                ),
              }
            : item,
        ),
      );

      try {
        const result = previousHasVoted
          ? await api.unvoteFeature(token, card.id)
          : await api.voteFeature(token, card.id);

        setCards((current) =>
          current.map((item) =>
            item.id === card.id
              ? {
                  ...item,
                  voteCount: result.voteCount,
                  hasVoted: result.hasVoted,
                }
              : item,
          ),
        );
      } catch (e) {
        setCards((current) =>
          current.map((item) =>
            item.id === card.id
              ? {
                  ...item,
                  voteCount: previousVoteCount,
                  hasVoted: previousHasVoted,
                }
              : item,
          ),
        );
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setVotePendingIds((current) => {
          const next = new Set(current);
          next.delete(card.id);
          return next;
        });
      }
    },
    [getAuthToken],
  );

  const handleCardContextMenu = useCallback(
    (
      event: MouseEvent<HTMLDivElement>,
      cardId: string,
      status: FeatureBoardStatus,
    ) => {
      if (!isDeveloper || status !== "suggested") return;
      event.preventDefault();

      const menuWidth = 176;
      const menuHeight = 56;
      const x = Math.max(
        12,
        Math.min(event.clientX, window.innerWidth - menuWidth - 12),
      );
      const y = Math.max(
        12,
        Math.min(event.clientY, window.innerHeight - menuHeight - 12),
      );

      setCardContextMenu({ cardId, x, y });
    },
    [isDeveloper],
  );

  const handleDeleteInboxCard = useCallback(async () => {
    if (!isDeveloper || !cardContextMenu) return;

    const cardToDelete = cards.find((card) => card.id === cardContextMenu.cardId);
    if (!cardToDelete || cardToDelete.status !== "suggested") {
      setCardContextMenu(null);
      return;
    }

    const token = await getAuthToken();
    if (!token) return;

    const previousCards = cards;
    setError(null);
    setDeletePendingCardId(cardToDelete.id);
    setCardContextMenu(null);
    setCards((current) => current.filter((card) => card.id !== cardToDelete.id));

    try {
      await api.deleteFeatureCard(token, cardToDelete.id);
    } catch (e) {
      setCards(previousCards);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeletePendingCardId(null);
    }
  }, [cardContextMenu, cards, getAuthToken, isDeveloper]);

  const handleAssignCardToMe = useCallback(
    async (card: FeatureBoardCard) => {
      if (!isDeveloper) return;
      if (!currentUserId) return;
      if (card.assignedToUserId === currentUserId) return;

      const token = await getAuthToken();
      if (!token) return;

      setAssignPendingIds((current) => {
        const next = new Set(current);
        next.add(card.id);
        return next;
      });
      setError(null);

      try {
        const updated = await api.assignFeatureCardToMe(token, card.id);
        if (updated) {
          setCards((current) =>
            current.map((item) => (item.id === card.id ? updated : item)),
          );
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setAssignPendingIds((current) => {
          const next = new Set(current);
          next.delete(card.id);
          return next;
        });
      }
    },
    [currentUserId, getAuthToken, isDeveloper],
  );

  useEffect(() => {
    if (!cardContextMenu) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCardContextMenu(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cardContextMenu]);

  const handleDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>, cardId: string) => {
      if (!isDeveloper) return;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", cardId);
      setDraggingCardId(cardId);
      setCardContextMenu(null);
      setError(null);
    },
    [isDeveloper],
  );

  const handleDrop = useCallback(
    async (status: FeatureBoardStatus) => {
      if (!isDeveloper || !draggingCardId) return;

      const previousCards = cards;
      const currentColumns = groupCardsByStatus(previousCards);
      const targetIndex = status === "done" ? 0 : currentColumns[status].length;
      const nextColumns = moveCardInColumns(
        currentColumns,
        draggingCardId,
        status,
        targetIndex,
      );

      setDraggingCardId(null);
      setDropTarget(null);

      if (!nextColumns) return;

      const optimisticCards = flattenColumns(nextColumns);
      setCards(optimisticCards);

      try {
        await persistCardOrder(nextColumns);
      } catch (e) {
        setCards(previousCards);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [cards, draggingCardId, isDeveloper, persistCardOrder],
  );

  const handleDropZoneDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>, status: FeatureBoardStatus) => {
      if (!isDeveloper) return;
      event.preventDefault();
      if (!draggingCardId) return;
      if (dropTarget === status) return;
      setDropTarget(status);
    },
    [draggingCardId, dropTarget, isDeveloper],
  );

  const handleDragEnd = useCallback(() => {
    setDraggingCardId(null);
    setDropTarget(null);
  }, []);

  const content = (
    <>
      <div
        className={cn(
          "flex flex-wrap items-center gap-2",
          embedded ? "justify-end" : "justify-between",
        )}
      >
        {!embedded ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => router.push("/")}
            >
              <ArrowLeft className="mr-1 size-4" />
              Dashboard
            </Button>
            <h1 className="text-xl font-semibold text-foreground">Road map</h1>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          {saving ? (
            <span className="text-xs text-muted-foreground">Saving board order...</span>
          ) : null}
          {isDeveloper ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setNewFeatureDialogOpen(true)}
            >
              <Plus className="mr-1 size-4" />
              Add feature card
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void loadCards()}>
            <RefreshCw className="mr-1 size-4" />
            Refresh
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {isDeveloper
          ? "Drag cards between columns. Top votes stay at the top, and Done shows most recent completions first."
          : "View the roadmap and vote for features. Top votes stay at the top, and Done shows most recent completions first."}
      </p>

      {error ? (
        <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Dialog open={newFeatureDialogOpen} onOpenChange={setNewFeatureDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add feature card</DialogTitle>
            <DialogDescription>
              Add a new card to the board inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newFeatureTitle}
              onChange={(event) => setNewFeatureTitle(event.target.value)}
              placeholder="Feature title"
              maxLength={160}
            />
            <Textarea
              value={newFeatureDescription}
              onChange={(event) => setNewFeatureDescription(event.target.value)}
              placeholder="Details (optional)"
              rows={3}
              maxLength={4000}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setNewFeatureDialogOpen(false)}
              disabled={newFeatureSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateFeature()}
              disabled={newFeatureSubmitting}
            >
              {newFeatureSubmitting ? "Adding..." : "Add card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cardContextMenu && isDeveloper ? (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setCardContextMenu(null)}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div
            role="menu"
            aria-label="Inbox card actions"
            className="absolute min-w-44 rounded-md border bg-popover p-1 shadow-md"
            style={{
              left: `${cardContextMenu.x}px`,
              top: `${cardContextMenu.y}px`,
            }}
            onClick={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <button
              type="button"
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60"
              onClick={() => void handleDeleteInboxCard()}
              disabled={deletePendingCardId === cardContextMenu.cardId}
            >
              {deletePendingCardId === cardContextMenu.cardId ? "Deleting..." : "Delete card"}
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <Card>
          <CardContent className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
            <span
              className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
            Loading board...
          </CardContent>
        </Card>
      ) : (
        <div
          className={cn(
            "grid gap-4 md:grid-cols-2",
            visibleColumns.length >= 4 && "xl:grid-cols-4",
            visibleColumns.length === 3 && "xl:grid-cols-3",
          )}
        >
          {visibleColumns.map((column) => {
            const columnCards = cardsByStatus[column.status];
            const showDropOverlay =
              isDeveloper &&
              Boolean(draggingCardId) &&
              dropTarget === column.status;
            return (
              <Card key={column.status} className="min-h-[18rem]">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {column.label} ({columnCards.length})
                  </CardTitle>
                </CardHeader>
                <CardContent
                  className={cn("relative space-y-2", isDeveloper && "min-h-[10rem]")}
                  onDragOver={
                    isDeveloper
                      ? (event) => {
                          handleDropZoneDragOver(event, column.status);
                        }
                      : undefined
                  }
                  onDrop={
                    isDeveloper
                      ? (event) => {
                          event.preventDefault();
                          void handleDrop(column.status);
                        }
                      : undefined
                  }
                >
                  {showDropOverlay ? (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                      <div className="flex h-full w-[92%] items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/50 bg-muted/30">
                        <Plus className="size-16 text-muted-foreground/70" />
                      </div>
                    </div>
                  ) : null}

                  {columnCards.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No feature cards yet.</p>
                  ) : null}

                  {columnCards.map((card) => {
                    const votePending = votePendingIds.has(card.id);
                    const canDeleteFromContextMenu =
                      isDeveloper && column.status === "suggested";
                    const assignPending = assignPendingIds.has(card.id);
                    const assignedToMe =
                      Boolean(currentUserId) && card.assignedToUserId === currentUserId;
                    return (
                      <div
                        key={card.id}
                        draggable={isDeveloper}
                        onDragStart={(event) => handleDragStart(event, card.id)}
                        onDragEnd={handleDragEnd}
                        onContextMenu={
                          canDeleteFromContextMenu
                            ? (event) =>
                                handleCardContextMenu(event, card.id, column.status)
                            : undefined
                        }
                        className={cn(
                          "rounded-md border bg-card p-3 shadow-sm",
                          isDeveloper && "cursor-grab",
                          draggingCardId === card.id && "opacity-50",
                        )}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground">{card.title}</p>
                          {isDeveloper ? (
                            <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                          ) : null}
                        </div>
                        {card.description ? (
                          <p className="mb-2 whitespace-pre-wrap text-sm text-muted-foreground">
                            {card.description}
                          </p>
                        ) : null}
                        <div className="mb-2 text-xs text-muted-foreground">
                          <p>Suggested by {card.suggestedByName}</p>
                          <p>{formatCardDate(card.createdAt)}</p>
                        </div>
                        {isDeveloper && card.assignedToName ? (
                          <p className="mb-2 text-xs text-muted-foreground">
                            Assigned to {card.assignedToName}
                          </p>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={card.hasVoted ? "default" : "outline"}
                            className="h-8 gap-1 px-2"
                            onClick={() => void handleToggleVote(card)}
                            disabled={votePending}
                          >
                            <ThumbsUp className="size-3.5" />
                            {card.voteCount}
                          </Button>
                          {isDeveloper ? (
                            <Button
                              type="button"
                              size="icon"
                              variant={assignedToMe ? "default" : "outline"}
                              className="ml-auto size-8"
                              onClick={() => void handleAssignCardToMe(card)}
                              disabled={assignPending || assignedToMe}
                              title={assignedToMe ? "Assigned to you" : "Assign to me"}
                              aria-label={assignedToMe ? "Assigned to you" : "Assign to me"}
                            >
                              <Plus className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      {content}
    </main>
  );
}
