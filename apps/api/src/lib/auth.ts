import { auth, clerkClient, verifyToken } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, groups, groupMembers } from "@/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  formatNameFromEmail,
  isGenericDisplayName,
  isIdLikeDisplayName,
  sanitizeDisplayName,
} from "@/lib/display-name";

const DEFAULT_GROUP_NAME = "Small Group";
const GROUP_ID_HEADER = "x-group-id";
const GROUP_ID_QUERY_PARAM = "groupId";
type DisplayNameSource = "explicit" | "email" | "generic";
export type GroupMembership = {
  groupId: string;
  role: "admin" | "member";
  canEditEventsAnnouncements: boolean;
};

export type UserGroupMembership = GroupMembership & {
  groupName: string;
};

type GroupRole = GroupMembership["role"] | null;
type DeveloperIdentity = {
  authId: string;
  email: string;
};

function getClaimString(claims: unknown, key: string): string | null {
  if (!claims || typeof claims !== "object") return null;
  const value = (claims as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isClerkFallbackEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  return email.trim().toLowerCase().endsWith("@clerk.local");
}

async function resolveIdentityEmail(
  authId: string,
  claimEmail: string | null,
): Promise<string> {
  const normalizedClaimEmail = claimEmail?.trim() || null;
  if (normalizedClaimEmail && !isClerkFallbackEmail(normalizedClaimEmail)) {
    return normalizedClaimEmail;
  }

  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(authId);
    const primaryEmail =
      (clerkUser.primaryEmailAddressId
        ? clerkUser.emailAddresses.find(
            (emailAddress) => emailAddress.id === clerkUser.primaryEmailAddressId,
          )?.emailAddress
        : null) ?? clerkUser.emailAddresses[0]?.emailAddress ?? null;
    if (primaryEmail && primaryEmail.trim().length > 0) {
      return primaryEmail.trim();
    }
  } catch {
    // Fall back to available token claim or local placeholder.
  }

  return normalizedClaimEmail ?? `${authId}@clerk.local`;
}

function parseListEnvValue(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function isDeveloperUser(
  user: DeveloperIdentity,
  role: GroupRole,
) {
  const allowedAuthIds = parseListEnvValue(process.env.DEVELOPER_AUTH_IDS);
  const allowedEmails = parseListEnvValue(process.env.DEVELOPER_EMAILS).map((email) =>
    email.toLowerCase(),
  );

  if (allowedAuthIds.length > 0 || allowedEmails.length > 0) {
    if (allowedAuthIds.includes(user.authId)) return true;
    return allowedEmails.includes(user.email.trim().toLowerCase());
  }

  return role === "admin";
}

function resolveIdentityDisplayName(
  explicitDisplayName: string | null,
  email: string,
): { displayName: string; displayNameSource: DisplayNameSource } {
  const safeExplicitName = sanitizeDisplayName(explicitDisplayName);
  if (safeExplicitName) {
    return {
      displayName: safeExplicitName,
      displayNameSource: "explicit",
    };
  }

  const emailDerivedName = formatNameFromEmail(email, "Member");
  if (!isGenericDisplayName(emailDerivedName) && !isIdLikeDisplayName(emailDerivedName)) {
    return {
      displayName: emailDerivedName,
      displayNameSource: "email",
    };
  }

  return { displayName: "Member", displayNameSource: "generic" };
}

async function getClerkIdentity() {
  let userId: string | null = null;
  let sessionClaims: unknown;
  try {
    const authState = await auth();
    userId = authState.userId;
    sessionClaims = authState.sessionClaims;
  } catch {
    return null;
  }
  if (!userId) return null;

  const claimEmail =
    getClaimString(sessionClaims, "email") ??
    getClaimString(sessionClaims, "email_address") ??
    getClaimString(sessionClaims, "primary_email_address");

  const firstName =
    getClaimString(sessionClaims, "first_name") ??
    getClaimString(sessionClaims, "given_name");
  const lastName =
    getClaimString(sessionClaims, "last_name") ??
    getClaimString(sessionClaims, "family_name");
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  const explicitDisplayName =
    fullName ||
    getClaimString(sessionClaims, "name") ||
    getClaimString(sessionClaims, "username");

  const safeEmail = await resolveIdentityEmail(userId, claimEmail);
  const { displayName, displayNameSource } = resolveIdentityDisplayName(
    explicitDisplayName,
    safeEmail,
  );

  return { authId: userId, email: safeEmail, displayName, displayNameSource };
}

async function getClerkIdentityFromBearer(request: Request) {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const result = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const claims = result.data as Record<string, unknown> | undefined;
    const subject = claims && typeof claims.sub === "string" ? claims.sub : null;
    if (!subject) return null;
    const claimEmail =
      getClaimString(claims, "email") ??
      getClaimString(claims, "email_address") ??
      getClaimString(claims, "primary_email_address");
    const firstName =
      getClaimString(claims, "first_name") ??
      getClaimString(claims, "given_name");
    const lastName =
      getClaimString(claims, "last_name") ??
      getClaimString(claims, "family_name");
    const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
    const explicitDisplayName =
      fullName ||
      getClaimString(claims, "name") ||
      getClaimString(claims, "username");
    const safeEmail = await resolveIdentityEmail(subject, claimEmail);
    const { displayName, displayNameSource } = resolveIdentityDisplayName(
      explicitDisplayName,
      safeEmail,
    );

    return {
      authId: subject,
      email: safeEmail,
      displayName,
      displayNameSource,
    };
  } catch {
    return null;
  }
}

