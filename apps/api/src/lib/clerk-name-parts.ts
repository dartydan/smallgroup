import { clerkClient } from "@clerk/nextjs/server";

export type ClerkNameParts = {
  firstName: string;
  lastName: string;
};

const EMPTY_NAME_PARTS: ClerkNameParts = {
  firstName: "",
  lastName: "",
};

function normalizeNamePart(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function getClerkNamePartsByAuthIds(
  authIds: string[],
): Promise<Map<string, ClerkNameParts>> {
  const uniqueAuthIds = Array.from(
    new Set(
      authIds
        .map((authId) => authId.trim())
        .filter((authId) => authId.length > 0),
    ),
  );
  if (uniqueAuthIds.length === 0) return new Map();

  let client: Awaited<ReturnType<typeof clerkClient>>;
  try {
    client = await clerkClient();
  } catch {
    return new Map();
  }

  const entries = await Promise.all(
    uniqueAuthIds.map(async (authId) => {
      try {
        const user = await client.users.getUser(authId);
        return [
          authId,
          {
            firstName: normalizeNamePart(user.firstName),
            lastName: normalizeNamePart(user.lastName),
          },
        ] as const;
      } catch {
        return [authId, EMPTY_NAME_PARTS] as const;
      }
    }),
  );

  return new Map(entries);
}

