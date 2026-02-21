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
  const daysUntilWednesday = (3 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + daysUntilWednesday);
  for (let i = 0; i < count; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

function parseIsoDate(value: string | null): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

function clampInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = raw ? Number.parseInt(raw, 10) : fallback;
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export async function GET(request: Request) {
  const user = await getOrSyncUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const groupId = await getMyGroupId(request);
  if (!groupId) {
    return NextResponse.json({ slots: [], removedSlots: [] });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { searchParams } = new URL(request.url);
  const includeRemoved = searchParams.get("includeRemoved") !== "0";
  const startDate = parseIsoDate(searchParams.get("startDate")) ?? today;
  const endDate = parseIsoDate(searchParams.get("endDate")) ?? "9999-12-31";
  const limit = clampInt(searchParams.get("limit"), 8, 1, 104);
  const removedLimit = clampInt(searchParams.get("removedLimit"), 16, 0, 208);
  const hasCustomRange =
    searchParams.get("startDate") != null || searchParams.get("endDate") != null;
  let allSlots = await db
    .select()
    .from(snackSlots)
    .where(eq(snackSlots.groupId, groupId))
    .orderBy(asc(snackSlots.slotDate));

  let activeSlots = allSlots.filter(
    (slot) =>
      !slot.isCancelled &&
      slot.slotDate >= startDate &&
      slot.slotDate <= endDate
  );

  if (!hasCustomRange && activeSlots.length < limit) {
    const existingDates = new Set(allSlots.map((s) => s.slotDate));
    const toCreate = nextMeetingDates(52).filter(
      (d) => d >= today && !existingDates.has(d)
    );
    for (const slotDate of toCreate.slice(0, limit - activeSlots.length)) {
      await db.insert(snackSlots).values({ groupId, slotDate });
    }
    allSlots = await db
      .select()
      .from(snackSlots)
      .where(eq(snackSlots.groupId, groupId))
      .orderBy(asc(snackSlots.slotDate));
    activeSlots = allSlots.filter(
      (slot) =>
        !slot.isCancelled &&
        slot.slotDate >= startDate &&
        slot.slotDate <= endDate
    );
  }

  const slotsWithSignups = await Promise.all(
    activeSlots.map(async (slot) => {
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
              displayName: resolveDisplayName({
                displayName: safeStoredDisplayName,
                email: signup.email,
                fallback: "Member",
              }),
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

  const removedSlots = includeRemoved
    ? allSlots
        .filter(
          (slot) =>
            slot.isCancelled &&
            slot.slotDate >= startDate &&
            slot.slotDate <= endDate
        )
        .map((slot) => ({
          id: slot.id,
          slotDate: slot.slotDate,
          cancellationReason: slot.cancellationReason ?? null,
        }))
        .slice(0, removedLimit)
    : [];

  return NextResponse.json({
    slots: slotsWithSignups.slice(0, limit),
    removedSlots,
  });
}