function getRequestedGroupId(request: Request): string | null {
  const headerValue = request.headers.get(GROUP_ID_HEADER)?.trim();
  if (headerValue) return headerValue;

  try {
    const queryValue = new URL(request.url)
      .searchParams.get(GROUP_ID_QUERY_PARAM)
      ?.trim();
    return queryValue || null;
  } catch {
    return null;
  }
}

async function getMembershipForRequest(
  userId: string,
  request: Request,
): Promise<GroupMembership | null> {
  const requestedGroupId = getRequestedGroupId(request);
  if (requestedGroupId) {
    const explicitMembership = await db.query.groupMembers.findFirst({
      where: and(
        eq(groupMembers.userId, userId),
        eq(groupMembers.groupId, requestedGroupId),
      ),
      columns: {
        groupId: true,
        role: true,
        canEditEventsAnnouncements: true,
      },
    });
    if (explicitMembership) {
      return explicitMembership;
    }
  }

  const [defaultMembership] = await db
    .select({
      groupId: groupMembers.groupId,
      role: groupMembers.role,
      canEditEventsAnnouncements: groupMembers.canEditEventsAnnouncements,
    })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groupMembers.joinedAt), asc(groupMembers.groupId))
    .limit(1);

  return defaultMembership ?? null;
}

export async function getOrSyncUser(request: Request) {
  const identity = (await getClerkIdentity()) ?? (await getClerkIdentityFromBearer(request));
  if (!identity) return null;
  const { authId, email, displayName } = identity;

  const existing = await db.query.users.findFirst({
    where: eq(users.authId, authId),
  });

  if (existing) {
    const nextDisplayName = (isGenericDisplayName(existing.displayName) || isIdLikeDisplayName(existing.displayName))
      ? displayName
      : existing.displayName;

    if (existing.email !== email || existing.displayName !== nextDisplayName) {
      await db
        .update(users)
        .set({
          email,
          displayName: nextDisplayName,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      const updated = await db.query.users.findFirst({
        where: eq(users.id, existing.id),
      });
      return updated ?? existing;
    }

    return existing;
  }

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    authId,
    email,
    displayName,
  });

  const existingMember = await db.query.groupMembers.findFirst({
    columns: { id: true },
  });
  // Bootstrap only the very first account as a leader so subsequent users
  // are leader-added instead of auto-joined.
  if (!existingMember) {
    let group = await db.query.groups.findFirst({
      where: eq(groups.name, DEFAULT_GROUP_NAME),
    });
    if (!group) {
      const [inserted] = await db
        .insert(groups)
        .values({ id: randomUUID(), name: DEFAULT_GROUP_NAME })
        .returning();
      group = inserted!;
    }

    await db.insert(groupMembers).values({
      groupId: group.id,
      userId,
      role: "admin",
    });
  }

  const newUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  return newUser ?? null;
}

export async function getMyGroupMembership(
  request: Request,
): Promise<GroupMembership | null> {
  const user = await getOrSyncUser(request);
  if (!user) return null;
  return getMembershipForRequest(user.id, request);
}

export async function getUserGroupMemberships(
  userId: string,
): Promise<UserGroupMembership[]> {
  const rows = await db
    .select({
      groupId: groupMembers.groupId,
      role: groupMembers.role,
      canEditEventsAnnouncements: groupMembers.canEditEventsAnnouncements,
      groupName: groups.name,
    })
    .from(groupMembers)
    .innerJoin(groups, eq(groupMembers.groupId, groups.id))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groups.name), asc(groupMembers.joinedAt));

  return rows.map((row) => ({
    groupId: row.groupId,
    role: row.role,
    canEditEventsAnnouncements: row.canEditEventsAnnouncements,
    groupName: row.groupName,
  }));
}

type SyncedUser = NonNullable<Awaited<ReturnType<typeof getOrSyncUser>>>;

export type RequestAuthContext = {
  user: SyncedUser;
  membership: GroupMembership | null;
  memberships: UserGroupMembership[];
};

export async function getRequestAuthContext(
  request: Request,
): Promise<RequestAuthContext | null> {
  const user = await getOrSyncUser(request);
  if (!user) return null;

  const [membership, memberships] = await Promise.all([
    getMembershipForRequest(user.id, request),
    getUserGroupMemberships(user.id),
  ]);

  return {
    user,
    membership,
    memberships,
  };
}

export async function getMyGroupId(request: Request): Promise<string | null> {
  const membership = await getMyGroupMembership(request);
  return membership?.groupId ?? null;
}

export async function requireAdmin(request: Request) {
  const user = await requireSyncedUser(request);
  const membership = await getMembershipForRequest(user.id, request);
  if (membership?.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}

export async function requireEventsAnnouncementsEditor(request: Request) {
  const user = await requireSyncedUser(request);
  const membership = await getMembershipForRequest(user.id, request);
  if (!membership) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (membership.role !== "admin" && !membership.canEditEventsAnnouncements) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { user, membership };
}

export async function requireDeveloper(request: Request) {
  const user = await requireSyncedUser(request);
  const memberships = await getUserGroupMemberships(user.id);
  const hasAnyAdminMembership = memberships.some(
    (membership) => membership.role === "admin",
  );
  if (!isDeveloperUser(user, hasAnyAdminMembership ? "admin" : null)) {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return { user, membership: null };
}

export async function requireSyncedUser(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
}
