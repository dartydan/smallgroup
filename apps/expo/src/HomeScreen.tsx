import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Switch,
  Image,
  Share,
  Linking,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "./AuthContext";
import {
  getMe,
  getGroupMembers,
  syncUser,
  getAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  getSnackSlots,
  snackSignUp,
  snackSignOff,
  getDiscussionTopic,
  setDiscussionTopic,
  updateMe,
  getPrayerRequests,
  createPrayerRequest,
  updatePrayerRequestPrayed,
  deletePrayerRequest,
  getVerseMemory,
  setVerseOfMonth,
  setVerseMemorized,
  getEsvChapter,
  getVerseHighlights,
  createVerseHighlight,
  deleteVerseHighlight,
  type Announcement,
  type BibleChapterResponse,
  type BibleChapterVerse,
  type SnackSlot,
  type DiscussionTopic,
  type PrayerRequest,
  type VerseMemory,
  type VerseHighlight,
} from "./api";
import { nature } from "./theme";

/** Map server/network errors to a short, actionable message for the banner. */
function friendlyLoadError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("failed query") ||
    lower.includes('relation "users"') ||
    lower.includes("does not exist")
  ) {
    return "Server couldn’t load your account. The API database may be missing tables—ensure migrations are applied and DATABASE_URL is set.";
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("network request failed") ||
    lower.includes("fetch")
  ) {
    return "Can’t reach the server. Check EXPO_PUBLIC_API_URL (use your computer’s IP on a real device, not localhost) and that the API is running.";
  }
  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Session expired or invalid. Try signing out and signing in again.";
  }
  return raw;
}

type Member = {
  id: string;
  displayName: string | null;
  email: string;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  role: string;
};

function getRoleLabel(role: string | null | undefined): "Leader" | "Member" {
  return role === "admin" ? "Leader" : "Member";
}

type AppTab = "home" | "prayer" | "verse" | "settings";
type TabIconName = React.ComponentProps<typeof Ionicons>["name"];
type BirthdayAnnouncement = Announcement & {
  isBirthdayAnnouncement: true;
  birthdayOffsetDays: number;
};
type AnnouncementFeedItem = Announcement | BirthdayAnnouncement;
type PassagePickerContext = "reader" | "memory";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MEMORY_VERSE_BOOK = "John";
const DEFAULT_MEMORY_VERSE_CHAPTER = 1;
const DEFAULT_MEMORY_VERSE_NUMBER = "1";
const MONTH_OPTIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const APP_TABS: Array<{
  key: AppTab;
  label: string;
  icon: TabIconName;
  activeIcon: TabIconName;
}> = [
  { key: "home", label: "Home", icon: "home-outline", activeIcon: "home" },
  {
    key: "prayer",
    label: "Pray",
    icon: "heart-outline",
    activeIcon: "heart",
  },
  { key: "verse", label: "Read", icon: "book-outline", activeIcon: "book" },
  {
    key: "settings",
    label: "Settings",
    icon: "settings-outline",
    activeIcon: "settings",
  },
];

type BibleBookOption = { name: string; chapters: number };
type BibleTestament = "old" | "new";
const OLD_TESTAMENT_BOOK_COUNT = 39;

const BIBLE_BOOKS: BibleBookOption[] = [
  { name: "Genesis", chapters: 50 },
  { name: "Exodus", chapters: 40 },
  { name: "Leviticus", chapters: 27 },
  { name: "Numbers", chapters: 36 },
  { name: "Deuteronomy", chapters: 34 },
  { name: "Joshua", chapters: 24 },
  { name: "Judges", chapters: 21 },
  { name: "Ruth", chapters: 4 },
  { name: "1 Samuel", chapters: 31 },
  { name: "2 Samuel", chapters: 24 },
  { name: "1 Kings", chapters: 22 },
  { name: "2 Kings", chapters: 25 },
  { name: "1 Chronicles", chapters: 29 },
  { name: "2 Chronicles", chapters: 36 },
  { name: "Ezra", chapters: 10 },
  { name: "Nehemiah", chapters: 13 },
  { name: "Esther", chapters: 10 },
  { name: "Job", chapters: 42 },
  { name: "Psalms", chapters: 150 },
  { name: "Proverbs", chapters: 31 },
  { name: "Ecclesiastes", chapters: 12 },
  { name: "Song of Solomon", chapters: 8 },
  { name: "Isaiah", chapters: 66 },
  { name: "Jeremiah", chapters: 52 },
  { name: "Lamentations", chapters: 5 },
  { name: "Ezekiel", chapters: 48 },
  { name: "Daniel", chapters: 12 },
  { name: "Hosea", chapters: 14 },
  { name: "Joel", chapters: 3 },
  { name: "Amos", chapters: 9 },
  { name: "Obadiah", chapters: 1 },
  { name: "Jonah", chapters: 4 },
  { name: "Micah", chapters: 7 },
  { name: "Nahum", chapters: 3 },
  { name: "Habakkuk", chapters: 3 },
  { name: "Zephaniah", chapters: 3 },
  { name: "Haggai", chapters: 2 },
  { name: "Zechariah", chapters: 14 },
  { name: "Malachi", chapters: 4 },
  { name: "Matthew", chapters: 28 },
  { name: "Mark", chapters: 16 },
  { name: "Luke", chapters: 24 },
  { name: "John", chapters: 21 },
  { name: "Acts", chapters: 28 },
  { name: "Romans", chapters: 16 },
  { name: "1 Corinthians", chapters: 16 },
  { name: "2 Corinthians", chapters: 13 },
  { name: "Galatians", chapters: 6 },
  { name: "Ephesians", chapters: 6 },
  { name: "Philippians", chapters: 4 },
  { name: "Colossians", chapters: 4 },
  { name: "1 Thessalonians", chapters: 5 },
  { name: "2 Thessalonians", chapters: 3 },
  { name: "1 Timothy", chapters: 6 },
  { name: "2 Timothy", chapters: 4 },
  { name: "Titus", chapters: 3 },
  { name: "Philemon", chapters: 1 },
  { name: "Hebrews", chapters: 13 },
  { name: "James", chapters: 5 },
  { name: "1 Peter", chapters: 5 },
  { name: "2 Peter", chapters: 3 },
  { name: "1 John", chapters: 5 },
  { name: "2 John", chapters: 1 },
  { name: "3 John", chapters: 1 },
  { name: "Jude", chapters: 1 },
  { name: "Revelation", chapters: 22 },
];

function getTestamentForBook(book: string): BibleTestament {
  const index = BIBLE_BOOKS.findIndex((option) => option.name === book);
  if (index === -1) return "new";
  return index < OLD_TESTAMENT_BOOK_COUNT ? "old" : "new";
}

function hasLettersAndNumbers(value: string): boolean {
  return /[a-z]/i.test(value) && /[0-9]/.test(value);
}

function isIdLikeName(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  const prefixed = normalized.match(
    /^(user|org|sess|session|client|sms|email|inv|invite|acct|account|clerk)[\s._:-]+([a-z0-9]+)$/,
  );
  if (prefixed) {
    const token = prefixed[2];
    if (token.length >= 16) return true;
    if (token.length >= 6 && hasLettersAndNumbers(token)) return true;
  }
  if (/^[a-f0-9]{16,}$/.test(normalized)) return true;
  const compact = normalized.replace(/[^a-z0-9]+/g, "");
  if (compact.length >= 20 && hasLettersAndNumbers(compact)) return true;
  return false;
}

function sanitizeName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase() === "member" || isIdLikeName(trimmed)) return null;
  return trimmed;
}

function formatNameFromEmail(
  email: string | null | undefined,
  fallback = "Member",
): string {
  const localPart = email?.split("@")[0]?.trim();
  if (!localPart || isIdLikeName(localPart)) return fallback;
  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || isIdLikeName(cleaned)) return fallback;
  return cleaned
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

function safeName(
  displayName: string | null | undefined,
  email?: string | null,
  fallback = "Member",
): string {
  const safeDisplayName = sanitizeName(displayName);
  if (safeDisplayName) return safeDisplayName;
  const emailName = formatNameFromEmail(email, fallback);
  return sanitizeName(emailName) ?? fallback;
}

