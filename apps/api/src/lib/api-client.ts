"use client";

/** Base URL for API (same origin when served from Next.js). */
const getBaseUrl = () =>
  typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3001";

export async function apiFetch(
  path: string,
  options: { method?: string; body?: string; token?: string | null } = {}
) {
  const { method = "GET", body, token } = options;
  const base = getBaseUrl();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
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
export type DiscussionTopic = { id: string; title: string; description: string | null; bibleReference: string | null; bibleText: string | null; month: number; year: number };
export type UpcomingBirthday = { id: string; displayName: string | null; birthdayMonth: number | null; birthdayDay: number | null };
export type PrayerRequest = { id: string; authorId: string; content: string; isPrivate: boolean; prayed: boolean; createdAt: string; authorName: string | null };
export type VerseMemory = { id: string; verseReference: string; verseSnippet: string | null; month: number; year: number; memorized: boolean };

export const api = {
  syncUser: (token: string) => apiFetch("/api/users/sync", { method: "POST", token }),
  getMe: (token: string) => apiFetch("/api/me", { token }),
  getGroupMembers: (token: string) => apiFetch("/api/groups/members", { token }).then((r: { members?: unknown[] }) => r.members ?? []),
  getAnnouncements: (token: string) => apiFetch("/api/announcements", { token }).then((r: { items?: Announcement[] }) => r.items ?? []),
  createAnnouncement: (token: string, data: { title: string; body: string; link?: string }) =>
    apiFetch("/api/announcements", { method: "POST", token, body: JSON.stringify(data) }),
  deleteAnnouncement: (token: string, id: string) => apiFetch(`/api/announcements/${id}`, { method: "DELETE", token }),
  getSnackSlots: (token: string) => apiFetch("/api/snack-slots", { token }).then((r: { slots?: SnackSlot[] }) => r.slots ?? []),
  snackSignUp: (token: string, slotId: string) => apiFetch(`/api/snack-slots/${slotId}/signup`, { method: "POST", token }),
  snackSignOff: (token: string, slotId: string) => apiFetch(`/api/snack-slots/${slotId}/signup`, { method: "DELETE", token }),
  getDiscussionTopic: (token: string) => apiFetch("/api/discussion-topic", { token }).then((r: { topic?: DiscussionTopic | null }) => r.topic ?? null),
  setDiscussionTopic: (token: string, data: { title: string; description?: string; bibleReference?: string; bibleText?: string; month?: number; year?: number }) =>
    apiFetch("/api/discussion-topic", { method: "POST", token, body: JSON.stringify(data) }),
  getUpcomingBirthdays: (token: string, within = 30) =>
    apiFetch(`/api/birthdays/upcoming?within=${within}`, { token }).then((r: { birthdays?: UpcomingBirthday[] }) => r.birthdays ?? []),
  updateMe: (token: string, data: { birthdayMonth?: number | null; birthdayDay?: number | null }) =>
    apiFetch("/api/me", { method: "PATCH", token, body: JSON.stringify(data) }),
  getPrayerRequests: (token: string) => apiFetch("/api/prayer-requests", { token }).then((r: { items?: PrayerRequest[] }) => r.items ?? []),
  createPrayerRequest: (token: string, data: { content: string; isPrivate?: boolean }) =>
    apiFetch("/api/prayer-requests", { method: "POST", token, body: JSON.stringify(data) }),
  updatePrayerRequestPrayed: (token: string, id: string, prayed: boolean) =>
    apiFetch(`/api/prayer-requests/${id}`, { method: "PATCH", token, body: JSON.stringify({ prayed }) }),
  deletePrayerRequest: (token: string, id: string) => apiFetch(`/api/prayer-requests/${id}`, { method: "DELETE", token }),
  getVerseMemory: (token: string) => apiFetch("/api/verse-memory", { token }).then((r: { verses?: VerseMemory[] }) => r.verses ?? []),
  setVerseOfMonth: (token: string, data: { verseReference: string; verseSnippet?: string }) =>
    apiFetch("/api/verse-memory", { method: "POST", token, body: JSON.stringify(data) }),
  setVerseMemorized: (token: string, verseId: string, memorized: boolean) =>
    apiFetch(`/api/verse-memory/${verseId}/memorized`, { method: "PUT", token, body: JSON.stringify({ memorized }) }),
};
