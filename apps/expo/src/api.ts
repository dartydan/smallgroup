import { NativeModules, Platform } from "react-native";

const isWeb = Platform.OS === "web";
const isProductionBuild = process.env.NODE_ENV === "production";
const LOCALHOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const DEFAULT_NATIVE_API_URL = "http://localhost:3001";
const webOrigin =
  isWeb &&
  typeof window !== "undefined" &&
  typeof window.location?.origin === "string"
    ? window.location.origin
    : null;

function getHostFromUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^[a-z][a-z0-9+.-]*:\/\/([^/:?#]+)(?::\d+)?/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  const nums = parts.map((part) => Number(part));
  if (nums.some((num) => Number.isNaN(num) || num < 0 || num > 255))
    return false;
  if (nums[0] === 10) return true;
  if (nums[0] === 192 && nums[1] === 168) return true;
  if (nums[0] === 172 && nums[1] >= 16 && nums[1] <= 31) return true;
  return false;
}

function inferNativeDevApiUrl(): string | null {
  if (isWeb || isProductionBuild) return null;
  const sourceCode = NativeModules as { SourceCode?: { scriptURL?: string } };
  const scriptURL = sourceCode.SourceCode?.scriptURL;
  if (!scriptURL) return null;
  const host = getHostFromUrl(scriptURL);
  if (!host || LOCALHOSTS.has(host) || !isPrivateIPv4(host)) return null;
  return `http://${host}:3001`;
}

const envApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const inferredNativeDevApiUrl = inferNativeDevApiUrl();
const envApiHost = envApiUrl ? getHostFromUrl(envApiUrl) : null;
const envPointsToLocalhost = !!envApiHost && LOCALHOSTS.has(envApiHost);
const defaultApiUrl = webOrigin ?? DEFAULT_NATIVE_API_URL;

// In production web, always use same-origin API to avoid cross-domain drift
// when EXPO_PUBLIC_API_URL is stale/misconfigured in Vercel.
const API_URL =
  isWeb && isProductionBuild && webOrigin
    ? webOrigin
    : envApiUrl && !(envPointsToLocalhost && inferredNativeDevApiUrl)
      ? envApiUrl
      : (inferredNativeDevApiUrl ?? envApiUrl ?? defaultApiUrl);

/** Base URL of the web app (for auth redirects). */
export const WEB_APP_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_APP_URL?.trim() ??
  webOrigin ??
  (envApiUrl && !(envPointsToLocalhost && inferredNativeDevApiUrl)
    ? envApiUrl
    : inferredNativeDevApiUrl) ??
  DEFAULT_NATIVE_API_URL;

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
  options: { method?: string; body?: string; token?: string } = {},
) {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (activeGroupId) headers["X-Group-Id"] = activeGroupId;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

export async function syncUser(token: string) {
  return apiFetch("/api/users/sync", { method: "POST", token });
}

export async function getMe(token: string) {
  return apiFetch("/api/me", { token });
}

export async function suggestFeature(
  token: string,
  data: { title: string; description?: string },
) {
  return apiFetch("/api/feature-board", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

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

export async function getGroups(token: string) {
  const res = await apiFetch("/api/groups", { token });
  return (res.groups ?? []) as GroupDirectoryItem[];
}

export async function createGroup(token: string, name: string) {
  return apiFetch("/api/groups", {
    method: "POST",
    token,
    body: JSON.stringify({ name }),
  }) as Promise<CreateGroupResult>;
}

export async function renameActiveGroup(token: string, name: string) {
  return apiFetch("/api/groups", {
    method: "PATCH",
    token,
    body: JSON.stringify({ name }),
  });
}

export async function getGroupMembers(token: string) {
  return apiFetch("/api/groups/members", { token });
}

export async function addGroupMember(token: string, email: string) {
  return apiFetch("/api/groups/members", {
    method: "POST",
    token,
    body: JSON.stringify({ email }),
  });
}

export async function requestJoinGroup(token: string, groupId: string) {
  return apiFetch("/api/groups/requests", {
    method: "POST",
    token,
    body: JSON.stringify({ groupId }),
  }) as Promise<RequestJoinGroupResult>;
}

export type Announcement = {
  id: string;
  authorId: string;
  title: string;
  body: string;
  link: string | null;
  createdAt: string;
};

export async function getAnnouncements(token: string) {
  const res = await apiFetch("/api/announcements", { token });
  return res.items as Announcement[];
}

export async function createAnnouncement(
  token: string,
  data: { title: string; body: string; link?: string },
) {
  return apiFetch("/api/announcements", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function deleteAnnouncement(token: string, id: string) {
  return apiFetch(`/api/announcements/${id}`, { method: "DELETE", token });
}

export type SnackSignup = {
  id: string;
  displayName: string | null;
  email: string;
};
export type SnackSlot = {
  id: string;
  slotDate: string;
  signups: SnackSignup[];
};

export async function getSnackSlots(token: string) {
  const res = await apiFetch("/api/snack-slots", { token });
  return res.slots as SnackSlot[];
}

export async function snackSignUp(token: string, slotId: string) {
  return apiFetch(`/api/snack-slots/${slotId}/signup`, {
    method: "POST",
    token,
  });
}

export async function snackSignOff(token: string, slotId: string) {
  return apiFetch(`/api/snack-slots/${slotId}/signup`, {
    method: "DELETE",
    token,
  });
}

export type DiscussionTopic = {
  id: string;
  title: string;
  description: string | null;
  bibleReference: string | null;
  bibleText: string | null;
  month: number;
  year: number;
};

export async function getDiscussionTopic(token: string) {
  const res = await apiFetch("/api/discussion-topic", { token });
  return res.topic as DiscussionTopic | null;
}

export async function setDiscussionTopic(
  token: string,
  data: {
    title: string;
    description?: string;
    bibleReference?: string;
    bibleText?: string;
    month?: number;
    year?: number;
  },
) {
  const res = await apiFetch("/api/discussion-topic", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
  return res.topic as DiscussionTopic;
}

export async function updateMe(
  token: string,
  data: { birthdayMonth?: number | null; birthdayDay?: number | null },
) {
  return apiFetch("/api/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(data),
  });
}

export type UpcomingBirthday = {
  id: string;
  displayName: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
};

export async function getUpcomingBirthdays(token: string, withinDays = 30) {
  const res = await apiFetch(`/api/birthdays/upcoming?within=${withinDays}`, {
    token,
  });
  return res.birthdays as UpcomingBirthday[];
}

export type PrayerRequest = {
  id: string;
  authorId: string;
  content: string;
  isPrivate: boolean;
  prayed: boolean;
  createdAt: string;
  authorName: string | null;
};

export async function getPrayerRequests(token: string) {
  const res = await apiFetch("/api/prayer-requests", { token });
  return res.items as PrayerRequest[];
}

export async function createPrayerRequest(
  token: string,
  data: { content: string; isPrivate?: boolean },
) {
  return apiFetch("/api/prayer-requests", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
}

export async function updatePrayerRequestPrayed(
  token: string,
  id: string,
  prayed: boolean,
) {
  return apiFetch(`/api/prayer-requests/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify({ prayed }),
  });
}

export async function deletePrayerRequest(token: string, id: string) {
  return apiFetch(`/api/prayer-requests/${id}`, { method: "DELETE", token });
}

export type VerseMemory = {
  id: string;
  verseReference: string;
  verseSnippet: string | null;
  month: number;
  year: number;
  memorized: boolean;
};

export async function getVerseMemory(token: string) {
  const res = await apiFetch("/api/verse-memory", { token });
  return res.verses as VerseMemory[];
}

export async function setVerseOfMonth(
  token: string,
  data: { verseReference: string; verseSnippet?: string },
) {
  const res = await apiFetch("/api/verse-memory", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
  return res.verse as VerseMemory;
}

export async function setVerseMemorized(
  token: string,
  verseId: string,
  memorized: boolean,
) {
  return apiFetch(`/api/verse-memory/${verseId}/memorized`, {
    method: "PUT",
    token,
    body: JSON.stringify({ memorized }),
  });
}

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

export async function getEsvChapter(
  token: string,
  book: string,
  chapter: number,
) {
  const params = new URLSearchParams({
    book,
    chapter: String(chapter),
  });
  const res = await apiFetch(`/api/bible/esv/chapter?${params.toString()}`, {
    token,
  });
  return res as BibleChapterResponse;
}

export async function getVerseHighlights(
  token: string,
  book: string,
  chapter: number,
) {
  const params = new URLSearchParams({
    book,
    chapter: String(chapter),
  });
  const res = await apiFetch(`/api/verse-highlights?${params.toString()}`, {
    token,
  });
  return (res.highlights ?? []) as VerseHighlight[];
}

export async function createVerseHighlight(
  token: string,
  data: {
    book: string;
    chapter: number;
    verseNumber: number;
    verseReference: string;
  },
) {
  const res = await apiFetch("/api/verse-highlights", {
    method: "POST",
    token,
    body: JSON.stringify(data),
  });
  return res.highlight as VerseHighlight;
}

export async function deleteVerseHighlight(token: string, id: string) {
  return apiFetch(`/api/verse-highlights/${id}`, { method: "DELETE", token });
}