function dayStart(date: Date): Date {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function dayDiff(from: Date, to: Date): number {
  return Math.round(
    (dayStart(to).getTime() - dayStart(from).getTime()) / DAY_MS,
  );
}

function daysInMonth(month: number): number {
  return new Date(2024, month, 0).getDate();
}

function parseBirthdayPart(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function getBirthdayWindowMatch(
  month: number,
  day: number,
  today: Date,
): { date: Date; offsetDays: number } | null {
  const year = today.getFullYear();
  const candidates = [year - 1, year, year + 1]
    .map(
      (candidateYear) => new Date(candidateYear, month - 1, day, 12, 0, 0, 0),
    )
    .filter(
      (candidate) =>
        candidate.getMonth() === month - 1 && candidate.getDate() === day,
    );

  let best: { date: Date; offsetDays: number } | null = null;
  for (const candidate of candidates) {
    const offsetDays = dayDiff(today, candidate);
    if (offsetDays < -3 || offsetDays > 14) continue;
    if (
      !best ||
      Math.abs(offsetDays) < Math.abs(best.offsetDays) ||
      (Math.abs(offsetDays) === Math.abs(best.offsetDays) &&
        offsetDays > best.offsetDays)
    ) {
      best = { date: candidate, offsetDays };
    }
  }

  return best;
}

function buildBirthdayAnnouncement(
  member: Member,
  today: Date,
): BirthdayAnnouncement | null {
  const month = member.birthdayMonth;
  const day = member.birthdayDay;
  if (!month || !day) return null;

  const match = getBirthdayWindowMatch(month, day, today);
  if (!match) return null;

  const name = safeName(member.displayName, member.email, "Member");
  const birthdayDate = match.date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  let body = "";
  if (match.offsetDays === 0) {
    body = `Today is ${name}'s birthday. Wish them a happy birthday!`;
  } else if (match.offsetDays > 0) {
    const unit = match.offsetDays === 1 ? "day" : "days";
    body = `${name}'s birthday is on ${birthdayDate} (in ${match.offsetDays} ${unit}).`;
  } else {
    const daysAgo = Math.abs(match.offsetDays);
    const unit = daysAgo === 1 ? "day" : "days";
    body = `${name}'s birthday was on ${birthdayDate} (${daysAgo} ${unit} ago). Send them some love.`;
  }

  const monthStr = String(month).padStart(2, "0");
  const dayStr = String(day).padStart(2, "0");
  return {
    id: `birthday-${member.id}-${match.date.getFullYear()}-${monthStr}-${dayStr}`,
    authorId: member.id,
    title: `Birthday: ${name}`,
    body,
    link: null,
    createdAt: match.date.toISOString(),
    isBirthdayAnnouncement: true,
    birthdayOffsetDays: match.offsetDays,
  };
}

function isBirthdayAnnouncement(
  item: AnnouncementFeedItem,
): item is BirthdayAnnouncement {
  return "isBirthdayAnnouncement" in item;
}

function parseBookAndChapterFromReference(
  reference: string,
): { book: string; chapter: number } | null {
  const normalized = reference.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return null;
  const sortedBooks = [...BIBLE_BOOKS].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const option of sortedBooks) {
    const bookLower = option.name.toLowerCase();
    if (!normalized.startsWith(`${bookLower} `)) continue;
    const rest = normalized.slice(bookLower.length).trim();
    const chapterMatch = rest.match(/^(\d{1,3})/);
    if (!chapterMatch) continue;
    const chapter = Number.parseInt(chapterMatch[1], 10);
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > option.chapters)
      continue;
    return { book: option.name, chapter };
  }
  return null;
}

function parseBookChapterVerseFromReference(
  reference: string,
): { book: string; chapter: number; verseNumber: number | null } | null {
  const normalized = reference.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return null;
  const sortedBooks = [...BIBLE_BOOKS].sort(
    (a, b) => b.name.length - a.name.length,
  );
  for (const option of sortedBooks) {
    const bookLower = option.name.toLowerCase();
    if (!normalized.startsWith(`${bookLower} `)) continue;
    const rest = normalized.slice(bookLower.length).trim();
    const match = rest.match(/^(\d{1,3})(?::(\d{1,3}))?/);
    if (!match) continue;
    const chapter = Number.parseInt(match[1], 10);
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > option.chapters)
      continue;
    const verseNumber = match[2] ? Number.parseInt(match[2], 10) : null;
    return {
      book: option.name,
      chapter,
      verseNumber:
        verseNumber && Number.isFinite(verseNumber) && verseNumber > 0
          ? verseNumber
          : null,
    };
  }
  return null;
}

