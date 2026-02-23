"use client";

/** Base URL for API (same origin when served from Next.js). */
const getBaseUrl = () =>
  typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3001";

let activeGroupId: string | null = null;

export function setActiveGroupId(groupId: string | null | undefined) {
  const trimmed = groupId?.trim();
  activeGroupId = trimmed ? trimmed : null;
}

export function getActiveGroupId() {
  return activeGroupId;
}

export async function apiFetch(
  path: string,
  options: { method?: string; body?: string; token?: string | null } = {}
) {
  const { method = "GET", body, token } = options;
  const base = getBaseUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (activeGroupId) headers["X-Group-Id"] = activeGroupId;
  const res = await fetch(`${base}${path}`, { method, headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = err.error ?? res.statusText;
    throw new Error(`${path} (${res.status}): ${message}`);
  }
  return res.json();
}

export type Announcement = { id: string; authorId: string; title: string; body: string; link: string | null; createdAt: string };
export type SnackSignup = { id: string; displayName: string | null; email: string };
export type SnackSlot = { id: string; slotDate: string; signups: SnackSignup[] };
export type RemovedSnackSlot = { id: string; slotDate: string; cancellationReason: string | null };
export type DiscussionTopic = { id: string; title: string; description: string | null; bibleReference: string | null; bibleText: string | null; month: number; year: number };
export type UpcomingBirthday = { id: string; displayName: string | null; birthdayMonth: number | null; birthdayDay: number | null; daysUntil: number };
export type PrayerVisibility = "everyone" | "my_gender" | "specific_people";
export type PrayerRequestActivityType = "prayed" | "comment";
export type PrayerRequestActivity = {
  id: string;
  prayerRequestId: string;
  actorId: string;
  actorName: string;
  type: PrayerRequestActivityType;
  comment: string | null;
  createdAt: string;
};
export type PrayerRequest = {
  id: string;
  authorId: string;
  content: string;
  isPrivate: boolean;
  visibility: PrayerVisibility;
  recipientIds?: string[];
  activity?: PrayerRequestActivity[];
  prayed: boolean;
  createdAt: string;
  authorName: string | null;
};
export type VerseMemory = { id: string; verseReference: string; verseSnippet: string | null; month: number; year: number; memorized: boolean };
export type PracticeLevel = 1 | 2 | 3;
export type VersePracticeCompletionMember = { userId: string; firstName: string };
export type VersePracticeLevelsResponse = {
  completedByLevel: {
    1: VersePracticeCompletionMember[];
    2: VersePracticeCompletionMember[];
    3: VersePracticeCompletionMember[];
  };
  myCompletedLevels: PracticeLevel[];
};
export type BibleChapterVerse = {
  verseNumber: number;
  reference: string;
  text: string;
  heading: string | null;
};
export type BibleChapterResponse = {
  book: string;
  chapter: number;
  canonical: string;
  verses: BibleChapterVerse[];
  attribution: string;
};
export type VerseHighlight = {
  id: string;
  verseReference: string;
  verseNumber: number;
  book: string;
  chapter: number;
  createdAt: string;
  userId: string;
  userName: string;
  isMine: boolean;
};
export type CalendarEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string | null;
  isAllDay: boolean;
  location: string | null;
  description: string | null;
  daysOffset: number;
};
export type GroupSummary = {
  id: string;
  name: string;
  role: "admin" | "member";
};
export type GroupRequestStatus = "pending" | "approved" | "rejected" | null;
export type GroupDirectoryItem = {
  id: string;
  name: string;
  createdAt: string;
  memberCount: number;
  myRole: "admin" | "member" | null;
  requestStatus: GroupRequestStatus;
  canRequest: boolean;
};
export type GroupJoinRequest = {
  id: string;
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
};
export type Profile = {
  id: string;
  authId: string;
  email: string;
  displayName: string;
  firstName?: string | null;
  lastName?: string | null;
  role: "admin" | "member" | null;
  canEditEventsAnnouncements: boolean;
  activeGroupId: string | null;
  groups: GroupSummary[];
  gender?: "male" | "female" | null;
  birthdayMonth?: number | null;
  birthdayDay?: number | null;
};
export type GroupMember = {
  id: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  birthdayMonth?: number | null;
  birthdayDay?: number | null;
  role: "admin" | "member";
  canEditEventsAnnouncements: boolean;
};
export type AddGroupMemberResult = {
  alreadyMember: boolean;
  member: GroupMember;
};
export type RequestJoinGroupResult = {
  alreadyMember?: boolean;
  alreadyRequested?: boolean;
  requestStatus: Exclude<GroupRequestStatus, null>;
  group: {
    id: string;
    name: string;
  };
};
export type CreateGroupResult = {
  group: {
    id: string;
    name: string;
    role: "admin";
  };
};
export type LeadershipTransition = "member" | "leave";
export type TransferGroupLeadershipResult = {
  ok: true;
  nextLeaderUserId: string;
  transition: LeadershipTransition;
};

