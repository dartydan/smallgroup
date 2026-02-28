import { NextResponse } from "next/server";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  announcements,
  discussionTopics,
  groupJoinRequests,
  groupMembers,
  groups,
  prayerRequestActivity,
  prayerRequestRecipients,
  prayerRequests,
  snackSignups,
  snackSlots,
  users,
  verseHighlights,
  verseMemory,
  verseMemoryProgress,
} from "@/db/schema";
import {
  getRequestAuthContext,
  isDeveloperUser,
  isLeadDeveloperUser,
  type UserGroupMembership,
} from "@/lib/auth";
import {
  formatNameFromEmail,
  resolveDisplayName,
  sanitizeDisplayName,
} from "@/lib/display-name";
import {
  addDaysToDateKey,
  buildDateKey,
  dayDiffFromDateKeys,
  getMonthYearInTimeZone,
  getTodayDateKeyInTimeZone,
  getWeekdayFromDateKey,
} from "@/lib/timezone";
import { getCalendarEventsWindow } from "@/lib/calendar-events";

type IncludeMode = "core" | "secondary";
type PrayerVisibility = "everyone" | "my_gender" | "specific_people";
type NameProfile = {
  displayName: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function parseIncludeMode(value: string | null): IncludeMode | null {
  if (value === "core" || value === "secondary") return value;
  return null;
}

function resolveMemberDisplayName(
  displayName: string | null,
  email: string,
): string {
  return sanitizeDisplayName(displayName) ?? formatNameFromEmail(email, "Member");
}

function hasVowel(value: string): boolean {
  return /[aeiouy]/i.test(value);
}

function isConsonant(value: string): boolean {
  return /^[a-z]$/i.test(value) && !hasVowel(value);
}

function toTitleCase(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function findSingleTokenNameSplitIndex(token: string): number | null {
  if (!/^[a-z]+$/i.test(token) || token.length < 8) return null;
  const length = token.length;

  let bestIndex: number | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 3; index <= length - 3; index += 1) {
    const left = token.slice(0, index);
    const right = token.slice(index);
    let score = 0;

    if (isConsonant(right.charAt(0))) score += 2;
    if (isConsonant(left.charAt(left.length - 1))) score += 1;
    if (left.length >= 3 && left.length <= 7) score += 1;
    if (right.length >= 3 && right.length <= 9) score += 1;
    if (hasVowel(left)) score += 1;
    if (hasVowel(right)) score += 1;

    score -= Math.abs(index - length * 0.45) * 0.35;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  if (bestIndex === null || bestScore < 4) return null;
  return bestIndex;
}

function resolveMemberNameParts(args: {
  displayName: string | null;
  email: string;
  clerkFirstName?: string | null;
  clerkLastName?: string | null;
}) {
  const resolvedDisplayName = resolveMemberDisplayName(args.displayName, args.email);
  const displayTokens = resolvedDisplayName
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  let fallbackFirstName = displayTokens[0] ?? "Member";
  let fallbackLastName = displayTokens.slice(1).join(" ");

  if (displayTokens.length === 1) {
    const singleToken = displayTokens[0] ?? "Member";
    const splitIndex = findSingleTokenNameSplitIndex(singleToken);
    if (splitIndex !== null) {
      fallbackFirstName = toTitleCase(singleToken.slice(0, splitIndex));
      fallbackLastName = toTitleCase(singleToken.slice(splitIndex));
    }
  }

  return {
    displayName: resolvedDisplayName,
    firstName: args.clerkFirstName?.trim() || fallbackFirstName,
    lastName: args.clerkLastName?.trim() || fallbackLastName,
  };
}

function getNameCompletenessScore(name: NameProfile): number {
  let score = 0;
  if (name.firstName?.trim()) score += 2;
  if (name.lastName?.trim()) score += 2;
  if (sanitizeDisplayName(name.displayName)) score += 1;
  return score;
}

function pickPreferredNameProfile(primary: NameProfile, alternate?: NameProfile | null): NameProfile {
  if (!alternate) return primary;
  return getNameCompletenessScore(alternate) > getNameCompletenessScore(primary)
    ? alternate
    : primary;
}

function getBirthdayDayOffset(
  month: number | null,
  day: number | null,
  pastWindow: number,
  now = new Date(),
): number | null {
  if (month == null || day == null) return null;
  const todayDateKey = getTodayDateKeyInTimeZone(now);
  const current = getMonthYearInTimeZone(now);
  const thisYearBirthdayDateKey = buildDateKey(current.year, month, day);
  if (!thisYearBirthdayDateKey) return null;

  const thisYearOffset = dayDiffFromDateKeys(todayDateKey, thisYearBirthdayDateKey);
  if (thisYearOffset >= 0) {
    return thisYearOffset;
  }

  const daysAgo = Math.abs(thisYearOffset);
  if (daysAgo <= pastWindow) {
    return -daysAgo;
  }

  const nextYearBirthdayDateKey = buildDateKey(current.year + 1, month, day);
  if (!nextYearBirthdayDateKey) return null;
  return dayDiffFromDateKeys(todayDateKey, nextYearBirthdayDateKey);
}

function nextMeetingDates(count: number, fromDateKey: string): string[] {
  const out: string[] = [];
  const daysUntilWednesday = (3 - getWeekdayFromDateKey(fromDateKey) + 7) % 7;
  let dateKey = addDaysToDateKey(fromDateKey, daysUntilWednesday);
  for (let index = 0; index < count; index += 1) {
    out.push(dateKey);
    dateKey = addDaysToDateKey(dateKey, 7);
  }
  return out;
}

async function getGroupDirectory(
  userId: string,
  memberships: UserGroupMembership[],
) {
  const [requestRows, groupRows] = await Promise.all([
    db
      .select({
        groupId: groupJoinRequests.groupId,
        status: groupJoinRequests.status,
      })
      .from(groupJoinRequests)
      .where(eq(groupJoinRequests.userId, userId)),
    db
      .select({
        id: groups.id,
        name: groups.name,
        createdAt: groups.createdAt,
        memberCount: sql<number>`cast(count(${groupMembers.id}) as integer)`,
      })
      .from(groups)
      .leftJoin(groupMembers, eq(groupMembers.groupId, groups.id))
      .groupBy(groups.id)
      .orderBy(asc(groups.name)),
  ]);

  const roleByGroupId = new Map(
    memberships.map((membership) => [membership.groupId, membership.role]),
  );
  const requestStatusByGroupId = new Map(
    requestRows.map((request) => [request.groupId, request.status]),
  );

  return groupRows.map((group) => {
    const myRole = roleByGroupId.get(group.id) ?? null;
    const requestStatus = requestStatusByGroupId.get(group.id) ?? null;
    return {
      id: group.id,
      name: group.name,
      createdAt: group.createdAt,
      memberCount: group.memberCount,
      myRole,
      requestStatus,
      canRequest: myRole === null && requestStatus !== "pending",
    };
  });
}

async function getCorePayload(params: {
  activeGroupId: string | null;
}) {
  const { activeGroupId } = params;

  let members: Array<{
    id: string;
    displayName: string;
    firstName: string;
    lastName: string;
    email: string;
    birthdayMonth: number | null;
    birthdayDay: number | null;
    role: "admin" | "member";
    canEditEventsAnnouncements: boolean;
    isDeveloper: boolean;
  }> = [];
  let announcementItems: typeof announcements.$inferSelect[] = [];
  let snackSlotItems: Array<{
    id: string;
    slotDate: string;
    signups: Array<{
      id: string;
      displayName: string;
      email: string;
      createdAt: Date;
    }>;
  }> = [];
  let removedSnackSlots: Array<{
    id: string;
    slotDate: string;
    cancellationReason: string | null;
  }> = [];
  let topic: typeof discussionTopics.$inferSelect | null = null;

  if (activeGroupId) {
    const memberRows = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        birthdayMonth: users.birthdayMonth,
        birthdayDay: users.birthdayDay,
        role: groupMembers.role,
        canEditEventsAnnouncements: groupMembers.canEditEventsAnnouncements,
        isDeveloper: users.isDeveloper,
      })
      .from(groupMembers)
      .innerJoin(users, eq(groupMembers.userId, users.id))
      .where(eq(groupMembers.groupId, activeGroupId));

    const memberEmails = Array.from(
      new Set(memberRows.map((member) => member.email.trim().toLowerCase()).filter(Boolean)),
    );
    const relatedUsersByEmail =
      memberEmails.length === 0
        ? []
        : await db
            .select({
              email: users.email,
              displayName: users.displayName,
              firstName: users.firstName,
              lastName: users.lastName,
            })
            .from(users)
            .where(inArray(sql`lower(${users.email})`, memberEmails));
    const bestNameByEmail = new Map<string, NameProfile>();
    for (const relatedUser of relatedUsersByEmail) {
      const key = relatedUser.email.trim().toLowerCase();
      const currentBest = bestNameByEmail.get(key);
      if (!currentBest) {
        bestNameByEmail.set(key, relatedUser);
        continue;
      }
      if (getNameCompletenessScore(relatedUser) > getNameCompletenessScore(currentBest)) {
        bestNameByEmail.set(key, relatedUser);
      }
    }

    members = memberRows.map((member) => {
      const emailKey = member.email.trim().toLowerCase();
      const bestName = bestNameByEmail.get(emailKey);
      const preferredName = pickPreferredNameProfile(
        {
          displayName: member.displayName,
          firstName: member.firstName,
          lastName: member.lastName,
        },
        bestName,
      );
      const { displayName, firstName, lastName } = resolveMemberNameParts({
        displayName: preferredName.displayName,
        email: member.email,
        clerkFirstName: preferredName.firstName ?? null,
        clerkLastName: preferredName.lastName ?? null,
      });
      return {
        id: member.id,
        displayName,
        firstName,
        lastName,
        email: member.email,
        birthdayMonth: member.birthdayMonth,
        birthdayDay: member.birthdayDay,
        role: member.role,
        canEditEventsAnnouncements: member.canEditEventsAnnouncements,
        isDeveloper: member.isDeveloper,
      };
    });

    announcementItems = await db
      .select()
      .from(announcements)
      .where(eq(announcements.groupId, activeGroupId))
      .orderBy(desc(announcements.createdAt));

    const today = getTodayDateKeyInTimeZone();
    const limit = 8;
    const removedLimit = 16;

    let allSlots = await db
      .select()
      .from(snackSlots)
      .where(eq(snackSlots.groupId, activeGroupId))
      .orderBy(asc(snackSlots.slotDate));

    let activeSlots = allSlots.filter((slot) => !slot.isCancelled && slot.slotDate >= today);
    if (activeSlots.length < limit) {
      const existingDates = new Set(allSlots.map((slot) => slot.slotDate));
      const toCreate = nextMeetingDates(52, today).filter(
        (dateKey) => dateKey >= today && !existingDates.has(dateKey),
      );
      for (const slotDate of toCreate.slice(0, limit - activeSlots.length)) {
        await db.insert(snackSlots).values({ groupId: activeGroupId, slotDate });
      }

      allSlots = await db
        .select()
        .from(snackSlots)
        .where(eq(snackSlots.groupId, activeGroupId))
        .orderBy(asc(snackSlots.slotDate));
      activeSlots = allSlots.filter(
        (slot) => !slot.isCancelled && slot.slotDate >= today,
      );
    }

    const visibleActiveSlots = activeSlots.slice(0, limit);
    const slotIds = visibleActiveSlots.map((slot) => slot.id);
    const signupRows =
      slotIds.length === 0
        ? []
        : await db
            .select({
              slotId: snackSignups.slotId,
              id: users.id,
              displayName: users.displayName,
              email: users.email,
              createdAt: snackSignups.createdAt,
            })
            .from(snackSignups)
            .innerJoin(users, eq(snackSignups.userId, users.id))
            .where(inArray(snackSignups.slotId, slotIds));

    const signupsBySlotId = new Map<
      string,
      Array<{ id: string; displayName: string; email: string; createdAt: Date }>
    >();
    for (const row of signupRows) {
      const current = signupsBySlotId.get(row.slotId) ?? [];
      current.push({
        id: row.id,
        displayName: resolveDisplayName({
          displayName: row.displayName,
          email: row.email,
          fallback: "Member",
        }),
        email: row.email,
        createdAt: row.createdAt,
      });
      signupsBySlotId.set(row.slotId, current);
    }

    snackSlotItems = visibleActiveSlots.map((slot) => ({
      id: slot.id,
      slotDate: slot.slotDate,
      signups: signupsBySlotId.get(slot.id) ?? [],
    }));

    removedSnackSlots = allSlots
      .filter((slot) => slot.isCancelled && slot.slotDate >= today)
      .map((slot) => ({
        id: slot.id,
        slotDate: slot.slotDate,
        cancellationReason: slot.cancellationReason ?? null,
      }))
      .slice(0, removedLimit);

    const { month, year } = getMonthYearInTimeZone(new Date());
    topic =
      (await db.query.discussionTopics.findFirst({
        where: and(
          eq(discussionTopics.groupId, activeGroupId),
          eq(discussionTopics.month, month),
          eq(discussionTopics.year, year),
        ),
      })) ?? null;
  }

  return {
    members,
    announcements: announcementItems,
    snackSlots: snackSlotItems,
    removedSnackSlots,
    discussionTopic: topic,
  };
}