function formatVerseRangeLabel(
  book: string,
  chapter: number,
  verseNumbers: number[],
): string {
  const sortedUnique = [...new Set(verseNumbers)]
    .filter((num) => Number.isFinite(num))
    .sort((a, b) => a - b);
  if (sortedUnique.length === 0) return `${book} ${chapter}`;

  const segments: string[] = [];
  let rangeStart = sortedUnique[0];
  let rangeEnd = sortedUnique[0];

  for (let index = 1; index < sortedUnique.length; index += 1) {
    const current = sortedUnique[index];
    if (current === rangeEnd + 1) {
      rangeEnd = current;
      continue;
    }
    segments.push(
      rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`,
    );
    rangeStart = current;
    rangeEnd = current;
  }

  segments.push(
    rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`,
  );

  return `${book} ${chapter}:${segments.join(",")}`;
}

export function HomeScreen() {
  const { getToken, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [me, setMe] = useState<{
    id: string;
    displayName: string | null;
    email: string;
    role?: string;
    birthdayMonth?: number | null;
    birthdayDay?: number | null;
  } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [snackSlots, setSnackSlots] = useState<SnackSlot[]>([]);
  const [discussionTopic, setDiscussionTopicState] =
    useState<DiscussionTopic | null>(null);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [verseMemory, setVerseMemory] = useState<VerseMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadErrorRaw, setLoadErrorRaw] = useState<string | null>(null);
  const [showNewAnnouncement, setShowNewAnnouncement] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicBibleRef, setTopicBibleRef] = useState("");
  const [topicBibleText, setTopicBibleText] = useState("");
  const [topicSubmitting, setTopicSubmitting] = useState(false);
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  const [birthdaySubmitting, setBirthdaySubmitting] = useState(false);
  const [showPrayerModal, setShowPrayerModal] = useState(false);
  const [prayerContent, setPrayerContent] = useState("");
  const [prayerPrivate, setPrayerPrivate] = useState(false);
  const [prayerSubmitting, setPrayerSubmitting] = useState(false);
  const [showVerseModal, setShowVerseModal] = useState(false);
  const [verseSubmitting, setVerseSubmitting] = useState(false);
  const [snackPendingIds, setSnackPendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [memoryVerseBook, setMemoryVerseBook] = useState(
    DEFAULT_MEMORY_VERSE_BOOK,
  );
  const [memoryVerseChapter, setMemoryVerseChapter] = useState(
    DEFAULT_MEMORY_VERSE_CHAPTER,
  );
  const [memoryVerseNumber, setMemoryVerseNumber] = useState(
    DEFAULT_MEMORY_VERSE_NUMBER,
  );
  const [memoryChapterData, setMemoryChapterData] =
    useState<BibleChapterResponse | null>(null);
  const [memoryChapterLoading, setMemoryChapterLoading] = useState(false);
  const [memoryChapterError, setMemoryChapterError] = useState<string | null>(
    null,
  );
  const [chapterData, setChapterData] = useState<BibleChapterResponse | null>(
    null,
  );
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [chapterHighlights, setChapterHighlights] = useState<VerseHighlight[]>(
    [],
  );
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<Set<number>>(
    () => new Set(),
  );
  const [highlightSubmitting, setHighlightSubmitting] = useState(false);
  const [sharingVerse, setSharingVerse] = useState(false);
  const [showReaderSettingsModal, setShowReaderSettingsModal] = useState(false);
  const [showVerseNumbers, setShowVerseNumbers] = useState(true);
  const [showEsvHeadings, setShowEsvHeadings] = useState(true);
  const [showPassagePickerModal, setShowPassagePickerModal] = useState(false);
  const [passagePickerStep, setPassagePickerStep] = useState<
    "book" | "chapter" | "verse"
  >("book");
  const [passagePickerContext, setPassagePickerContext] =
    useState<PassagePickerContext>("reader");
  const [passagePickerBook, setPassagePickerBook] = useState(selectedBook);
  const [passagePickerTestament, setPassagePickerTestament] =
    useState<BibleTestament>(getTestamentForBook(selectedBook));

  const loadVerseReader = async (
    book: string,
    chapter: number,
    options: { token?: string; showLoader?: boolean } = {},
  ) => {
    const shouldShowLoader = options.showLoader ?? true;
    if (shouldShowLoader) {
      setChapterLoading(true);
      setHighlightsLoading(true);
    }
    setChapterError(null);

    try {
      const token = options.token ?? (await getToken());
      if (!token) {
        await signOut();
        return;
      }
      const [chapterRes, highlightsRes] = await Promise.all([
        getEsvChapter(token, book, chapter),
        getVerseHighlights(token, book, chapter),
      ]);
      setChapterData(chapterRes);
      setChapterHighlights(Array.isArray(highlightsRes) ? highlightsRes : []);
      setSelectedVerseNumbers((current) => {
        if (current.size === 0) return current;
        const availableVerseNumbers = new Set(
          chapterRes.verses.map((item) => item.verseNumber),
        );
        const next = new Set<number>();
        current.forEach((verseNumber) => {
          if (availableVerseNumbers.has(verseNumber)) {
            next.add(verseNumber);
          }
        });
        return next;
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const lower = message.toLowerCase();
      if (lower.includes("unauthorized") || lower.includes("(401)")) {
        await signOut();
        return;
      }
      if (lower.includes("esv api unavailable") || lower.includes("(503)")) {
        setChapterError(
          "Scripture service is not configured. Add ESV_API_KEY on the API server.",
        );
      } else {
        setChapterError(friendlyLoadError(message));
      }
    } finally {
      setChapterLoading(false);
      setHighlightsLoading(false);
    }
  };

  const loadMemoryVerseChapter = async (book: string, chapter: number) => {
    setMemoryChapterLoading(true);
    setMemoryChapterError(null);
    try {
      const token = await getToken();
      if (!token) {
        await signOut();
        return;
      }
      const chapterRes = await getEsvChapter(token, book, chapter);
      setMemoryChapterData(chapterRes);
      const parsedVerse = Number.parseInt(memoryVerseNumber, 10);
      if (Number.isFinite(parsedVerse) && parsedVerse > 0) {
        const matchedVerse =
          chapterRes.verses.find((item) => item.verseNumber === parsedVerse) ??
          null;
        if (!matchedVerse) {
          setMemoryVerseNumber("");
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const lower = message.toLowerCase();
      if (lower.includes("unauthorized") || lower.includes("(401)")) {
        await signOut();
        return;
      }
      if (lower.includes("esv api unavailable") || lower.includes("(503)")) {
        setMemoryChapterError(
          "Scripture service is not configured. Add ESV_API_KEY on the API server.",
        );
      } else {
        setMemoryChapterError(friendlyLoadError(message));
      }
      setMemoryChapterData(null);
    } finally {
      setMemoryChapterLoading(false);
    }
  };

  const load = async () => {
    const token = await getToken();
    if (!token) {
      setLoading(false);
      setRefreshing(false);
      await signOut();
      return;
    }
    setLoadError(null);
    setLoadErrorRaw(null);
    try {
      await syncUser(token);
      const [
        meRes,
        membersRes,
        announcementsRes,
        slotsRes,
        topicRes,
        prayersRes,
        versesRes,
      ] = await Promise.all([
        getMe(token),
        getGroupMembers(token),
        getAnnouncements(token),
        getSnackSlots(token),
        getDiscussionTopic(token),
        getPrayerRequests(token),
        getVerseMemory(token),
      ]);
      setMe(meRes);
      setMembers(membersRes?.members ?? []);
      setAnnouncements(Array.isArray(announcementsRes) ? announcementsRes : []);
      setSnackSlots(Array.isArray(slotsRes) ? slotsRes : []);
      setDiscussionTopicState(topicRes ?? null);
      setPrayerRequests(Array.isArray(prayersRes) ? prayersRes : []);
      setVerseMemory(Array.isArray(versesRes) ? versesRes : []);
      await loadVerseReader(selectedBook, selectedChapter, {
        token,
        showLoader: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const lower = message.toLowerCase();
      const authFailed =
        lower.includes("tenant or user not found") ||
        lower.includes("unauthorized") ||
        lower.includes("(401)");
      if (authFailed) {
        await signOut();
        return;
      }
      console.error(e);
      setLoadErrorRaw(message);
      setLoadError(friendlyLoadError(message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const parsedVerse = Number.parseInt(memoryVerseNumber, 10);
    const hasVerse = Number.isFinite(parsedVerse) && parsedVerse > 0;
    if (!showVerseModal || !hasVerse) return;
    void loadMemoryVerseChapter(memoryVerseBook, memoryVerseChapter);
  }, [
    showVerseModal,
    memoryVerseNumber,
    memoryVerseBook,
    memoryVerseChapter,
  ]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const isAdmin = me?.role === "admin";
  const selectedBirthdayMonth = parseBirthdayPart(birthdayMonth);
  const selectedBirthdayDay = parseBirthdayPart(birthdayDay);
  const birthdayMaxDay =
    selectedBirthdayMonth &&
    selectedBirthdayMonth >= 1 &&
    selectedBirthdayMonth <= 12
      ? daysInMonth(selectedBirthdayMonth)
      : 31;
  const birthdayDayOptions = Array.from(
    { length: birthdayMaxDay },
    (_, index) => index + 1,
  );
  const canSaveBirthday =
    !birthdaySubmitting &&
    !!selectedBirthdayMonth &&
    selectedBirthdayMonth >= 1 &&
    selectedBirthdayMonth <= 12 &&
    !!selectedBirthdayDay &&
    selectedBirthdayDay >= 1 &&
    selectedBirthdayDay <= birthdayMaxDay;
  const birthdayPreview =
    selectedBirthdayMonth && selectedBirthdayDay
      ? new Date(
          2024,
          selectedBirthdayMonth - 1,
          selectedBirthdayDay,
          12,
          0,
          0,
        ).toLocaleDateString(undefined, { month: "long", day: "numeric" })
      : "Select your month and day";
  const birthdayAnnouncements = members
    .map((member) => buildBirthdayAnnouncement(member, new Date()))
    .filter((item): item is BirthdayAnnouncement => item !== null)
    .sort((a, b) => {
      const left = Math.abs(a.birthdayOffsetDays);
      const right = Math.abs(b.birthdayOffsetDays);
      if (left !== right) return left - right;
      return b.birthdayOffsetDays - a.birthdayOffsetDays;
    });
  const announcementFeed: AnnouncementFeedItem[] = [
    ...birthdayAnnouncements,
    ...announcements,
  ];
  const pickerBookOption =
    BIBLE_BOOKS.find((option) => option.name === passagePickerBook) ??
    BIBLE_BOOKS[0];
  const passageBooksForTestament =
    passagePickerTestament === "old"
      ? BIBLE_BOOKS.slice(0, OLD_TESTAMENT_BOOK_COUNT)
      : BIBLE_BOOKS.slice(OLD_TESTAMENT_BOOK_COUNT);
  const activePassageBook =
    passagePickerContext === "reader" ? selectedBook : memoryVerseBook;
  const activePassageChapter =
    passagePickerContext === "reader" ? selectedChapter : memoryVerseChapter;
  const memoryVerseNumberValue = Number.parseInt(memoryVerseNumber, 10);
  const hasValidMemoryVerseNumber =
    Number.isFinite(memoryVerseNumberValue) && memoryVerseNumberValue > 0;
  const memoryVerseReferencePreview = hasValidMemoryVerseNumber
    ? `${memoryVerseBook} ${memoryVerseChapter}:${memoryVerseNumberValue}`
    : `${memoryVerseBook} ${memoryVerseChapter}`;
  const selectedMemoryVerseFromChapter =
    hasValidMemoryVerseNumber && memoryChapterData
      ? (memoryChapterData.verses.find(
          (item) => item.verseNumber === memoryVerseNumberValue,
        ) ?? null)
      : null;
  const autoMemoryVerseText = selectedMemoryVerseFromChapter?.text.trim() ?? "";
  const chapterVerseHighlightCount = chapterHighlights.reduce<
    Record<number, number>
  >((acc, item) => {
    acc[item.verseNumber] = (acc[item.verseNumber] ?? 0) + 1;
    return acc;
  }, {});
  const otherVerseHighlightCountByNumber = chapterHighlights.reduce<
    Record<number, number>
  >((acc, item) => {
    if (!item.isMine) {
      acc[item.verseNumber] = (acc[item.verseNumber] ?? 0) + 1;
    }
    return acc;
  }, {});
  const myVerseHighlightByNumber = chapterHighlights.reduce<
    Record<number, VerseHighlight>
  >((acc, item) => {
    if (item.isMine && !acc[item.verseNumber]) {
      acc[item.verseNumber] = item;
    }
    return acc;
  }, {});
  const selectedVerses = (chapterData?.verses ?? []).filter((item) =>
    selectedVerseNumbers.has(item.verseNumber),
  );
  const selectedVersesMine = selectedVerses
    .map((item) => myVerseHighlightByNumber[item.verseNumber])
    .filter((item): item is VerseHighlight => !!item);
  const allSelectedHighlightedByMe =
    selectedVerses.length > 0 &&
    selectedVerses.every((item) => !!myVerseHighlightByNumber[item.verseNumber]);

  const onPublishAnnouncement = async () => {
    const token = await getToken();
    if (!token || !newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);
    try {
      await createAnnouncement(token, {
        title: newTitle.trim(),
        body: newBody.trim(),
      });
      setNewTitle("");
      setNewBody("");
      setShowNewAnnouncement(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSnackSignup = async (slot: SnackSlot) => {
    const token = await getToken();
    if (!token || !me?.id) return;
    if (snackPendingIds.has(slot.id)) return;
    const isSignedUp = slot.signups.some((s) => s.id === me.id);
    const optimisticSignup = {
      id: me.id,
      displayName: safeName(me.displayName, me.email, "Member"),
      email: me.email,
    };
    let previousSignups: SnackSlot["signups"] | null = null;
    setSnackPendingIds((prev) => {
      const next = new Set(prev);
      next.add(slot.id);
      return next;
    });
    setSnackSlots((prevSlots) =>
      prevSlots.map((existingSlot) => {
        if (existingSlot.id !== slot.id) return existingSlot;
        previousSignups = existingSlot.signups.map((signup) => ({ ...signup }));
        if (isSignedUp) {
          return {
            ...existingSlot,
            signups: existingSlot.signups.filter(
              (signup) => signup.id !== me.id,
            ),
          };
        }
        const alreadyInList = existingSlot.signups.some(
          (signup) => signup.id === me.id,
        );
        return alreadyInList
          ? existingSlot
          : {
              ...existingSlot,
              signups: [...existingSlot.signups, optimisticSignup],
            };
      }),
    );
    try {
      if (isSignedUp) {
        await snackSignOff(token, slot.id);
      } else {
        await snackSignUp(token, slot.id);
      }
      void getSnackSlots(token)
        .then((freshSlots) => {
          if (Array.isArray(freshSlots)) {
            setSnackSlots(freshSlots);
          }
        })
        .catch(() => {});
    } catch (e) {
      if (previousSignups) {
        setSnackSlots((prevSlots) =>
          prevSlots.map((existingSlot) =>
            existingSlot.id === slot.id
              ? { ...existingSlot, signups: previousSignups ?? [] }
              : existingSlot,
          ),
        );
      }
      Alert.alert("Error", (e as Error).message);
    } finally {
      setSnackPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(slot.id);
        return next;
      });
    }
  };

  const onAddPrayerRequest = async () => {
    const token = await getToken();
    if (!token || !prayerContent.trim()) return;
    setPrayerSubmitting(true);
    try {
      await createPrayerRequest(token, {
        content: prayerContent.trim(),
        isPrivate: prayerPrivate,
      });
      setPrayerContent("");
      setPrayerPrivate(false);
      setShowPrayerModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setPrayerSubmitting(false);
    }
  };

  const onTogglePrayed = async (pr: PrayerRequest) => {
    const token = await getToken();
    if (!token) return;
    try {
      await updatePrayerRequestPrayed(token, pr.id, !pr.prayed);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    }
  };

  const onSaveVerse = async () => {
    const token = await getToken();
    if (!token || !hasValidMemoryVerseNumber) return;
    setVerseSubmitting(true);
    try {
      await setVerseOfMonth(token, {
        verseReference: memoryVerseReferencePreview,
        verseSnippet: autoMemoryVerseText || undefined,
      });
      setShowVerseModal(false);
      setMemoryVerseNumber("");
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setVerseSubmitting(false);
    }
  };

  const onToggleVerseMemorized = async (v: VerseMemory) => {
    const token = await getToken();
    if (!token) return;
    try {
      await setVerseMemorized(token, v.id, !v.memorized);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    }
  };

  const openVerseMemoryModal = () => {
    const existing = parseBookChapterVerseFromReference(
      verseMemory[0]?.verseReference ?? "",
    );
    const nextBook = existing?.book ?? DEFAULT_MEMORY_VERSE_BOOK;
    const nextChapter = existing?.chapter ?? DEFAULT_MEMORY_VERSE_CHAPTER;
    setMemoryVerseBook(nextBook);
    setMemoryVerseChapter(nextChapter);
    setMemoryVerseNumber(
      existing?.verseNumber
        ? String(existing.verseNumber)
        : DEFAULT_MEMORY_VERSE_NUMBER,
    );
    setMemoryChapterData(null);
    setMemoryChapterError(null);
    setShowVerseModal(true);
  };

  const openMemoryVersePicker = () => {
    setPassagePickerContext("memory");
    setPassagePickerBook(memoryVerseBook);
    setPassagePickerTestament(getTestamentForBook(memoryVerseBook));
    setPassagePickerStep("verse");
    setShowVerseModal(false);
    setShowPassagePickerModal(true);
    void loadMemoryVerseChapter(memoryVerseBook, memoryVerseChapter);
  };

  const onSelectPassageVerse = (verse: BibleChapterVerse) => {
    setMemoryVerseNumber(String(verse.verseNumber));
    setShowPassagePickerModal(false);
    setShowVerseModal(true);
  };

  const openBookPassagePicker = (context: PassagePickerContext = "reader") => {
    const book = context === "reader" ? selectedBook : memoryVerseBook;
    setPassagePickerContext(context);
    setPassagePickerBook(book);
    setPassagePickerTestament(getTestamentForBook(book));
    setPassagePickerStep("book");
    if (context === "memory") {
      setShowVerseModal(false);
    }
    setShowPassagePickerModal(true);
  };

  const openChapterPassagePicker = (
    context: PassagePickerContext = "reader",
  ) => {
    const book = context === "reader" ? selectedBook : memoryVerseBook;
    setPassagePickerContext(context);
    setPassagePickerBook(book);
    setPassagePickerStep("chapter");
    if (context === "memory") {
      setShowVerseModal(false);
    }
    setShowPassagePickerModal(true);
  };

  const onSelectPassageBook = (book: string) => {
    setPassagePickerBook(book);
    setPassagePickerStep("chapter");
  };

  const onSelectPassageChapter = (chapter: number) => {
    if (passagePickerContext === "memory") {
      setMemoryVerseBook(passagePickerBook);
      setMemoryVerseChapter(chapter);
      setMemoryVerseNumber("");
      setMemoryChapterData(null);
      setMemoryChapterError(null);
      setPassagePickerStep("verse");
      void loadMemoryVerseChapter(passagePickerBook, chapter);
      return;
    }
    setSelectedBook(passagePickerBook);
    setSelectedChapter(chapter);
    setSelectedVerseNumbers(new Set());
    setShowPassagePickerModal(false);
    void loadVerseReader(passagePickerBook, chapter);
  };

  const onJumpToVerseReference = (reference: string) => {
    const parsed = parseBookAndChapterFromReference(reference);
    if (!parsed) {
      Alert.alert(
        "Unable to jump",
        "This verse reference format is not supported yet.",
      );
      return;
    }
    setActiveTab("verse");
    setSelectedBook(parsed.book);
    setSelectedChapter(parsed.chapter);
    setSelectedVerseNumbers(new Set());
    void loadVerseReader(parsed.book, parsed.chapter);
  };

  const onToggleSelectedHighlight = async () => {
    if (selectedVerses.length === 0 || !chapterData) return;
    const token = await getToken();
    if (!token) {
      await signOut();
      return;
    }

    setHighlightSubmitting(true);
    try {
      if (allSelectedHighlightedByMe) {
        await Promise.all(
          selectedVersesMine.map((item) => deleteVerseHighlight(token, item.id)),
        );
      } else {
        const toCreate = selectedVerses.filter(
          (item) => !myVerseHighlightByNumber[item.verseNumber],
        );
        await Promise.all(
          toCreate.map((item) =>
            createVerseHighlight(token, {
              book: selectedBook,
              chapter: selectedChapter,
              verseNumber: item.verseNumber,
              verseReference: item.reference,
            }),
          ),
        );
      }
      const refreshedHighlights = await getVerseHighlights(
        token,
        selectedBook,
        selectedChapter,
      );
      setChapterHighlights(
        Array.isArray(refreshedHighlights) ? refreshedHighlights : [],
      );
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setHighlightSubmitting(false);
    }
  };

  const onShareSelectedVerse = async () => {
    if (selectedVerses.length === 0) return;
    setSharingVerse(true);
    try {
      const orderedVerses = [...selectedVerses].sort(
        (a, b) => a.verseNumber - b.verseNumber,
      );
      const combinedReference = formatVerseRangeLabel(
        selectedBook,
        selectedChapter,
        orderedVerses.map((item) => item.verseNumber),
      );
      const combinedText = orderedVerses
        .map((item) => item.text)
        .join(" ");
      const attribution = chapterData?.attribution ?? "(ESV)";
      await Share.share({
        message: `${combinedReference} ${attribution}\n\n${combinedText}`,
      });
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setSharingVerse(false);
    }
  };

  const onDeletePrayerRequest = (pr: PrayerRequest) => {
    Alert.alert("Delete prayer request", "Remove this request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          try {
            await deletePrayerRequest(token, pr.id);
            load();
          } catch (e) {
            Alert.alert("Error", (e as Error).message);
          }
        },
      },
    ]);
  };

  const onClosePassagePicker = () => {
    setShowPassagePickerModal(false);
    if (passagePickerContext === "memory") {
      setShowVerseModal(true);
    }
  };

  const onSaveBirthday = async () => {
    const token = await getToken();
    if (!token) return;
    const m = parseInt(birthdayMonth, 10);
    const d = parseInt(birthdayDay, 10);
    const maxDay = m >= 1 && m <= 12 ? daysInMonth(m) : 31;
    if (!m || m < 1 || m > 12 || !d || d < 1 || d > maxDay) {
      Alert.alert("Invalid", "Please choose a valid month and day.");
      return;
    }
    setBirthdaySubmitting(true);
    try {
      await updateMe(token, { birthdayMonth: m, birthdayDay: d });
      setShowBirthdayModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setBirthdaySubmitting(false);
    }
  };

  const onSaveTopic = async () => {
    const token = await getToken();
    if (!token || !topicTitle.trim()) return;
    setTopicSubmitting(true);
    try {
      await setDiscussionTopic(token, {
        title: topicTitle.trim(),
        description: topicDescription.trim() || undefined,
        bibleReference: topicBibleRef.trim() || undefined,
        bibleText: topicBibleText.trim() || undefined,
      });
      setShowTopicModal(false);
      load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setTopicSubmitting(false);
    }
  };

  const onDeleteAnnouncement = (item: Announcement) => {
    Alert.alert("Delete announcement", `Delete "${item.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          try {
            await deleteAnnouncement(token, item.id);
            load();
          } catch (e) {
            Alert.alert("Error", (e as Error).message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView
      edges={["left", "right"]}
      style={[styles.screen, { paddingTop: insets.top }]}
    >
      {activeTab === "verse" ? (
        <View style={[styles.section, styles.versePinnedHeaderSection]}>
          <View style={[styles.sectionHeader, styles.verseSectionHeader]}>
            <Pressable
              style={({ pressed }) => [
                styles.currentBookButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => openBookPassagePicker()}
              accessibilityLabel="Choose Bible book"
            >
              <Text
                style={[styles.sectionTitle, styles.readerBookTitle]}
                numberOfLines={1}
              >
                {selectedBook}
              </Text>
              <Ionicons name="chevron-down" size={16} style={styles.tabIcon} />
            </Pressable>
            <View style={styles.verseHeaderActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.passagePickerButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => openChapterPassagePicker()}
                accessibilityLabel={`Choose chapter in ${selectedBook}`}
              >
                <Text style={styles.passagePickerButtonText}>
                  {selectedChapter}
                </Text>
                <Ionicons name="chevron-down" size={14} style={styles.tabIcon} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.readerSettingsIconButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowReaderSettingsModal(true)}
                accessibilityLabel="Open reader settings"
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  style={styles.readerSettingsIcon}
                />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loadError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{loadError}</Text>
            <Text style={styles.errorBannerHint}>
              Pull to refresh. On a real device, set EXPO_PUBLIC_API_URL to your
              computer’s IP (e.g. http://192.168.1.x:3001), not localhost.
            </Text>
            {loadErrorRaw && loadErrorRaw !== loadError ? (
              <Text style={styles.errorBannerDetail}>
                Details: {loadErrorRaw}
              </Text>
            ) : null}
          </View>
        ) : null}
        {activeTab === "settings" ? (
          <View style={styles.header}>
            <Image
              source={require("../../../sglogo.png")}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.headerTextWrap}>
              <Text style={styles.title}>Small Group</Text>
              <Text style={styles.subtitle}>
                Hello, {safeName(me?.displayName, me?.email, "Member")}
              </Text>
            </View>
          </View>
        ) : null}

        {activeTab === "home" ? (
          <>
            <View style={[styles.section, styles.tabPageTitleSection]}>
              <Text style={[styles.sectionTitle, styles.readerBookTitle]}>
                Home
              </Text>
            </View>
            <View style={[styles.section, styles.homeSection]}>
              <View style={[styles.sectionHeader, styles.homeSectionHeader]}>
                <Text style={styles.sectionTitle}>
                  Discussion topic of the month
                </Text>
                {isAdmin && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.addBtn,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => {
                      setTopicTitle(discussionTopic?.title ?? "");
                      setTopicDescription(discussionTopic?.description ?? "");
                      setTopicBibleRef(discussionTopic?.bibleReference ?? "");
                      setTopicBibleText(discussionTopic?.bibleText ?? "");
                      setShowTopicModal(true);
                    }}
                  >
                    <Text style={styles.addBtnText}>
                      {discussionTopic ? "Edit" : "Set"}
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.homeSectionLead}>
                One focus topic to guide this month's conversation.
              </Text>
              {discussionTopic ? (
                <View style={[styles.topicCard, styles.homeCard]}>
                  <Text style={styles.topicTitle}>{discussionTopic.title}</Text>
                  {discussionTopic.description ? (
                    <Text style={styles.topicDescription}>
                      {discussionTopic.description}
                    </Text>
                  ) : null}
                  {discussionTopic.bibleReference ? (
                    <Text style={styles.topicRef}>
                      {discussionTopic.bibleReference}
                    </Text>
                  ) : null}
                  {discussionTopic.bibleText ? (
                    <Text style={styles.topicText}>
                      {discussionTopic.bibleText}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <Text style={[styles.muted, styles.homeEmpty]}>
                  No topic set for this month.
                </Text>
              )}
            </View>

            <View style={[styles.section, styles.homeSection]}>
              <View style={[styles.sectionHeader, styles.homeSectionHeader]}>
                <Text style={styles.sectionTitle}>Announcements</Text>
                {isAdmin && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.addBtn,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => setShowNewAnnouncement(true)}
                  >
                    <Text style={styles.addBtnText}>Add</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.homeSectionLead}>
                Latest updates, reminders, and important group info.
              </Text>
              {announcementFeed.length === 0 ? (
                <Text style={[styles.muted, styles.homeEmpty]}>
                  No announcements yet.
                </Text>
              ) : (
                announcementFeed.map((item) => (
                  <View
                    key={item.id}
                    style={[styles.announcementCard, styles.homeCard]}
                  >
                    <Text style={styles.announcementTitle}>{item.title}</Text>
                    <Text style={styles.announcementBody}>{item.body}</Text>
                    {isAdmin && !isBirthdayAnnouncement(item) && (
                      <Pressable
                        style={styles.deleteAnnouncement}
                        onPress={() => onDeleteAnnouncement(item)}
                      >
                        <Text style={styles.deleteAnnouncementText}>
                          Delete
                        </Text>
                      </Pressable>
                    )}
                  </View>
                ))
              )}
            </View>

            <View style={[styles.section, styles.homeSection]}>
              <View style={[styles.sectionHeader, styles.homeSectionHeader]}>
                <Text style={styles.sectionTitle}>Bible verse memory</Text>
                {isAdmin && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.addBtn,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={openVerseMemoryModal}
                  >
                    <Text style={styles.addBtnText}>
                      {verseMemory.length ? "Edit" : "Set verse"}
                    </Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.homeSectionLead}>
                Keep this month's verse top of mind.
              </Text>
              {verseMemory.length === 0 ? (
                <Text style={[styles.muted, styles.homeEmpty]}>
                  No verse set for this month.
                </Text>
              ) : (
                verseMemory.map((v) => (
                  <View key={v.id} style={[styles.verseCard, styles.homeCard]}>
                    <Text style={styles.verseRef}>{v.verseReference}</Text>
                    {v.verseSnippet ? (
                      <Text style={styles.verseSnippet}>{v.verseSnippet}</Text>
                    ) : null}
                    <Pressable
                      style={({ pressed }) => [
                        styles.jumpToReaderButton,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => onJumpToVerseReference(v.verseReference)}
                    >
                      <Text style={styles.jumpToReaderText}>
                        Read this chapter
                      </Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [
                        styles.prayedButton,
                        v.memorized && styles.prayedButtonActive,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => onToggleVerseMemorized(v)}
                    >
                      <Text
                        style={[
                          styles.prayedButtonText,
                          v.memorized && styles.prayedButtonTextActive,
                        ]}
                      >
                        {v.memorized ? "Memorized" : "I memorized this"}
                      </Text>
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {activeTab === "prayer" ? (
          <>
            <View style={[styles.section, styles.tabPageTitleSection]}>
              <Text style={[styles.sectionTitle, styles.readerBookTitle]}>
                Pray
              </Text>
            </View>
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Prayer requests</Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.addBtn,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setShowPrayerModal(true)}
                >
                  <Text style={styles.addBtnText}>Add</Text>
                </Pressable>
              </View>
              {prayerRequests.length === 0 ? (
                <Text style={styles.muted}>No prayer requests yet.</Text>
              ) : (
                prayerRequests.map((pr) => (
                  <View key={pr.id} style={styles.prayerCard}>
                    <Text style={styles.prayerContent}>{pr.content}</Text>
                    <Text style={styles.prayerMeta}>
                      {safeName(pr.authorName, null, "Someone")}
                      {pr.isPrivate ? " (private)" : ""}
                    </Text>
                    <View style={styles.prayerActions}>
                      <Pressable
                        style={({ pressed }) => [
                          styles.prayedButton,
                          pr.prayed && styles.prayedButtonActive,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => onTogglePrayed(pr)}
                      >
                        <Text
                          style={[
                            styles.prayedButtonText,
                            pr.prayed && styles.prayedButtonTextActive,
                          ]}
                        >
                          {pr.prayed ? "Prayed" : "Mark prayed"}
                        </Text>
                      </Pressable>
                      {pr.authorId === me?.id && (
                        <Pressable
                          style={styles.deleteAnnouncement}
                          onPress={() => onDeletePrayerRequest(pr)}
                        >
                          <Text style={styles.deleteAnnouncementText}>
                            Delete
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}

        {activeTab === "verse" ? (
          <View style={styles.section}>
            <View style={styles.verseReaderCard}>
              {chapterLoading ? (
                <View style={styles.readerLoadingRow}>
                  <ActivityIndicator size="small" color={nature.primary} />
                  <Text style={styles.muted}>Loading chapter...</Text>
                </View>
              ) : null}

              {!chapterLoading && chapterError ? (
                <View style={styles.readerErrorCard}>
                  <Text style={styles.errorBannerText}>{chapterError}</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.addBtn,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() =>
                      loadVerseReader(selectedBook, selectedChapter)
                    }
                  >
                    <Text style={styles.addBtnText}>Retry</Text>
                  </Pressable>
                </View>
              ) : null}

              {!chapterLoading && !chapterError && chapterData ? (
                chapterData.verses.length === 0 ? (
                  <Text style={styles.muted}>No verses available.</Text>
                ) : (
                  <View style={styles.readerParagraphCard}>
                    <Text style={styles.readerParagraphText}>
                      {chapterData.verses.map((item, index) => {
                        const selected = selectedVerseNumbers.has(
                          item.verseNumber,
                        );
                        const highlightedByMe =
                          !!myVerseHighlightByNumber[item.verseNumber];
                        const highlightedByOthers =
                          (otherVerseHighlightCountByNumber[
                            item.verseNumber
                          ] ?? 0) > 0;
                        const hasAnyHighlight =
                          (chapterVerseHighlightCount[item.verseNumber] ?? 0) >
                          0;
                        return (
                          <Text
                            key={`${item.reference}-${item.verseNumber}`}
                            onPress={() =>
                              setSelectedVerseNumbers((current) => {
                                const next = new Set(current);
                                if (next.has(item.verseNumber)) {
                                  next.delete(item.verseNumber);
                                } else {
                                  next.add(item.verseNumber);
                                }
                                return next;
                              })
                            }
                            style={[
                              styles.readerVerseInline,
                              highlightedByOthers &&
                                styles.readerVerseInlineHasHighlight,
                              highlightedByMe && styles.readerVerseInlineMine,
                              selected && styles.readerVerseInlineSelected,
                            ]}
                          >
                            {showEsvHeadings && item.heading ? (
                              <Text style={styles.readerEsvHeading}>
                                {index > 0 ? "\n" : ""}
                                {item.heading.trim()}
                                {"\n"}
                              </Text>
                            ) : null}
                            {showVerseNumbers ? (
                              <Text
                                style={[
                                  styles.readerVerseInlineNumber,
                                  hasAnyHighlight &&
                                    styles.readerVerseInlineNumberHighlighted,
                                ]}
                              >
                                {item.verseNumber}{" "}
                              </Text>
                            ) : null}
                            {item.text}
                            {index < chapterData.verses.length - 1 ? " " : ""}
                          </Text>
                        );
                      })}
                    </Text>
                  </View>
                )
              ) : null}

              <Text style={styles.esvAttribution}>
                {chapterData?.attribution ?? "(ESV)"}
              </Text>
            </View>

            <View style={styles.verseHighlightsCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Highlights in {selectedBook} {selectedChapter}
                </Text>
              </View>
              {highlightsLoading ? (
                <View style={styles.readerLoadingRow}>
                  <ActivityIndicator size="small" color={nature.primary} />
                  <Text style={styles.muted}>Loading highlights...</Text>
                </View>
              ) : chapterHighlights.length === 0 ? (
                <Text style={styles.muted}>
                  No highlights yet in this chapter.
                </Text>
              ) : (
                chapterHighlights.map((item) => (
                  <View key={item.id} style={styles.chapterHighlightRow}>
                    <Text style={styles.chapterHighlightTitle}>
                      {item.verseReference}
                    </Text>
                    <Text style={styles.chapterHighlightMeta}>
                      {item.userName}
                      {item.isMine ? " (You)" : ""}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        {activeTab === "settings" ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Settings</Text>
              <View style={styles.settingsCard}>
                <Text style={styles.settingsLabel}>Name</Text>
                <Text style={styles.settingsValue}>
                  {safeName(me?.displayName, me?.email, "Member")}
                </Text>
                <Text style={styles.settingsLabel}>Email</Text>
                <Text style={styles.settingsValue}>{me?.email ?? "-"}</Text>
                <Text style={styles.settingsLabel}>Role</Text>
                <Text style={styles.settingsValue}>
                  {getRoleLabel(me?.role)}
                </Text>
                <Text style={styles.settingsLabel}>Scripture attribution</Text>
                <Pressable
                  onPress={() => {
                    void Linking.openURL("https://www.esv.org").catch(() => {
                      Alert.alert(
                        "Unable to open link",
                        "Please visit https://www.esv.org",
                      );
                    });
                  }}
                >
                  <Text style={styles.settingsLink}>
                    ESV text from Crossway
                  </Text>
                </Pressable>
                <View style={styles.settingsActions}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.addBtn,
                      pressed && styles.buttonPressed,
                    ]}
                    onPress={() => {
                      setBirthdayMonth(me?.birthdayMonth?.toString() ?? "");
                      setBirthdayDay(me?.birthdayDay?.toString() ?? "");
                      setShowBirthdayModal(true);
                    }}
                  >
                    <Text style={styles.addBtnText}>
                      {me?.birthdayMonth ? "Edit birthday" : "Set birthday"}
                    </Text>
                  </Pressable>
                </View>
              </View>
              <Pressable
                style={({ pressed }) => [
                  styles.signOut,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => signOut()}
              >
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Group members</Text>
              {members.length === 0 ? (
                <Text style={styles.muted}>No members yet.</Text>
              ) : (
                members.map((m) => (
                  <View key={m.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>
                      {safeName(m.displayName, m.email, "Member")} (
                      {getRoleLabel(m.role)})
                    </Text>
                  </View>
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {activeTab === "verse" && selectedVerseNumbers.size > 0 ? (
        <View style={styles.verseActionBar}>
          <Pressable
            style={({ pressed }) => [
              styles.verseActionButton,
              styles.verseActionSecondary,
              highlightSubmitting && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={onToggleSelectedHighlight}
            disabled={highlightSubmitting}
          >
            <Ionicons
              name={
                allSelectedHighlightedByMe ? "bookmark" : "bookmark-outline"
              }
              size={18}
              style={styles.tabIcon}
            />
            <Text style={styles.verseActionSecondaryText}>
              {allSelectedHighlightedByMe ? "Unhighlight" : "Highlight"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.verseActionButton,
              styles.verseActionPrimary,
              sharingVerse && styles.buttonDisabled,
              pressed && styles.buttonPressed,
            ]}
            onPress={onShareSelectedVerse}
            disabled={sharingVerse}
          >
            <Ionicons
              name="share-social-outline"
              size={18}
              color={nature.primaryForeground}
            />
            <Text style={styles.verseActionPrimaryText}>Share</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.verseActionClearButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => setSelectedVerseNumbers(new Set())}
            accessibilityLabel="Clear selected verses"
          >
            <Ionicons name="close" size={14} style={styles.tabIcon} />
          </Pressable>
        </View>
      ) : null}

      <View
        style={[
          styles.bottomNav,
          { paddingBottom: Math.max(8, insets.bottom) },
        ]}
      >
        {APP_TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              style={({ pressed }) => [
                styles.tabButton,
                isActive && styles.tabButtonActive,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => setActiveTab(tab.key)}
              hitSlop={6}
            >
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={22}
                style={[styles.tabIcon, isActive && styles.tabIconActive]}
              />
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Modal
        visible={showPassagePickerModal}
        transparent
        animationType="slide"
        onRequestClose={onClosePassagePicker}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.sectionHeader}>
              <Text style={styles.modalTitle}>
                {passagePickerStep === "book"
                  ? "Choose book"
                  : passagePickerStep === "chapter"
                    ? "Choose chapter"
                    : `Choose verse`}
              </Text>
              {passagePickerStep === "chapter" ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.addBtn,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPassagePickerStep("book")}
                >
                  <Text style={styles.addBtnText}>Books</Text>
                </Pressable>
              ) : passagePickerStep === "verse" ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.addBtn,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPassagePickerStep("chapter")}
                >
                  <Text style={styles.addBtnText}>Chapters</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.muted}>
              {passagePickerStep === "book"
                ? "Select a book, then choose a chapter."
                : passagePickerStep === "chapter"
                  ? `Select a chapter in ${passagePickerBook}.`
                  : `Select a verse in ${memoryVerseBook} ${memoryVerseChapter}.`}
            </Text>
            {passagePickerStep === "book" ? (
              <View style={styles.passagePickerTabs}>
                <Pressable
                  style={({ pressed }) => [
                    styles.passagePickerTab,
                    passagePickerTestament === "old" &&
                      styles.passagePickerTabActive,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPassagePickerTestament("old")}
                >
                  <Text
                    style={[
                      styles.passagePickerTabText,
                      passagePickerTestament === "old" &&
                        styles.passagePickerTabTextActive,
                    ]}
                  >
                    Old Testament
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.passagePickerTab,
                    passagePickerTestament === "new" &&
                      styles.passagePickerTabActive,
                    pressed && styles.buttonPressed,
                  ]}
                  onPress={() => setPassagePickerTestament("new")}
                >
                  <Text
                    style={[
                      styles.passagePickerTabText,
                      passagePickerTestament === "new" &&
                        styles.passagePickerTabTextActive,
                    ]}
                  >
                    New Testament
                  </Text>
                </Pressable>
              </View>
            ) : null}
            <ScrollView
              style={styles.passagePickerList}
              contentContainerStyle={styles.passagePickerListContent}
            >
              {passagePickerStep === "book"
                ? passageBooksForTestament.map((book) => (
                    <Pressable
                      key={book.name}
                      style={({ pressed }) => [
                        styles.passagePickerRow,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => onSelectPassageBook(book.name)}
                    >
                      <Text style={styles.passagePickerRowTitle}>
                        {book.name}
                      </Text>
                      <Text style={styles.passagePickerRowMeta}>
                        {book.chapters} chapters
                      </Text>
                    </Pressable>
                  ))
                : passagePickerStep === "chapter"
                  ? Array.from(
                    { length: pickerBookOption.chapters },
                    (_, idx) => idx + 1,
                  ).map((chapter) => (
                    <Pressable
                      key={`${passagePickerBook}-${chapter}`}
                      style={({ pressed }) => [
                        styles.passagePickerRow,
                        chapter === activePassageChapter &&
                          passagePickerBook === activePassageBook &&
                          styles.passagePickerRowActive,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => onSelectPassageChapter(chapter)}
                    >
                      <Text style={styles.passagePickerRowTitle}>
                        Chapter {chapter}
                      </Text>
                    </Pressable>
                  ))
                  : memoryChapterLoading ? (
                    <View style={styles.memoryVerseStatusRow}>
                      <ActivityIndicator size="small" color={nature.primary} />
                      <Text style={styles.muted}>Loading verses...</Text>
                    </View>
                  ) : memoryChapterError ? (
                    <View style={styles.readerErrorCard}>
                      <Text style={styles.errorBannerText}>
                        {memoryChapterError}
                      </Text>
                      <Pressable
                        style={({ pressed }) => [
                          styles.addBtn,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() =>
                          loadMemoryVerseChapter(
                            memoryVerseBook,
                            memoryVerseChapter,
                          )
                        }
                      >
                        <Text style={styles.addBtnText}>Retry</Text>
                      </Pressable>
                    </View>
                  ) : (
                    (memoryChapterData?.verses ?? []).map((verse) => (
                      <Pressable
                        key={`${memoryVerseBook}-${memoryVerseChapter}-${verse.verseNumber}`}
                        style={({ pressed }) => [
                          styles.passagePickerRow,
                          verse.verseNumber === memoryVerseNumberValue &&
                            styles.passagePickerRowActive,
                          pressed && styles.buttonPressed,
                        ]}
                        onPress={() => onSelectPassageVerse(verse)}
                      >
                        <Text style={styles.passagePickerRowTitle}>
                          Verse {verse.verseNumber}
                        </Text>
                        <Text
                          style={styles.memoryVerseOptionText}
                          numberOfLines={2}
                        >
                          {verse.text}
                        </Text>
                      </Pressable>
                    ))
                  )}
            </ScrollView>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onClosePassagePicker}
              >
                <Text style={styles.modalButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showReaderSettingsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReaderSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Bible reader settings</Text>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Hide verse numbers</Text>
              <Switch
                value={!showVerseNumbers}
                onValueChange={(value) => setShowVerseNumbers(!value)}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Hide ESV headings</Text>
              <Switch
                value={!showEsvHeadings}
                onValueChange={(value) => setShowEsvHeadings(!value)}
              />
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowReaderSettingsModal(false)}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    styles.modalButtonTextPrimary,
                  ]}
                >
                  Done
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showVerseModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVerseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Verse of the month</Text>
            <View style={styles.memoryVersePickerRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.passagePickerButton,
                  styles.memoryVerseBookPickerButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => openBookPassagePicker("memory")}
                accessibilityLabel="Choose memory verse book"
              >
                <Text
                  style={styles.passagePickerButtonText}
                  numberOfLines={1}
                >
                  {memoryVerseBook}
                </Text>
                <Ionicons name="chevron-down" size={14} style={styles.tabIcon} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.passagePickerButton,
                  styles.memoryVerseSmallPickerButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => openChapterPassagePicker("memory")}
                accessibilityLabel={`Choose chapter in ${memoryVerseBook}`}
              >
                <Text style={styles.passagePickerButtonText}>
                  {memoryVerseChapter}
                </Text>
                <Ionicons name="chevron-down" size={14} style={styles.tabIcon} />
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.passagePickerButton,
                  styles.memoryVerseSmallPickerButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={openMemoryVersePicker}
                accessibilityLabel={`Choose verse in ${memoryVerseBook} ${memoryVerseChapter}`}
              >
                <Text style={styles.passagePickerButtonText}>
                  {hasValidMemoryVerseNumber ? memoryVerseNumber : "Verse"}
                </Text>
                <Ionicons name="chevron-down" size={14} style={styles.tabIcon} />
              </Pressable>
            </View>
            {memoryChapterError ? (
              <Text style={styles.errorBannerText}>{memoryChapterError}</Text>
            ) : null}
            <Text style={styles.memoryVersePreview}>
              Reference: {memoryVerseReferencePreview}
            </Text>
            {hasValidMemoryVerseNumber && autoMemoryVerseText ? (
              <View style={styles.memoryVerseAutoTextCard}>
                <Text style={styles.memoryVerseAutoText}>{autoMemoryVerseText}</Text>
              </View>
            ) : (
              <Text style={[styles.muted, styles.memoryVerseAutoTextHint]}>
                Choose a verse to load the text automatically.
              </Text>
            )}
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => {
                  setShowVerseModal(false);
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (!hasValidMemoryVerseNumber || verseSubmitting) &&
                    styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onSaveVerse}
                disabled={!hasValidMemoryVerseNumber || verseSubmitting}
              >
                {verseSubmitting ? (
                  <ActivityIndicator
                    color={nature.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonText,
                      styles.modalButtonTextPrimary,
                    ]}
                  >
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showPrayerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPrayerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New prayer request</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={prayerContent}
              onChangeText={setPrayerContent}
              placeholder="Your request..."
              placeholderTextColor={nature.mutedForeground}
              multiline
              numberOfLines={4}
            />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Private (only you see it)</Text>
              <Switch value={prayerPrivate} onValueChange={setPrayerPrivate} />
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowPrayerModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (!prayerContent.trim() || prayerSubmitting) &&
                    styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onAddPrayerRequest}
                disabled={!prayerContent.trim() || prayerSubmitting}
              >
                {prayerSubmitting ? (
                  <ActivityIndicator
                    color={nature.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonText,
                      styles.modalButtonTextPrimary,
                    ]}
                  >
                    Add
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showBirthdayModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBirthdayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>My birthday</Text>
            <View style={styles.birthdayPickerPanel}>
              <View style={styles.birthdayPickerHeader}>
                <Text style={styles.birthdayPickerLabel}>Selected date</Text>
                <Text style={styles.birthdayPickerValue}>
                  {birthdayPreview}
                </Text>
              </View>

              <Text style={styles.birthdayPickerLabel}>Month</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.birthdayPickerScroll}
              >
                {MONTH_OPTIONS.map((monthLabel, index) => {
                  const monthNumber = index + 1;
                  const active = selectedBirthdayMonth === monthNumber;
                  return (
                    <Pressable
                      key={monthLabel}
                      style={({ pressed }) => [
                        styles.birthdayChip,
                        active && styles.birthdayChipActive,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => {
                        setBirthdayMonth(String(monthNumber));
                        const currentDay = parseBirthdayPart(birthdayDay);
                        const maxDay = daysInMonth(monthNumber);
                        if (currentDay && currentDay > maxDay) {
                          setBirthdayDay(String(maxDay));
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.birthdayChipText,
                          active && styles.birthdayChipTextActive,
                        ]}
                      >
                        {monthLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Text style={styles.birthdayPickerLabel}>Day</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.birthdayPickerScroll}
              >
                {birthdayDayOptions.map((dayNumber) => {
                  const active = selectedBirthdayDay === dayNumber;
                  return (
                    <Pressable
                      key={dayNumber}
                      style={({ pressed }) => [
                        styles.birthdayChip,
                        active && styles.birthdayChipActive,
                        pressed && styles.buttonPressed,
                      ]}
                      onPress={() => setBirthdayDay(String(dayNumber))}
                    >
                      <Text
                        style={[
                          styles.birthdayChipText,
                          active && styles.birthdayChipTextActive,
                        ]}
                      >
                        {dayNumber}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowBirthdayModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  !canSaveBirthday && styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onSaveBirthday}
                disabled={!canSaveBirthday}
              >
                {birthdaySubmitting ? (
                  <ActivityIndicator
                    color={nature.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonText,
                      styles.modalButtonTextPrimary,
                    ]}
                  >
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showTopicModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTopicModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Discussion topic</Text>
            <TextInput
              style={styles.input}
              value={topicTitle}
              onChangeText={setTopicTitle}
              placeholder="Topic title"
              placeholderTextColor={nature.mutedForeground}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={topicDescription}
              onChangeText={setTopicDescription}
              placeholder="Description (optional)"
              placeholderTextColor={nature.mutedForeground}
              multiline
            />
            <TextInput
              style={styles.input}
              value={topicBibleRef}
              onChangeText={setTopicBibleRef}
              placeholder="Bible reference (e.g. John 3:16)"
              placeholderTextColor={nature.mutedForeground}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={topicBibleText}
              onChangeText={setTopicBibleText}
              placeholder="Bible text (optional)"
              placeholderTextColor={nature.mutedForeground}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowTopicModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (!topicTitle.trim() || topicSubmitting) &&
                    styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onSaveTopic}
                disabled={!topicTitle.trim() || topicSubmitting}
              >
                {topicSubmitting ? (
                  <ActivityIndicator
                    color={nature.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonText,
                      styles.modalButtonTextPrimary,
                    ]}
                  >
                    Save
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={showNewAnnouncement}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewAnnouncement(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New announcement</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="Title"
              placeholderTextColor={nature.mutedForeground}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              value={newBody}
              onChangeText={setNewBody}
              placeholder="Body"
              placeholderTextColor={nature.mutedForeground}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => setShowNewAnnouncement(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.modalButton,
                  styles.modalButtonPrimary,
                  (submitting || !newTitle.trim() || !newBody.trim()) &&
                    styles.buttonDisabled,
                  pressed && styles.buttonPressed,
                ]}
                onPress={onPublishAnnouncement}
                disabled={submitting || !newTitle.trim() || !newBody.trim()}
              >
                {submitting ? (
                  <ActivityIndicator
                    color={nature.primaryForeground}
                    size="small"
                  />
                ) : (
                  <Text
                    style={[
                      styles.modalButtonText,
                      styles.modalButtonTextPrimary,
                    ]}
                  >
                    Publish
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: nature.background },
  container: { flex: 1, backgroundColor: nature.background },
  scrollContent: { paddingBottom: 18 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorBanner: {
    margin: 16,
    padding: 12,
    backgroundColor: nature.destructive + "20",
    borderRadius: 10,
  },
  errorBannerText: {
    fontSize: 14,
    color: nature.foreground,
    fontWeight: "600",
  },
  errorBannerHint: {
    fontSize: 12,
    color: nature.mutedForeground,
    marginTop: 4,
  },
  errorBannerDetail: {
    fontSize: 11,
    color: nature.mutedForeground,
    marginTop: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerLogo: { width: 36, height: 36 },
  headerTextWrap: { flex: 1 },
  title: {
    fontSize: 34,
    fontWeight: "700",
    marginBottom: 4,
    color: nature.foreground,
    letterSpacing: 0.25,
  },
  subtitle: { fontSize: 16, color: nature.mutedForeground },
  section: { paddingHorizontal: 16, paddingTop: 0, marginBottom: 14 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  verseSectionHeader: {
    marginBottom: 4,
  },
  versePinnedHeaderSection: {
    marginBottom: 0,
    backgroundColor: nature.background,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
    paddingBottom: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: nature.foreground,
    letterSpacing: 0.2,
  },
  tabPageTitleSection: {
    marginBottom: 4,
  },
  readerBookTitle: {
    fontSize: 34,
    letterSpacing: 0.25,
  },
  verseHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  currentBookButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
    marginRight: 8,
  },
  readerSettingsIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: nature.muted,
  },
  readerSettingsIcon: {
    color: nature.foreground,
  },
  homeSection: { marginBottom: 24 },
  homeSectionHeader: { marginBottom: 6 },
  homeSectionLead: {
    fontSize: 14,
    lineHeight: 20,
    color: nature.mutedForeground,
    marginBottom: 12,
  },
  homeCard: {
    backgroundColor: nature.muted,
    borderBottomWidth: 0,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  homeEmpty: {
    backgroundColor: nature.muted,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  addBtn: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "transparent",
    borderRadius: 6,
  },
  addBtnText: { color: nature.primary, fontWeight: "600", fontSize: 14 },
  announcementCard: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  announcementTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 6,
    color: nature.foreground,
  },
  announcementBody: {
    fontSize: 15,
    lineHeight: 21,
    color: nature.foreground,
    marginBottom: 8,
  },
  deleteAnnouncement: { alignSelf: "flex-start" },
  deleteAnnouncementText: { color: nature.destructive, fontSize: 14 },
  memberRow: {
    paddingVertical: 10,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  memberName: { fontSize: 16, color: nature.foreground },
  muted: { color: nature.mutedForeground, fontSize: 14, lineHeight: 20 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(58,46,42,0.18)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: nature.background,
    borderRadius: 8,
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 14,
    color: nature.foreground,
    letterSpacing: 0.2,
  },
  input: {
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: "transparent",
    color: nature.foreground,
    borderBottomWidth: 1,
    borderBottomColor: nature.input,
  },
  textArea: { minHeight: 100, textAlignVertical: "top" },
  birthdayPickerPanel: {
    borderRadius: 0,
    backgroundColor: "transparent",
    padding: 0,
  },
  birthdayPickerHeader: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  birthdayPickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: nature.mutedForeground,
    marginBottom: 8,
  },
  birthdayPickerValue: {
    fontSize: 17,
    fontWeight: "700",
    color: nature.foreground,
  },
  birthdayPickerScroll: {
    paddingBottom: 8,
    gap: 8,
    paddingRight: 8,
  },
  birthdayChip: {
    minWidth: 52,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: nature.muted,
    alignItems: "center",
  },
  birthdayChipActive: {
    backgroundColor: nature.primary,
  },
  birthdayChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: nature.primary,
  },
  birthdayChipTextActive: {
    color: nature.primaryForeground,
  },
  modalButtons: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalButton: {
    flex: 1,
    padding: 13,
    alignItems: "center",
    borderRadius: 6,
    backgroundColor: nature.muted,
  },
  modalButtonPrimary: { backgroundColor: nature.primary },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: nature.foreground,
  },
  modalButtonTextPrimary: { color: nature.primaryForeground },
  snackCard: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  snackDate: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    color: nature.foreground,
  },
  snackSignups: {
    fontSize: 14,
    color: nature.mutedForeground,
    marginBottom: 8,
  },
  snackButton: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
    backgroundColor: nature.muted,
  },
  snackButtonActive: { backgroundColor: nature.primary },
  snackButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: nature.foreground,
  },
  snackButtonTextActive: { color: nature.primaryForeground },
  topicCard: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  topicTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
    color: nature.foreground,
  },
  topicDescription: {
    fontSize: 15,
    lineHeight: 21,
    color: nature.foreground,
    marginBottom: 8,
  },
  topicRef: {
    fontSize: 14,
    fontWeight: "600",
    color: nature.foreground,
    marginBottom: 4,
  },
  topicText: {
    fontSize: 14,
    color: nature.mutedForeground,
    fontStyle: "italic",
  },
  prayerCard: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  prayerContent: { fontSize: 15, marginBottom: 4, color: nature.foreground },
  prayerMeta: { fontSize: 12, color: nature.mutedForeground, marginBottom: 8 },
  prayerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  prayedButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: nature.muted,
  },
  prayedButtonActive: { backgroundColor: nature.primary },
  prayedButtonText: { fontSize: 14, color: nature.foreground },
  prayedButtonTextActive: { color: nature.primaryForeground },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  switchLabel: { fontSize: 14, color: nature.foreground },
  verseCard: {
    backgroundColor: "transparent",
    paddingVertical: 12,
    paddingHorizontal: 0,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  verseRef: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
    color: nature.foreground,
  },
  verseSnippet: {
    fontSize: 14,
    color: nature.mutedForeground,
    fontStyle: "italic",
    marginBottom: 10,
  },
  jumpToReaderButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
    backgroundColor: nature.muted,
    marginBottom: 8,
  },
  jumpToReaderText: {
    color: nature.foreground,
    fontSize: 13,
    fontWeight: "600",
  },
  verseReaderCard: {
    marginTop: 0,
    backgroundColor: nature.background,
    paddingTop: 0,
  },
  passagePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: nature.muted,
    minWidth: 56,
  },
  memoryVersePickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  memoryVerseBookPickerButton: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  memoryVerseSmallPickerButton: {
    minWidth: 84,
  },
  memoryVerseStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  memoryVerseOptionText: {
    marginTop: 2,
    color: nature.mutedForeground,
    fontSize: 13,
    lineHeight: 18,
  },
  memoryVersePreview: {
    color: nature.mutedForeground,
    fontSize: 13,
    marginBottom: 8,
  },
  memoryVerseAutoTextCard: {
    backgroundColor: nature.muted,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  memoryVerseAutoText: {
    color: nature.foreground,
    fontSize: 14,
    lineHeight: 21,
  },
  memoryVerseAutoTextHint: {
    marginBottom: 6,
  },
  passagePickerButtonText: {
    color: nature.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  passagePickerList: {
    maxHeight: 360,
    marginTop: 12,
  },
  passagePickerTabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  passagePickerTab: {
    flex: 1,
    borderRadius: 6,
    backgroundColor: nature.muted,
    paddingVertical: 8,
    alignItems: "center",
  },
  passagePickerTabActive: {
    backgroundColor: nature.primary,
  },
  passagePickerTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: nature.foreground,
  },
  passagePickerTabTextActive: {
    color: nature.primaryForeground,
  },
  passagePickerListContent: {
    paddingBottom: 8,
  },
  passagePickerRow: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    backgroundColor: nature.muted,
    borderRadius: 6,
  },
  passagePickerRowActive: {
    backgroundColor: nature.primary + "1A",
  },
  passagePickerRowTitle: {
    color: nature.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  passagePickerRowMeta: {
    marginTop: 2,
    color: nature.mutedForeground,
    fontSize: 12,
  },
  readerLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  readerErrorCard: {
    backgroundColor: nature.destructive + "1A",
    borderRadius: 8,
    padding: 12,
    gap: 10,
  },
  readerParagraphCard: {
    backgroundColor: nature.background,
    paddingVertical: 0,
  },
  readerParagraphText: {
    color: nature.foreground,
    fontSize: 17,
    lineHeight: 33,
  },
  readerEsvHeading: {
    color: nature.foreground,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.15,
  },
  readerVerseInline: {
    color: nature.foreground,
  },
  readerVerseInlineHasHighlight: {
    color: nature.foreground,
    backgroundColor: "#e6e6e2",
  },
  readerVerseInlineMine: {
    color: nature.foreground,
    backgroundColor: "#fff3a3",
  },
  readerVerseInlineSelected: {
    color: nature.foreground,
    textDecorationLine: "underline",
    textDecorationStyle: "solid",
    textDecorationColor: nature.foreground,
  },
  readerVerseInlineNumber: {
    color: nature.mutedForeground,
    fontSize: 13,
    fontWeight: "700",
  },
  readerVerseInlineNumberHighlighted: {
    color: nature.primary,
  },
  esvAttribution: {
    color: nature.mutedForeground,
    fontSize: 12,
    marginTop: 6,
  },
  verseHighlightsCard: {
    marginTop: 10,
    paddingTop: 0,
  },
  chapterHighlightRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  chapterHighlightTitle: {
    color: nature.foreground,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  chapterHighlightMeta: {
    color: nature.mutedForeground,
    fontSize: 13,
  },
  settingsCard: {
    marginTop: 10,
    backgroundColor: "transparent",
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: nature.border,
    borderBottomWidth: 1,
    borderBottomColor: nature.border,
  },
  settingsLabel: { fontSize: 12, color: nature.mutedForeground, marginTop: 10 },
  settingsValue: { fontSize: 15, color: nature.foreground, marginTop: 2 },
  settingsLink: {
    fontSize: 15,
    color: nature.primary,
    marginTop: 2,
    textDecorationLine: "underline",
  },
  settingsActions: { marginTop: 14, alignItems: "flex-start" },
  signOut: {
    marginTop: 14,
    paddingVertical: 8,
    paddingHorizontal: 0,
    alignItems: "center",
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  bottomNav: {
    flexDirection: "row",
    backgroundColor: nature.background,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: nature.border,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    borderRadius: 0,
    gap: 2,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: nature.primary,
  },
  tabIcon: { color: nature.mutedForeground },
  tabIconActive: { color: nature.primary },
  tabLabel: { fontSize: 11, fontWeight: "600", color: nature.mutedForeground },
  tabLabelActive: { color: nature.primary },
  verseActionBar: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: nature.border,
    backgroundColor: nature.background,
  },
  verseActionClearButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: nature.muted,
    alignSelf: "center",
  },
  verseActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  verseActionPrimary: {
    backgroundColor: nature.primary,
  },
  verseActionPrimaryText: {
    color: nature.primaryForeground,
    fontSize: 14,
    fontWeight: "700",
  },
  verseActionSecondary: {
    backgroundColor: nature.muted,
  },
  verseActionSecondaryText: {
    color: nature.foreground,
    fontSize: 14,
    fontWeight: "700",
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.8 },
  signOutText: { color: nature.destructive, fontSize: 16, fontWeight: "600" },
});
