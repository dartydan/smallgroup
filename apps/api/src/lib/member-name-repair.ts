import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { groupMembers, users } from "@/db/schema";
import { getClerkNamePartsForUsers } from "@/lib/clerk-name-parts";

function isBlank(value: string | null): boolean {
  return !value?.trim();
}

/**
 * Repairs only blank structured name fields for members of one group.
 *
 * Clerk IDs are resolved directly. Legacy Supabase IDs are resolved by the
 * exact verified email on a single Clerk user. Conditional updates ensure that
 * a concurrent profile edit is never overwritten.
 */
export async function repairMissingGroupMemberNames(
  groupId: string,
): Promise<number> {
  const candidates = await db
    .select({
      id: users.id,
      authId: users.authId,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(
      and(
        eq(groupMembers.groupId, groupId),
        or(
          sql`coalesce(btrim(${users.firstName}), '') = ''`,
          sql`coalesce(btrim(${users.lastName}), '') = ''`,
        ),
      ),
    )
    .limit(50);

  if (candidates.length === 0) return 0;

  const clerkNamesByUserId = await getClerkNamePartsForUsers(
    candidates.map((candidate) => ({
      key: candidate.id,
      authId: candidate.authId,
      email: candidate.email,
    })),
  );

  let repairedFieldCount = 0;
  for (const candidate of candidates) {
    const clerkNames = clerkNamesByUserId.get(candidate.id);
    if (!clerkNames) continue;
    const normalizedEmail = candidate.email.trim().toLowerCase();

    if (isBlank(candidate.firstName) && clerkNames.firstName) {
      const updatedRows = await db
        .update(users)
        .set({
          firstName: clerkNames.firstName,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, candidate.id),
            eq(users.authId, candidate.authId),
            sql`lower(btrim(${users.email})) = ${normalizedEmail}`,
            sql`coalesce(btrim(${users.firstName}), '') = ''`,
          ),
        )
        .returning({ id: users.id });
      repairedFieldCount += updatedRows.length;
    }

    if (isBlank(candidate.lastName) && clerkNames.lastName) {
      const updatedRows = await db
        .update(users)
        .set({
          lastName: clerkNames.lastName,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(users.id, candidate.id),
            eq(users.authId, candidate.authId),
            sql`lower(btrim(${users.email})) = ${normalizedEmail}`,
            sql`coalesce(btrim(${users.lastName}), '') = ''`,
          ),
        )
        .returning({ id: users.id });
      repairedFieldCount += updatedRows.length;
    }
  }

  return repairedFieldCount;
}