async function getSecondaryPayload(params: {
  userId: string;
  userGender: "male" | "female" | null;
  activeGroupId: string | null;
  activeRole: "admin" | "member" | null;
  isLeadDeveloper: boolean;
}) {
  const { userId, userGender, activeGroupId, activeRole, isLeadDeveloper } = params;

  const { items: calendarEvents } = await getCalendarEventsWindow();

  if (!activeGroupId) {
    return {
      upcomingBirthdays: [],
      prayerRequests: [],
      recentVerseHighlights: [],
      verseMemory: [],
      calendarEvents,
      groupJoinRequests: [],
    };
  }

  const now = new Date();
  const birthdaysWithin = 14;
  const birthdaysPast = 3;

  const birthdayMembers = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      birthdayMonth: users.birthdayMonth,
      birthdayDay: users.birthdayDay,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.userId, users.id))
    .where(eq(groupMembers.groupId, activeGroupId));

  const upcomingBirthdays = birthdayMembers
    .map((member) => {
      const daysUntil = getBirthdayDayOffset(
        member.birthdayMonth,
        member.birthdayDay,
        birthdaysPast,
        now,
      );
      return {
        id: member.id,
        displayName: resolveDisplayName({
          displayName: member.displayName,
          email: member.email,
          fallback: "A group member",
        }),
        birthdayMonth: member.birthdayMonth,
        birthdayDay: member.birthdayDay,
        daysUntil,
      };
    })
    .filter(
      (member) =>
        member.daysUntil != null &&
        member.daysUntil >= -birthdaysPast &&
        member.daysUntil <= birthdaysWithin,
    )
    .sort((a, b) => (a.daysUntil ?? 0) - (b.daysUntil ?? 0))
    .map((member) => ({
      id: member.id,
      displayName: member.displayName,
      birthdayMonth: member.birthdayMonth,
      birthdayDay: member.birthdayDay,
      daysUntil: member.daysUntil ?? 0,
    }));

  const prayerRows = await db
    .select({
      id: prayerRequests.id,
      authorId: prayerRequests.authorId,
      content: prayerRequests.content,
      isPrivate: prayerRequests.isPrivate,
      visibility: prayerRequests.visibility,
      prayed: prayerRequests.prayed,
      createdAt: prayerRequests.createdAt,
      authorName: users.displayName,
      authorEmail: users.email,
      authorGender: users.gender,
    })
    .from(prayerRequests)
    .leftJoin(users, eq(prayerRequests.authorId, users.id))
    .where(eq(prayerRequests.groupId, activeGroupId))
    .orderBy(desc(prayerRequests.createdAt));

  const prayerIds = prayerRows.map((row) => row.id);
  const recipientRows =
    prayerIds.length === 0
      ? []
      : await db
          .select({
            prayerRequestId: prayerRequestRecipients.prayerRequestId,
            userId: prayerRequestRecipients.userId,
          })
          .from(prayerRequestRecipients)
          .where(inArray(prayerRequestRecipients.prayerRequestId, prayerIds));

  const recipientIdsByPrayer = new Map<string, Set<string>>();
  recipientRows.forEach((row) => {
    const current = recipientIdsByPrayer.get(row.prayerRequestId) ?? new Set<string>();
    current.add(row.userId);
    recipientIdsByPrayer.set(row.prayerRequestId, current);
  });

  const filteredPrayers = prayerRows
    .filter((row) => {
      if (isLeadDeveloper) return true;
      if (row.authorId === userId) return true;

      const visibility: PrayerVisibility =
        row.visibility ?? (row.isPrivate ? "specific_people" : "everyone");
      if (visibility === "everyone") return true;

      if (visibility === "my_gender") {
        return (
          userGender !== null &&
          (row.authorGender === "male" || row.authorGender === "female") &&
          row.authorGender === userGender
        );
      }

      const recipients = recipientIdsByPrayer.get(row.id);
      return recipients?.has(userId) ?? false;
    })
    .map((row) => {
      const recipients = recipientIdsByPrayer.get(row.id);
      return {
        id: row.id,
        authorId: row.authorId,
        content: row.content,
        isPrivate: row.isPrivate,
        prayed: row.prayed,
        createdAt: row.createdAt,
        visibility: row.visibility ?? (row.isPrivate ? "specific_people" : "everyone"),
        recipientIds: Array.from(recipients ?? []),
        authorName: resolveDisplayName({
          displayName: row.authorName,
          email: row.authorEmail,
          fallback: "Someone",
        }),
      };
    });

  const visiblePrayerIds = filteredPrayers.map((item) => item.id);
  const activityRows =
    visiblePrayerIds.length === 0
      ? []
      : await db
          .select({
            id: prayerRequestActivity.id,
            prayerRequestId: prayerRequestActivity.prayerRequestId,
            actorId: prayerRequestActivity.actorId,
            activityType: prayerRequestActivity.activityType,
            comment: prayerRequestActivity.comment,
            createdAt: prayerRequestActivity.createdAt,
            actorName: users.displayName,
            actorEmail: users.email,
          })
          .from(prayerRequestActivity)
          .leftJoin(users, eq(prayerRequestActivity.actorId, users.id))
          .where(inArray(prayerRequestActivity.prayerRequestId, visiblePrayerIds))
          .orderBy(desc(prayerRequestActivity.createdAt));

  const activityByPrayer = new Map<
    string,
    Array<{
      id: string;
      prayerRequestId: string;
      actorId: string;
      type: "prayed" | "comment";
      comment: string | null;
      createdAt: Date;
      actorName: string;
    }>
  >();

  for (const row of activityRows) {
    const activityItem = {
      id: row.id,
      prayerRequestId: row.prayerRequestId,
      actorId: row.actorId,
      type: row.activityType,
      comment: row.comment,
      createdAt: row.createdAt,
      actorName: resolveDisplayName({
        displayName: row.actorName,
        email: row.actorEmail,
        fallback: "Someone",
      }),
    };
    const current = activityByPrayer.get(row.prayerRequestId) ?? [];
    current.push(activityItem);
    activityByPrayer.set(row.prayerRequestId, current);
  }

  const prayerRequestsPayload = filteredPrayers.map((item) => ({
    ...item,
    activity: activityByPrayer.get(item.id) ?? [],
  }));

  const recentVerseHighlightsRows = await db
    .select({
      id: verseHighlights.id,
      verseReference: verseHighlights.verseReference,
      verseNumber: verseHighlights.verseNumber,
      book: verseHighlights.book,
      chapter: verseHighlights.chapter,
      createdAt: verseHighlights.createdAt,
      userId: verseHighlights.userId,
      userName: users.displayName,
      userEmail: users.email,
    })
    .from(verseHighlights)
    .leftJoin(users, eq(verseHighlights.userId, users.id))
    .where(eq(verseHighlights.groupId, activeGroupId))
    .orderBy(desc(verseHighlights.createdAt), desc(verseHighlights.id))
    .limit(24);

  const recentVerseHighlights = recentVerseHighlightsRows.map((item) => ({
    id: item.id,
    verseReference: item.verseReference,
    verseNumber: item.verseNumber,
    book: item.book,
    chapter: item.chapter,
    createdAt: item.createdAt,
    userId: item.userId,
    userName: resolveDisplayName({
      displayName: item.userName,
      email: item.userEmail,
      fallback: "Member",
    }),
    isMine: item.userId === userId,
  }));

  const { month, year } = getMonthYearInTimeZone(new Date());
  const verse = await db.query.verseMemory.findFirst({
    where: and(
      eq(verseMemory.groupId, activeGroupId),
      eq(verseMemory.month, month),
      eq(verseMemory.year, year),
    ),
    orderBy: [desc(verseMemory.createdAt), desc(verseMemory.id)],
  });

  const verseProgress = verse
    ? await db.query.verseMemoryProgress.findFirst({
        where: and(
          eq(verseMemoryProgress.verseId, verse.id),
          eq(verseMemoryProgress.userId, userId),
        ),
      })
    : null;

  const verseMemoryPayload = verse
    ? [
        {
          id: verse.id,
          verseReference: verse.verseReference,
          verseSnippet: verse.verseSnippet,
          month: verse.month,
          year: verse.year,
          memorized: verseProgress?.memorized ?? false,
        },
      ]
    : [];

  const groupJoinRequestsPayload =
    activeRole === "admin"
      ? await db
          .select({
            id: groupJoinRequests.id,
            userId: users.id,
            displayName: users.displayName,
            email: users.email,
            createdAt: groupJoinRequests.createdAt,
          })
          .from(groupJoinRequests)
          .innerJoin(users, eq(groupJoinRequests.userId, users.id))
          .where(
            and(
              eq(groupJoinRequests.groupId, activeGroupId),
              eq(groupJoinRequests.status, "pending"),
            ),
          )
          .orderBy(desc(groupJoinRequests.createdAt))
      : [];

  return {
    upcomingBirthdays,
    prayerRequests: prayerRequestsPayload,
    recentVerseHighlights,
    verseMemory: verseMemoryPayload,
    calendarEvents,
    groupJoinRequests: groupJoinRequestsPayload.map((request) => ({
      id: request.id,
      userId: request.userId,
      email: request.email,
      displayName: resolveMemberDisplayName(request.displayName, request.email),
      createdAt: request.createdAt,
    })),
  };
}

