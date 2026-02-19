const isBrowser = typeof window !== "undefined";
const isProductionBuild = process.env.NODE_ENV === "production";

// In production web, always use same-origin API to avoid cross-domain drift
// when EXPO_PUBLIC_API_URL is stale/misconfigured in Vercel.
const API_URL =
  isBrowser && isProductionBuild
    ? window.location.origin
    : process.env.EXPO_PUBLIC_API_URL ??
      (isBrowser ? window.location.origin : "http://localhost:3001");

export async function apiFetch(
  path: string,
  options: { method?: string; body?: string; token?: string } = {}
) {
  const { method = "GET", body, token } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
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

export async function getGroupMembers(token: string) {
  return apiFetch("/api/groups/members", { token });
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
  data: { title: string; body: string; link?: string }
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

export type SnackSignup = { id: string; displayName: string | null; email: string };
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
  return apiFetch(`/api/snack-slots/${slotId}/signup`, { method: "POST", token });
}

export async function snackSignOff(token: string, slotId: string) {
  return apiFetch(`/api/snack-slots/${slotId}/signup`, { method: "DELETE", token });
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
  }
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
  data: { birthdayMonth?: number | null; birthdayDay?: number | null }
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
  const res = await apiFetch(
    `/api/birthdays/upcoming?within=${withinDays}`,
    { token }
  );
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
  data: { content: string; isPrivate?: boolean }
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
  prayed: boolean
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
  data: { verseReference: string; verseSnippet?: string }
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
  memorized: boolean
) {
  return apiFetch(`/api/verse-memory/${verseId}/memorized`, {
    method: "PUT",
    token,
    body: JSON.stringify({ memorized }),
  });
}
