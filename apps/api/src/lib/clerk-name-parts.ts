import { clerkClient } from "@clerk/nextjs/server";
import { sanitizeDisplayName } from "@/lib/display-name";

export type ClerkNameParts = {
  firstName: string;
  lastName: string;
};

export type ClerkNameLookup = {
  key: string;
  authId: string;
  email: string;
};

const EMPTY_NAME_PARTS: ClerkNameParts = {
  firstName: "",
  lastName: "",
};

const MAX_CONCURRENT_CLERK_LOOKUPS = 4;

function normalizeNamePart(value: string | null | undefined): string {
  return sanitizeDisplayName(value) ?? "";
}

function isLegacyAuthId(authId: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    authId.trim(),
  );
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), values.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]!);
      }
    }),
  );

  return results;
}

async function getLegacyUserByVerifiedEmail(
  client: Awaited<ReturnType<typeof clerkClient>>,
  email: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.endsWith("@clerk.local")) return null;

  const result = await client.users.getUserList({
    emailAddress: [normalizedEmail],
    limit: 2,
  });
  if (result.totalCount !== 1 || result.data.length !== 1) return null;

  const exactVerifiedMatches = result.data.filter((user) =>
    user.emailAddresses.some(
      (emailAddress) =>
        emailAddress.emailAddress.trim().toLowerCase() === normalizedEmail &&
        emailAddress.verification?.status === "verified",
    ),
  );

  return result.totalCount === 1 && exactVerifiedMatches.length === 1
    ? exactVerifiedMatches[0]!
    : null;
}

export async function getClerkNamePartsForUsers(
  lookups: ClerkNameLookup[],
): Promise<Map<string, ClerkNameParts>> {
  const uniqueLookups = Array.from(
    new Map(
      lookups
        .map((lookup) => ({
          key: lookup.key.trim(),
          authId: lookup.authId.trim(),
          email: lookup.email.trim(),
        }))
        .filter((lookup) => lookup.key.length > 0 && lookup.authId.length > 0)
        .map((lookup) => [lookup.key, lookup]),
    ).values(),
  );
  if (uniqueLookups.length === 0) return new Map();

  let client: Awaited<ReturnType<typeof clerkClient>>;
  try {
    client = await clerkClient();
  } catch {
    return new Map();
  }

  const entries = await mapWithConcurrency(
    uniqueLookups,
    MAX_CONCURRENT_CLERK_LOOKUPS,
    async (lookup) => {
      try {
        const user = isLegacyAuthId(lookup.authId)
          ? await getLegacyUserByVerifiedEmail(client, lookup.email)
          : await client.users.getUser(lookup.authId);
        return [
          lookup.key,
          user
            ? {
                firstName: normalizeNamePart(user.firstName),
                lastName: normalizeNamePart(user.lastName),
              }
            : EMPTY_NAME_PARTS,
        ] as const;
      } catch {
        return [lookup.key, EMPTY_NAME_PARTS] as const;
      }
    },
  );

  return new Map(entries);
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

  const entries = await mapWithConcurrency(
    uniqueAuthIds,
    MAX_CONCURRENT_CLERK_LOOKUPS,
    async (authId) => {
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
    },
  );

  return new Map(entries);
}