export async function GET(request: Request) {
  const include = parseIncludeMode(new URL(request.url).searchParams.get("include"));
  if (!include) {
    return NextResponse.json(
      { error: "include must be either 'core' or 'secondary'." },
      { status: 400 },
    );
  }

  const context = await getRequestAuthContext(request);
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, membership, memberships } = context;
  const userIsLeadDeveloper = isLeadDeveloperUser(user);
  const hasAnyAdminMembership = memberships.some(
    (membershipItem) => membershipItem.role === "admin",
  );
  const me = {
    id: user.id,
    authId: user.authId,
    email: user.email,
    displayName:
      sanitizeDisplayName(user.displayName) ??
      resolveDisplayName({
        displayName: user.displayName,
        email: user.email,
      }),
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    birthdayMonth: user.birthdayMonth,
    birthdayDay: user.birthdayDay,
    role: membership?.role ?? null,
    canEditEventsAnnouncements: membership?.canEditEventsAnnouncements ?? false,
    isDeveloper: isDeveloperUser(user, hasAnyAdminMembership ? "admin" : null),
    isLeadDeveloper: userIsLeadDeveloper,
    activeGroupId: membership?.groupId ?? null,
    groups: memberships.map((membershipItem) => ({
      id: membershipItem.groupId,
      name: membershipItem.groupName,
      role: membershipItem.role,
    })),
  };

  const groupDirectory = await getGroupDirectory(user.id, memberships);

  if (include === "core") {
    const corePayload = await getCorePayload({
      activeGroupId: membership?.groupId ?? null,
    });

    return NextResponse.json({
      me,
      groups: me.groups,
      groupDirectory,
      activeGroupId: me.activeGroupId,
      members: corePayload.members,
      announcements: corePayload.announcements,
      snackSlots: corePayload.snackSlots,
      removedSnackSlots: corePayload.removedSnackSlots,
      discussionTopic: corePayload.discussionTopic,
    });
  }

  const secondaryPayload = await getSecondaryPayload({
    userId: user.id,
    userGender:
      user.gender === "male" || user.gender === "female" ? user.gender : null,
    activeGroupId: membership?.groupId ?? null,
    activeRole: membership?.role ?? null,
    isLeadDeveloper: userIsLeadDeveloper,
  });

  return NextResponse.json(secondaryPayload);
}
