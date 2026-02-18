import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, groups, groupMembers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

const DEFAULT_GROUP_NAME = "Small Group";

async function getClerkIdentity() {
  const { userId } = await auth();
  if (!userId) return null;
  try {
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email =
      clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      clerkUser.emailAddresses[0]?.emailAddress ??
      "";
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
    const displayName = fullName || clerkUser.username || email || "Member";
    return { authId: clerkUser.id, email, displayName };
  } catch {
    return null;
  }
}

export async function getOrSyncUser(_request: Request) {
  const identity = await getClerkIdentity();
  if (!identity) return null;
  const { authId, email, displayName } = identity;

  const existing = await db.query.users.findFirst({
    where: eq(users.authId, authId),
  });

  if (existing) {
    await db
      .update(users)
      .set({
        email,
        displayName: displayName || existing.displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    const updated = await db.query.users.findFirst({
      where: eq(users.id, existing.id),
    });
    return updated ?? existing;
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
    displayName: displayName || "Member",
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
