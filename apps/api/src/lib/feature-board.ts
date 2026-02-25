import { featureBoardCards } from "@/db/schema";

export const FEATURE_BOARD_STATUS_ORDER = [
  "suggested",
  "planned",
  "in_progress",
  "done",
] as const;

export type FeatureBoardStatus = (typeof FEATURE_BOARD_STATUS_ORDER)[number];
export type FeatureBoardCardRow = typeof featureBoardCards.$inferSelect;
export type FeatureBoardCardDto = {
  id: string;
  title: string;
  description: string | null;
  status: FeatureBoardStatus;
  position: number;
  voteCount: number;
  hasVoted: boolean;
  suggestedByName: string;
  suggestedByEmail: string;
  assignedToUserId: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
};

const FEATURE_BOARD_STATUS_INDEX = new Map<FeatureBoardStatus, number>(
  FEATURE_BOARD_STATUS_ORDER.map((status, index) => [status, index]),
);

export function isFeatureBoardStatus(value: unknown): value is FeatureBoardStatus {
  return (
    typeof value === "string" &&
    FEATURE_BOARD_STATUS_ORDER.includes(value as FeatureBoardStatus)
  );
}

export function sortFeatureBoardRows(
  rows: FeatureBoardCardRow[],
  options: {
    voteCountByCardId?: ReadonlyMap<string, number>;
  } = {},
): FeatureBoardCardRow[] {
  const voteCountByCardId = options.voteCountByCardId;
  return [...rows].sort((a, b) => {
    const statusDelta =
      (FEATURE_BOARD_STATUS_INDEX.get(a.status) ?? 0) -
      (FEATURE_BOARD_STATUS_INDEX.get(b.status) ?? 0);
    if (statusDelta !== 0) return statusDelta;

    if (a.status === "done" && b.status === "done") {
      const sortDelta = a.sortOrder - b.sortOrder;
      if (sortDelta !== 0) return sortDelta;

      const updatedDelta = b.updatedAt.getTime() - a.updatedAt.getTime();
      if (updatedDelta !== 0) return updatedDelta;

      return b.createdAt.getTime() - a.createdAt.getTime();
    }

    const votesDelta =
      (voteCountByCardId?.get(b.id) ?? 0) - (voteCountByCardId?.get(a.id) ?? 0);
    if (votesDelta !== 0) return votesDelta;

    const sortDelta = a.sortOrder - b.sortOrder;
    if (sortDelta !== 0) return sortDelta;

    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

export function toFeatureBoardCardDto(
  row: FeatureBoardCardRow,
  options: {
    voteCount?: number;
    hasVoted?: boolean;
  } = {},
): FeatureBoardCardDto {
  const voteCount = Math.max(0, options.voteCount ?? 0);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    position: row.sortOrder,
    voteCount,
    hasVoted: options.hasVoted === true,
    suggestedByName: row.suggestedByName,
    suggestedByEmail: row.suggestedByEmail,
    assignedToUserId: row.assignedToUserId,
    assignedToName: row.assignedToName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function parseFeatureBoardColumns(
  input: unknown,
): Record<FeatureBoardStatus, string[]> | null {
  if (!input || typeof input !== "object") return null;

  const raw = input as Record<string, unknown>;
  const parsed: Record<FeatureBoardStatus, string[]> = {
    suggested: [],
    planned: [],
    in_progress: [],
    done: [],
  };

  for (const status of FEATURE_BOARD_STATUS_ORDER) {
    const value = raw[status];
    if (!Array.isArray(value)) return null;

    const ids = value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);

    if (ids.length !== value.length) return null;
    parsed[status] = ids;
  }

  return parsed;
}