export const api = {
  syncUser: (token?: string | null) => apiFetch("/api/users/sync", { method: "POST", token }),
  getMe: (token?: string | null) => apiFetch("/api/me", { token }) as Promise<Profile>,
  getGroups: (token?: string | null) =>
    apiFetch("/api/groups", { token }).then(
      (r: { groups?: GroupDirectoryItem[] }) => r.groups ?? [],
    ),
  createGroup: (token: string | null | undefined, name: string) =>
    apiFetch("/api/groups", {
      method: "POST",
      token,
      body: JSON.stringify({ name }),
    }) as Promise<CreateGroupResult>,
  requestJoinGroup: (
    token: string | null | undefined,
    groupId: string,
  ) =>
    apiFetch("/api/groups/requests", {
      method: "POST",
      token,
      body: JSON.stringify({ groupId }),
    }) as Promise<RequestJoinGroupResult>,
  getGroupJoinRequests: (token?: string | null) =>
    apiFetch("/api/groups/requests", { token }).then(
      (r: { requests?: GroupJoinRequest[] }) => r.requests ?? [],
    ),
  reviewGroupJoinRequest: (
    token: string | null | undefined,
    requestId: string,
    action: "approve" | "reject",
  ) =>
    apiFetch(`/api/groups/requests/${requestId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ action }),
    }),
  renameActiveGroup: (token: string | null | undefined, name: string) =>
    apiFetch("/api/groups", {
      method: "PATCH",
      token,
      body: JSON.stringify({ name }),
    }),
  deleteActiveGroup: (token: string | null | undefined) =>
    apiFetch("/api/groups", {
      method: "DELETE",
      token,
    }) as Promise<{ ok: true; group: { id: string; name: string } }>,
  transferGroupLeadership: (
    token: string | null | undefined,
    nextLeaderUserId: string,
    transition: LeadershipTransition,
  ) =>
    apiFetch("/api/groups/leadership", {
      method: "POST",
      token,
      body: JSON.stringify({ nextLeaderUserId, transition }),
    }) as Promise<TransferGroupLeadershipResult>,
  leaveActiveGroup: (token: string | null | undefined) =>
    apiFetch("/api/groups/leave", {
      method: "DELETE",
      token,
    }),
  getGroupMembers: (token?: string | null) =>
    apiFetch("/api/groups/members", { token }).then(
      (r: { members?: GroupMember[] }) => r.members ?? [],
    ),
  addGroupMember: (token: string | null | undefined, email: string) =>
    apiFetch("/api/groups/members", {
      method: "POST",
      token,
      body: JSON.stringify({ email }),
    }) as Promise<AddGroupMemberResult>,
  removeGroupMember: (token: string | null | undefined, userId: string) =>
    apiFetch(`/api/groups/members/${userId}`, { method: "DELETE", token }),
  updateGroupMemberPermissions: (
    token: string | null | undefined,
    userId: string,
    canEditEventsAnnouncements: boolean,
  ) =>
    apiFetch(`/api/groups/members/${userId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ canEditEventsAnnouncements }),
    }),
  updateGroupMemberRole: (
    token: string | null | undefined,
    userId: string,
    role: "admin" | "member",
  ) =>
    apiFetch(`/api/groups/members/${userId}`, {
      method: "PATCH",
      token,
      body: JSON.stringify({ role }),
    }),
  getAnnouncements: (token?: string | null) => apiFetch("/api/announcements", { token }).then((r: { items?: Announcement[] }) => r.items ?? []),
  createAnnouncement: (token: string | null | undefined, data: { title: string; body: string; link?: string }) =>
    apiFetch("/api/announcements", { method: "POST", token, body: JSON.stringify(data) }),
  updateAnnouncement: (
    token: string | null | undefined,
    id: string,
    data: { title: string; body: string; link?: string }
  ) =>
    apiFetch(`/api/announcements/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(data),
    }),
  deleteAnnouncement: (token: string | null | undefined, id: string) => apiFetch(`/api/announcements/${id}`, { method: "DELETE", token }),
  getSnackSlots: (token?: string | null) => apiFetch("/api/snack-slots", { token }).then((r: { slots?: SnackSlot[] }) => r.slots ?? []),
  getSnackSlotsWithRemoved: (
    token?: string | null,
    options: {
      startDate?: string;
      endDate?: string;
      limit?: number;
      removedLimit?: number;
      includeRemoved?: boolean;
    } = {}
  ) => {
    const params = new URLSearchParams();
    if (options.startDate) params.set("startDate", options.startDate);
    if (options.endDate) params.set("endDate", options.endDate);
    if (typeof options.limit === "number") params.set("limit", String(options.limit));
    if (typeof options.removedLimit === "number") {
      params.set("removedLimit", String(options.removedLimit));
    }
    if (options.includeRemoved === false) params.set("includeRemoved", "0");
    const query = params.toString();
    return apiFetch(`/api/snack-slots${query ? `?${query}` : ""}`, { token }).then(
      (r: { slots?: SnackSlot[]; removedSlots?: RemovedSnackSlot[] }) => ({
        slots: r.slots ?? [],
        removedSlots: r.removedSlots ?? [],
      })
    );
  },
  snackSignUp: (token: string | null | undefined, slotId: string) => apiFetch(`/api/snack-slots/${slotId}/signup`, { method: "POST", token }),
  snackSignOff: (token: string | null | undefined, slotId: string) => apiFetch(`/api/snack-slots/${slotId}/signup`, { method: "DELETE", token }),
  removeSnackSlot: (token: string | null | undefined, slotId: string, reason: string) =>
    apiFetch(`/api/snack-slots/${slotId}`, {
      method: "DELETE",
      token,
      body: JSON.stringify({ reason }),
    }),
  restoreSnackSlot: (token: string | null | undefined, slotId: string) =>
    apiFetch(`/api/snack-slots/${slotId}`, { method: "PATCH", token }),
  getDiscussionTopic: (token?: string | null) => apiFetch("/api/discussion-topic", { token }).then((r: { topic?: DiscussionTopic | null }) => r.topic ?? null),
  setDiscussionTopic: (token: string | null | undefined, data: { title: string; description?: string; bibleReference?: string; bibleText?: string; month?: number; year?: number }) =>
    apiFetch("/api/discussion-topic", { method: "POST", token, body: JSON.stringify(data) }),
  getUpcomingBirthdays: (token: string | null | undefined, within = 30, past = 0) => {
    const params = new URLSearchParams({
      within: String(within),
      past: String(past),
    });
    return apiFetch(`/api/birthdays/upcoming?${params.toString()}`, {
      token,
    }).then((r: { birthdays?: UpcomingBirthday[] }) => r.birthdays ?? []);
  },
  updateMe: (
    token: string | null | undefined,
    data: {
      firstName?: string | null;
      lastName?: string | null;
      displayName?: string | null;
      birthdayMonth?: number | null;
      birthdayDay?: number | null;
      gender?: "male" | "female" | null;
    },
  ) =>
    apiFetch("/api/me", { method: "PATCH", token, body: JSON.stringify(data) }),
  getPrayerRequests: (token?: string | null) => apiFetch("/api/prayer-requests", { token }).then((r: { items?: PrayerRequest[] }) => r.items ?? []),
  createPrayerRequest: (
    token: string | null | undefined,
    data: {
      content: string;
      isPrivate?: boolean;
      visibility?: PrayerVisibility;
      recipientIds?: string[];
    }
  ) =>
    apiFetch("/api/prayer-requests", { method: "POST", token, body: JSON.stringify(data) }),
  updatePrayerRequestPrayed: (token: string | null | undefined, id: string, prayed: boolean) =>
    apiFetch(`/api/prayer-requests/${id}`, { method: "PATCH", token, body: JSON.stringify({ prayed }) }),
  updatePrayerRequest: (
    token: string | null | undefined,
    id: string,
    data: {
      content?: string;
      visibility?: PrayerVisibility;
      recipientIds?: string[];
    },
  ) =>
    apiFetch(`/api/prayer-requests/${id}`, {
      method: "PATCH",
      token,
      body: JSON.stringify(data),
    }),
  addPrayerRequestActivity: (
    token: string | null | undefined,
    id: string,
    data: {
      type: PrayerRequestActivityType;
      comment?: string;
    },
  ) =>
    apiFetch(`/api/prayer-requests/${id}/activity`, {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }) as Promise<PrayerRequestActivity>,
  removePrayerRequestPrayedActivity: (
    token: string | null | undefined,
    id: string,
  ) =>
    apiFetch(`/api/prayer-requests/${id}/activity?type=prayed`, {
      method: "DELETE",
      token,
    }) as Promise<{ ok: true }>,
  deletePrayerRequest: (token: string | null | undefined, id: string) => apiFetch(`/api/prayer-requests/${id}`, { method: "DELETE", token }),
  getVerseMemory: (token?: string | null) => apiFetch("/api/verse-memory", { token }).then((r: { verses?: VerseMemory[] }) => r.verses ?? []),
  setVerseOfMonth: (token: string | null | undefined, data: { verseReference: string; verseSnippet?: string }) =>
    apiFetch("/api/verse-memory", { method: "POST", token, body: JSON.stringify(data) }),
  setVerseMemorized: (token: string | null | undefined, verseId: string, memorized: boolean) =>
    apiFetch(`/api/verse-memory/${verseId}/memorized`, { method: "PUT", token, body: JSON.stringify({ memorized }) }),
  getVersePracticeLevels: (token: string | null | undefined, verseId: string) =>
    apiFetch(`/api/verse-memory/${verseId}/practice-levels`, { token }) as Promise<VersePracticeLevelsResponse>,
  completeVersePracticeLevel: (
    token: string | null | undefined,
    verseId: string,
    level: PracticeLevel
  ) =>
    apiFetch(`/api/verse-memory/${verseId}/practice-levels`, {
      method: "POST",
      token,
      body: JSON.stringify({ level }),
    }) as Promise<VersePracticeLevelsResponse>,
  getEsvChapter: (token: string | null | undefined, book: string, chapter: number) => {
    const params = new URLSearchParams({
      book,
      chapter: String(chapter),
    });
    return apiFetch(`/api/bible/esv/chapter?${params.toString()}`, { token }) as Promise<BibleChapterResponse>;
  },
  getVerseHighlights: (token: string | null | undefined, book: string, chapter: number) => {
    const params = new URLSearchParams({
      book,
      chapter: String(chapter),
    });
    return apiFetch(`/api/verse-highlights?${params.toString()}`, { token }).then(
      (r: { highlights?: VerseHighlight[] }) => r.highlights ?? []
    );
  },
  getRecentVerseHighlights: (
    token: string | null | undefined,
    options: { limit?: number } = {},
  ) => {
    const params = new URLSearchParams();
    if (typeof options.limit === "number") {
      params.set("limit", String(options.limit));
    }
    const query = params.toString();
    return apiFetch(`/api/verse-highlights${query ? `?${query}` : ""}`, { token }).then(
      (r: { highlights?: VerseHighlight[] }) => r.highlights ?? [],
    );
  },
  createVerseHighlight: (
    token: string | null | undefined,
    data: {
      book: string;
      chapter: number;
      verseNumber: number;
      verseReference: string;
    }
  ) =>
    apiFetch("/api/verse-highlights", {
      method: "POST",
      token,
      body: JSON.stringify(data),
    }).then((r: { highlight?: VerseHighlight }) => r.highlight),
  deleteVerseHighlight: (token: string | null | undefined, id: string) =>
    apiFetch(`/api/verse-highlights/${id}`, { method: "DELETE", token }),
  getCalendarEvents: (
    token?: string | null,
    options: { startDate?: string; endDate?: string } = {}
  ) => {
    const params = new URLSearchParams();
    if (options.startDate) params.set("startDate", options.startDate);
    if (options.endDate) params.set("endDate", options.endDate);
    const query = params.toString();
    return apiFetch(`/api/calendar-events${query ? `?${query}` : ""}`, { token }).then(
      (r: { items?: CalendarEvent[] }) => r.items ?? []
    );
  },
};
