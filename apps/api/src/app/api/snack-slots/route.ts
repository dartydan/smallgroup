import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { snackSlots, snackSignups, users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { getOrSyncUser, getMyGroupId } from "@/lib/auth";
import {
  getDisplayNameFromClerkProfile,
  resolveDisplayName,
  sanitizeDisplayName,
} from "@/lib/display-name";

async function getNameFromClerkByAuthId(
  authId: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  if (cache.has(authId)) return cache.get(authId) ?? null;
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(authId);
    const name = getDisplayNameFromClerkProfile({
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
    });
    cache.set(authId, name);
    return name;
  } catch {
    cache.set(authId, null);
    return null;
  }
}

function nextMeetingDates(count: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ slots: [] });
  }

  const today = new Date().toISOString().slice(0, 10);
  let slots = await db
    .select()
    .from(snackSlots)
    .where(eq(snackSlots.groupId, groupId))
    .orderBy(asc(snackSlots.slotDate));

  if (slots.length < 8) {
    const existingDates = new Set(slots.map((s) => s.slotDate));
    const toCreate = nextMeetingDates(12).filter(
      (d) => d >= today && !existingDates.has(d)
    );
    for (const slotDate of toCreate.slice(0, 8 - slots.length)) {
      await db.insert(snackSlots).values({ groupId, slotDate });
    }
    slots = await db
      .select()
      .from(snackSlots)
      .where(eq(snackSlots.groupId, groupId))
      .orderBy(asc(snackSlots.slotDate));
  }

  const slotsWithSignups = await Promise.all(
    slots.map(async (slot) => {
      const rawSignups = await db
        .select({
          id: users.id,
          authId: users.authId,
          displayName: users.displayName,
          email: users.email,
        })
        .from(snackSignups)
        .innerJoin(users, eq(snackSignups.userId, users.id))
        .where(eq(snackSignups.slotId, slot.id));

      const clerkNameCache = new Map<string, string | null>();
      const signups = await Promise.all(
        rawSignups.map(async (signup) => {
          const safeStoredDisplayName = sanitizeDisplayName(signup.displayName);
          if (safeStoredDisplayName) {
            return {
              id: signup.id,
              displayName: safeStoredDisplayName,
              email: signup.email,
            };
          }

          const clerkName = await getNameFromClerkByAuthId(signup.authId, clerkNameCache);
          return {
            id: signup.id,
            displayName: resolveDisplayName({
              displayName: clerkName,
              email: signup.email,
              fallback: "Member",
            }),
            email: signup.email,
          };
        })
      );

      return {
        id: slot.id,
        slotDate: slot.slotDate,
        signups,
      };
    })
  );

  return NextResponse.json({
    slots: slotsWithSignups.filter((s) => s.slotDate >= today).slice(0, 8),
  });
}
