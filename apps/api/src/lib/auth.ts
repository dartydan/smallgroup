import { auth, clerkClient, verifyToken } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, groups, groupMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import {
  formatNameFromEmail,
  getDisplayNameFromClerkProfile,
  isGenericDisplayName,
  isIdLikeDisplayName,
  sanitizeDisplayName,
} from "@/lib/display-name";

const DEFAULT_GROUP_NAME = "Small Group";
type DisplayNameSource = "explicit" | "email" | "generic";

function getClaimString(claims: unknown, key: string): string | null {
  if (!claims || typeof claims !== "object") return null;
  const value = (claims as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

async function getClerkProfileDisplayName(userId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const profile = await client.users.getUser(userId);
    return getDisplayNameFromClerkProfile({
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.username,
    });
  } catch {
    return null;
  }
}

function resolveIdentityDisplayName(
  explicitDisplayName: string | null,
  email: string,
  profileDisplayName: string | null
): { displayName: string; displayNameSource: DisplayNameSource } {
  const safeExplicitName = sanitizeDisplayName(explicitDisplayName);
  if (safeExplicitName) {
    return {
      displayName: safeExplicitName,
      displayNameSource: "explicit",
    };
  }

  const safeProfileName = sanitizeDisplayName(profileDisplayName);
  if (safeProfileName) {
    return {
      displayName: safeProfileName,
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

  const email =
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

  // Keep user creation resilient even if session token omits email claims.
  const safeEmail = email ?? `${userId}@clerk.local`;
  const profileDisplayName = await getClerkProfileDisplayName(userId);
  const { displayName, displayNameSource } = resolveIdentityDisplayName(
    explicitDisplayName,
    safeEmail,
    profileDisplayName
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
    const email =
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
    const safeEmail = email ?? `${subject}@clerk.local`;
    const profileDisplayName = await getClerkProfileDisplayName(subject);
    const { displayName, displayNameSource } = resolveIdentityDisplayName(
      explicitDisplayName,
      safeEmail,
      profileDisplayName
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

  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    authId,
    email,
    displayName,
  });
  const isFirstMember = (await db.select().from(groupMembers).where(eq(groupMembers.groupId, group.id))).length === 0;
  await db.insert(groupMembers).values({
    groupId: group.id,
    userId,
    role: isFirstMember ? "admin" : "member",
  });

  const newUser = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  return newUser ?? null;
}

export async function getMyGroupId(request: Request): Promise<string | null> {
  const user = await getOrSyncUser(request);
  if (!user) return null;
  const membership = await db.query.groupMembers.findFirst({
    where: eq(groupMembers.userId, user.id),
    columns: { groupId: true },
  });
  return membership?.groupId ?? null;
}

export async function requireAdmin(request: Request) {
  const user = await requireSyncedUser(request);
  const membership = await db.query.groupMembers.findFirst({
    where: eq(groupMembers.userId, user.id),
    columns: { role: true },
  });
  if (membership?.role !== "admin") {
    throw new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }
  return user;
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
