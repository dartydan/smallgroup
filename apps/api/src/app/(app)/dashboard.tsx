"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  Heart,
  Home,
  LogOut,
  Menu,
  Settings,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  api,
  type Announcement,
  type BibleChapterResponse,
  type CalendarEvent,
  type DiscussionTopic,
  type PrayerRequest,
  type PrayerVisibility,
  type RemovedSnackSlot,
  type SnackSlot,
  type UpcomingBirthday,
  type VerseHighlight,
  type VerseMemory,
} from "@/lib/api-client";
import {
  resolveDisplayName,
  sanitizeDisplayName,
} from "@/lib/display-name";
import {
  PracticeVerseGame,
  type PracticeLevelCompletion,
  type PracticeLevel,
} from "../practice/practice-verse-game";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

type Member = {
  id: string;
  displayName: string | null;
  email: string;
  role: string;
  birthdayMonth?: number | null;
  birthdayDay?: number | null;
};

type UserGender = "male" | "female";

type AppTab = "home" | "prayer" | "verse" | "settings";

const APP_TABS: Array<{ key: AppTab; label: string; icon: LucideIcon }> = [
  { key: "home", label: "Home", icon: Home },
  { key: "prayer", label: "Pray", icon: Heart },
  { key: "verse", label: "Read", icon: BookOpen },
  { key: "settings", label: "Settings", icon: Settings },
];
const MONTH_OPTIONS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
] as const;
const EMPTY_PRACTICE_LEVEL_COMPLETION: PracticeLevelCompletion = {
  1: false,
  2: false,
  3: false,
};
const PRAYER_VISIBILITY_OPTIONS: Array<{
  value: PrayerVisibility;
  label: string;
  description: string;
}> = [
  {
    value: "my_gender",
    label: "Gender Specific",
    description: "Only your gender can see it.",
  },
  {
    value: "specific_people",
    label: "Specific People",
    description: "You choose exactly who can see it.",
  },
  {
    value: "everyone",
    label: "Everyone",
    description: "Visible to everyone in your group.",
  },
];
const PRAYER_NOTE_STYLES: Array<{
  paper: string;
  tilt: string;
  tape: string;
}> = [
  { paper: "bg-secondary", tilt: "-rotate-1", tape: "bg-background/85" },
  { paper: "bg-accent", tilt: "rotate-1", tape: "bg-card/85" },
  { paper: "bg-muted", tilt: "-rotate-2", tape: "bg-secondary/70" },
  { paper: "bg-primary/10", tilt: "rotate-2", tape: "bg-muted/80" },
];
const PRAYER_NOTE_NORMAL_MAX_HEIGHT_REM = 14;
const PRAYER_NOTE_PREVIEW_CHAR_LIMIT = 220;

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

function getRoleLabel(role: string | null | undefined): "Leader" | "Member" {
  return role === "admin" ? "Leader" : "Member";
}

function friendlyLoadError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("failed query") ||
    lower.includes('relation "users"') ||
    lower.includes("does not exist")
  ) {
    return "Server couldn’t load your account. The API database may be missing tables.";
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("network request failed") ||
    lower.includes("fetch")
  ) {
    return "Can’t reach the server right now. Check your API URL and server status.";
  }
  if (lower.includes("unauthorized") || lower.includes("401")) {
    return "Session expired or invalid. Please sign in again.";
  }
  return raw;
}

function parseBookAndChapterFromReference(
  reference: string,
): { book: string; chapter: number } | null {
  const normalized = reference.trim().replace(/\s+/g, " ").toLowerCase();
  if (!normalized) return null;
  const sortedBooks = [...BIBLE_BOOKS].sort((a, b) => b.name.length - a.name.length);
  for (const option of sortedBooks) {
    const bookLower = option.name.toLowerCase();
    if (!normalized.startsWith(`${bookLower} `)) continue;
    const rest = normalized.slice(bookLower.length).trim();
    const chapterMatch = rest.match(/^(\d{1,3})/);
    if (!chapterMatch) continue;
    const chapter = Number.parseInt(chapterMatch[1], 10);
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > option.chapters) {
      continue;
    }
    return { book: option.name, chapter };
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

function formatRelativeTimingLabel(daysOffset: number): string {
  if (daysOffset === 0) return "today";
  if (daysOffset === 1) return "tomorrow";
  if (daysOffset === -1) return "yesterday";
  if (daysOffset > 1) return `in ${daysOffset} days`;
  return `${Math.abs(daysOffset)} days ago`;
}

function firstNameOnly(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  return normalized.split(/\s+/)[0] ?? "";
}

const BIRTHDAY_EMOJIS = ["🎉", "🎂", "🥳", "🎈", "🧁", "🎊"] as const;

function pickBirthdayEmoji(seed: string): string {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return BIRTHDAY_EMOJIS[hash % BIRTHDAY_EMOJIS.length];
}

function formatCalendarEventTimeRange(event: CalendarEvent): string {
  if (event.isAllDay) return "All day";
  const start = new Date(event.startAt);
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!event.endAt) return startLabel;

  const end = new Date(event.endAt);
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${startLabel} - ${endLabel}`;
}

function formatMonthTimeLabel(timeLabel: string, maxLength = 16): string {
  const normalized = timeLabel.replace(/\s+/g, " ").trim();
  if (!normalized.includes(" - ")) return normalized;
  if (normalized.length <= maxLength) return normalized;
  const [startLabel] = normalized.split(" - ");
  return startLabel.trim();
}

function formatPrayerDateLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrayerVisibilityLabel(
  prayer: Pick<PrayerRequest, "visibility" | "isPrivate">,
): string {
  const visibility =
    prayer.visibility ??
    (prayer.isPrivate ? ("specific_people" as PrayerVisibility) : "everyone");
  if (visibility === "my_gender") return "Gender Specific";
  if (visibility === "specific_people") return prayer.isPrivate ? "Private" : "Specific People";
  return "Everyone";
}

function getPrayerNoteSizing(content: string): {
  minHeightRem: number;
  needsReadMore: boolean;
} {
  const characterCount = content.trim().length;
  const estimatedLines = Math.max(4, Math.ceil(characterCount / 28));
  const dynamicHeightRem = 7.5 + estimatedLines * 1.2;
  const boundedHeightRem = Math.min(24, Math.max(10.5, dynamicHeightRem));
  const needsReadMore = boundedHeightRem > PRAYER_NOTE_NORMAL_MAX_HEIGHT_REM;
  return {
    minHeightRem: needsReadMore ? PRAYER_NOTE_NORMAL_MAX_HEIGHT_REM : boundedHeightRem,
    needsReadMore,
  };
}

function getPrayerPreviewContent(content: string): string {
  const normalized = content.trim();
  if (normalized.length <= PRAYER_NOTE_PREVIEW_CHAR_LIMIT) {
    return normalized || content;
  }
  return `${normalized.slice(0, PRAYER_NOTE_PREVIEW_CHAR_LIMIT).trimEnd()}...`;
}

type AnnouncementTimelineItem = {
  id: string;
  title: string;
  date: Date;
  timeLabel: string;
  location: string | null;
  relativeLabel: string;
  kind: "event" | "birthday" | "meeting" | "noSmallGroup";
  snackSignupNames: string[];
  snackSlotId: string | null;
};
type RecentBirthdayNotice = {
  id: string;
  text: string;
};
type MonthCalendarItem = {
  id: string;
  title: string;
  detail: string;
  tone: "birthday" | "meeting" | "event" | "cancelled";
  snackSlotId?: string | null;
  removedSlotId?: string | null;
  snackSignupNames?: string[];
};

function dayOffsetFromToday(date: Date, now: Date): number {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthStartDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthEndDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

export function Dashboard() {
  const { isLoaded, userId, getToken, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [navOpen, setNavOpen] = useState(false);

  const [me, setMe] = useState<{
    id: string;
    displayName: string | null;
    email: string;
    role?: string;
    gender?: UserGender | null;
    birthdayMonth?: number | null;
    birthdayDay?: number | null;
  } | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [snackSlots, setSnackSlots] = useState<SnackSlot[]>([]);
  const [removedSnackSlots, setRemovedSnackSlots] = useState<RemovedSnackSlot[]>([]);
  const [discussionTopic, setDiscussionTopic] = useState<DiscussionTopic | null>(null);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<UpcomingBirthday[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [prayerRequests, setPrayerRequests] = useState<PrayerRequest[]>([]);
  const [verseMemory, setVerseMemory] = useState<VerseMemory[]>([]);
  const [memoryPracticeLevel, setMemoryPracticeLevel] = useState<PracticeLevel>(1);
  const [memoryPracticeCompletion, setMemoryPracticeCompletion] =
    useState<PracticeLevelCompletion>(EMPTY_PRACTICE_LEVEL_COMPLETION);
  const [loading, setLoading] = useState(true);
  const [homeViewMode, setHomeViewMode] = useState<"default" | "calendar">("default");
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(() =>
    monthStartDate(new Date()),
  );
  const [calendarMonthLoading, setCalendarMonthLoading] = useState(false);
  const [calendarMonthEvents, setCalendarMonthEvents] = useState<CalendarEvent[]>([]);
  const [calendarMonthSnackSlots, setCalendarMonthSnackSlots] = useState<SnackSlot[]>([]);
  const [calendarMonthRemovedSlots, setCalendarMonthRemovedSlots] = useState<
    RemovedSnackSlot[]
  >([]);

  const [selectedBook, setSelectedBook] = useState("John");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [chapterData, setChapterData] = useState<BibleChapterResponse | null>(null);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [chapterHighlights, setChapterHighlights] = useState<VerseHighlight[]>([]);
  const [highlightsLoading, setHighlightsLoading] = useState(false);
  const [selectedVerseNumbers, setSelectedVerseNumbers] = useState<Set<number>>(
    () => new Set(),
  );
  const [highlightSubmitting, setHighlightSubmitting] = useState(false);
  const [sharingVerse, setSharingVerse] = useState(false);
  const [showVerseNumbers, setShowVerseNumbers] = useState(true);
  const [showEsvHeadings, setShowEsvHeadings] = useState(true);
  const [verseSettingsOpen, setVerseSettingsOpen] = useState(false);
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [bookPickerTestament, setBookPickerTestament] =
    useState<BibleTestament>("new");
  const [pickerBook, setPickerBook] = useState<string | null>(null);
  const [removeMeetingOpen, setRemoveMeetingOpen] = useState(false);
  const [meetingToRemove, setMeetingToRemove] = useState<SnackSlot | null>(null);
  const [removeMeetingReason, setRemoveMeetingReason] = useState("");
  const [meetingCancelFlipSlotId, setMeetingCancelFlipSlotId] = useState<string | null>(
    null,
  );
  const [announcementFlipId, setAnnouncementFlipId] = useState<string | null>(null);
  const [removeMemberOpen, setRemoveMemberOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [memberRemoving, setMemberRemoving] = useState(false);

  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(
    null,
  );
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicTitle, setTopicTitle] = useState("");
  const [topicDescription, setTopicDescription] = useState("");
  const [topicBibleRef, setTopicBibleRef] = useState("");
  const [topicBibleText, setTopicBibleText] = useState("");
  const [prayerContent, setPrayerContent] = useState("");
  const [prayerVisibility, setPrayerVisibility] = useState<PrayerVisibility>("everyone");
  const [prayerRecipientIds, setPrayerRecipientIds] = useState<string[]>([]);
  const [readMorePrayer, setReadMorePrayer] = useState<PrayerRequest | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileGender, setProfileGender] = useState<"" | UserGender>("");
  const [profileBirthdayMonth, setProfileBirthdayMonth] = useState("");
  const [profileBirthdayDay, setProfileBirthdayDay] = useState("");
  const [snackPendingIds, setSnackPendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [verseOpen, setVerseOpen] = useState(false);
  const [verseRef, setVerseRef] = useState("");
  const [verseSnippet, setVerseSnippet] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.push("/sign-in");
  }, [router, signOut]);

  const fetchToken = useCallback(async (): Promise<string | null> => {
    if (!isLoaded) return null;
    if (!userId) {
      await handleSignOut();
      return null;
    }
    const token = await getToken();
    return token ?? null;
  }, [getToken, handleSignOut, isLoaded, userId]);

  const loadVerseReader = useCallback(
    async (
      book: string,
      chapter: number,
      options: { token?: string | null; showLoader?: boolean } = {},
    ) => {
      const shouldShowLoader = options.showLoader ?? true;
      if (shouldShowLoader) {
        setChapterLoading(true);
        setHighlightsLoading(true);
      }
      setChapterError(null);

      try {
        const token = options.token ?? (await fetchToken());
        if (!token) return;
        const [chapterRes, highlightsRes] = await Promise.all([
          api.getEsvChapter(token, book, chapter),
          api.getVerseHighlights(token, book, chapter),
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
        if (lower.includes("(401)") || lower.includes("unauthorized")) {
          await handleSignOut();
          return;
        }
        if (lower.includes("esv api unavailable") || lower.includes("(503)")) {
          setChapterError(
            "Scripture service is not configured yet. Add ESV_API_KEY on the API server.",
          );
        } else {
          setChapterError(friendlyLoadError(message));
        }
      } finally {
        setChapterLoading(false);
        setHighlightsLoading(false);
      }
    },
    [fetchToken, handleSignOut],
  );

  const load = useCallback(async () => {
    if (!isLoaded) return;
    setError(null);
    setNotice(null);
    const token = await fetchToken();
    if (!token || !userId) {
      setLoading(false);
      return;
    }

    try {
      await api.syncUser(token);
      const [
        meRes,
        membersRes,
        announcementsRes,
        snackDataRes,
        topicRes,
        birthdaysRes,
        calendarEventsRes,
        prayersRes,
        versesRes,
      ] = await Promise.all([
        api.getMe(token),
        api.getGroupMembers(token),
        api.getAnnouncements(token),
        api.getSnackSlotsWithRemoved(token),
        api.getDiscussionTopic(token),
        api.getUpcomingBirthdays(token, 14, 3),
        api.getCalendarEvents(token),
        api.getPrayerRequests(token),
        api.getVerseMemory(token),
      ]);

      setMe(meRes as typeof me);
      setMembers(membersRes as Member[]);
      setAnnouncements(Array.isArray(announcementsRes) ? announcementsRes : []);
      setSnackSlots(Array.isArray(snackDataRes.slots) ? snackDataRes.slots : []);
      setRemovedSnackSlots(
        Array.isArray(snackDataRes.removedSlots) ? snackDataRes.removedSlots : [],
      );
      setDiscussionTopic(topicRes ?? null);
      setUpcomingBirthdays(Array.isArray(birthdaysRes) ? birthdaysRes : []);
      setCalendarEvents(Array.isArray(calendarEventsRes) ? calendarEventsRes : []);
      setPrayerRequests(Array.isArray(prayersRes) ? prayersRes : []);
      setVerseMemory(Array.isArray(versesRes) ? versesRes : []);

      await loadVerseReader(selectedBook, selectedChapter, {
        token,
        showLoader: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const lower = message.toLowerCase();
      if (lower.includes("(401)") || lower.includes("unauthorized")) {
        await handleSignOut();
        return;
      }
      console.error(e);
      setError(friendlyLoadError(message));
    } finally {
      setLoading(false);
    }
  }, [
    fetchToken,
    handleSignOut,
    isLoaded,
    loadVerseReader,
    selectedBook,
    selectedChapter,
    userId,
  ]);

  useEffect(() => {
    if (!isLoaded) return;
    void load();
  }, [isLoaded, load]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isDesktop =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 1024px)").matches;
    document.body.style.overflow = navOpen && !isDesktop ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    if (media.matches) {
      setNavOpen(false);
    }
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setNavOpen(false);
      }
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (activeTab !== "verse") return;
    if (chapterData) return;
    if (chapterLoading) return;
    void loadVerseReader(selectedBook, selectedChapter);
  }, [
    activeTab,
    chapterData,
    chapterLoading,
    loadVerseReader,
    selectedBook,
    selectedChapter,
  ]);

  useEffect(() => {
    if (activeTab === "home") return;
    setMeetingCancelFlipSlotId(null);
    setAnnouncementFlipId(null);
    setHomeViewMode("default");
  }, [activeTab]);

  useEffect(() => {
    const safeDisplayName = resolveDisplayName({
      displayName:
        sanitizeDisplayName(me?.displayName) ??
        sanitizeDisplayName(user?.fullName) ??
        sanitizeDisplayName(user?.firstName),
      email: me?.email,
      fallback: "",
    });
    setProfileDisplayName(safeDisplayName);

    if (me?.birthdayMonth && me?.birthdayDay) {
      setProfileBirthdayMonth(String(me.birthdayMonth));
      setProfileBirthdayDay(String(me.birthdayDay));
    } else {
      setProfileBirthdayMonth("");
      setProfileBirthdayDay("");
    }
    setProfileGender(me?.gender === "male" || me?.gender === "female" ? me.gender : "");
  }, [
    me?.gender,
    me?.birthdayDay,
    me?.birthdayMonth,
    me?.displayName,
    user?.firstName,
    user?.fullName,
  ]);

  useEffect(() => {
    if (!profileBirthdayMonth || !profileBirthdayDay) return;
    const month = Number.parseInt(profileBirthdayMonth, 10);
    const day = Number.parseInt(profileBirthdayDay, 10);
    if (!Number.isFinite(month) || !Number.isFinite(day)) return;
    const maxDays = new Date(Date.UTC(2000, month, 0)).getUTCDate();
    if (day > maxDays) {
      setProfileBirthdayDay("");
    }
  }, [profileBirthdayDay, profileBirthdayMonth]);

  const isAdmin = me?.role === "admin";
  const activeMemoryVerse = verseMemory[0] ?? null;
  const prayerRecipientMembers = useMemo(
    () => members.filter((member) => member.id !== me?.id),
    [me?.id, members],
  );

  useEffect(() => {
    setMemoryPracticeLevel(1);
    setMemoryPracticeCompletion(EMPTY_PRACTICE_LEVEL_COMPLETION);
  }, [activeMemoryVerse?.id]);

  useEffect(() => {
    setPrayerRecipientIds((current) =>
      current.filter((id) =>
        prayerRecipientMembers.some((member) => member.id === id),
      ),
    );
  }, [prayerRecipientMembers]);

  const canAccessMemoryPracticeLevel = useCallback(
    (targetLevel: PracticeLevel): boolean => {
      if (targetLevel === 1) return true;
      if (targetLevel === 2) return memoryPracticeCompletion[1];
      return memoryPracticeCompletion[2];
    },
    [memoryPracticeCompletion],
  );

  const handleMemoryPracticeLevelChange = useCallback(
    (targetLevel: PracticeLevel) => {
      if (targetLevel > memoryPracticeLevel && !canAccessMemoryPracticeLevel(targetLevel)) {
        return;
      }
      setMemoryPracticeLevel(targetLevel);
    },
    [canAccessMemoryPracticeLevel, memoryPracticeLevel],
  );

  const snackSlotById = useMemo(
    () => new Map(snackSlots.map((slot) => [slot.id, slot])),
    [snackSlots],
  );
  const calendarMonthSnackSlotById = useMemo(
    () => new Map(calendarMonthSnackSlots.map((slot) => [slot.id, slot])),
    [calendarMonthSnackSlots],
  );
  const calendarMonthRemovedSlotById = useMemo(
    () => new Map(calendarMonthRemovedSlots.map((slot) => [slot.id, slot])),
    [calendarMonthRemovedSlots],
  );

  const { announcementTimeline, recentBirthdayNotices } = useMemo<{
    announcementTimeline: AnnouncementTimelineItem[];
    recentBirthdayNotices: RecentBirthdayNotice[];
  }>(() => {
    const now = new Date();

    const birthdayItems = upcomingBirthdays
      .filter(
        (birthday) =>
          Number.isFinite(birthday.birthdayMonth ?? null) &&
          Number.isFinite(birthday.birthdayDay ?? null),
      )
      .map((birthday) => {
        const fullName = resolveDisplayName({
          displayName: birthday.displayName,
          fallback: "Group member",
        });
        const name = firstNameOnly(fullName) || "Member";
        const date = new Date(now);
        date.setHours(12, 0, 0, 0);
        date.setDate(date.getDate() + birthday.daysUntil);
        return {
          id: `birthday-${birthday.id}`,
          name,
          date,
          daysOffset: birthday.daysUntil,
        };
      });

    const birthdayTimelineItems: AnnouncementTimelineItem[] = birthdayItems
      .filter((item) => item.daysOffset >= 0 && item.daysOffset <= 14)
      .map((item) => ({
        id: item.id,
        title: `${item.name}'s Birthday`,
        date: item.date,
        timeLabel: "All day",
        location: null,
        relativeLabel: formatRelativeTimingLabel(item.daysOffset),
        kind: "birthday" as const,
        snackSignupNames: [],
        snackSlotId: null,
      }));

    const recentBirthdayNotices: RecentBirthdayNotice[] = birthdayItems
      .filter((item) => item.daysOffset < 0 && item.daysOffset >= -3)
      .sort((a, b) => b.daysOffset - a.daysOffset)
      .map((item) => {
        const daysAgo = Math.abs(item.daysOffset);
        const shortDate = item.date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        return {
          id: `${item.id}-recent`,
          text: `${item.name}'s birthday was ${daysAgo} ${
            daysAgo === 1 ? "day" : "days"
          } ago (${shortDate})`,
        };
      });

    const calendarItems: AnnouncementTimelineItem[] = calendarEvents
      .filter((event) => event.daysOffset >= 0 && event.daysOffset <= 14)
      .map((event) => ({
        id: event.id,
        title: event.title,
        date: new Date(event.startAt),
        timeLabel: formatCalendarEventTimeRange(event),
        location: event.location,
        relativeLabel: formatRelativeTimingLabel(event.daysOffset),
        kind: "event" as const,
        snackSignupNames: [],
        snackSlotId: null,
      }));

    const meetingItems: AnnouncementTimelineItem[] = snackSlots
      .map((slot) => {
        const date = new Date(`${slot.slotDate}T12:00:00`);
        const daysOffset = dayOffsetFromToday(date, now);
        const snackSignupNames = slot.signups
          .map((signup) =>
            firstNameOnly(
              resolveDisplayName({
                displayName: signup.displayName,
                email: signup.email,
                fallback: "Member",
              }),
            ),
          )
          .filter((name): name is string => Boolean(name));
        return {
          id: `small-group-${slot.slotDate}`,
          title: "Small Group",
          date,
          timeLabel: "7:00 PM - 8:30 PM",
          location: null,
          relativeLabel: formatRelativeTimingLabel(daysOffset),
          kind: "meeting" as const,
          snackSignupNames: [...new Set(snackSignupNames)],
          snackSlotId: slot.id,
          daysOffset,
        };
      })
      .filter((item) => item.daysOffset >= 0 && item.daysOffset <= 14)
      .map(({ daysOffset: _daysOffset, ...item }) => item);

    const dayKeysWithOtherEvents = new Set<string>([
      ...birthdayTimelineItems.map((item) => localDateKey(item.date)),
      ...calendarItems.map((item) => localDateKey(item.date)),
    ]);

    const noSmallGroupItems: AnnouncementTimelineItem[] = removedSnackSlots
      .map((slot) => {
        const date = new Date(`${slot.slotDate}T12:00:00`);
        const daysOffset = dayOffsetFromToday(date, now);
        return {
          id: `no-small-group-${slot.id}`,
          title: "No Small Group",
          date,
          timeLabel: slot.cancellationReason?.trim() || "No small group this week",
          location: null,
          relativeLabel: formatRelativeTimingLabel(daysOffset),
          kind: "noSmallGroup" as const,
          snackSignupNames: [],
          snackSlotId: slot.id,
          daysOffset,
          slotDateKey: localDateKey(date),
        };
      })
      .filter((item) => item.daysOffset >= 0 && item.daysOffset <= 14)
      .filter((item) => !dayKeysWithOtherEvents.has(item.slotDateKey))
      .map(({ daysOffset: _daysOffset, slotDateKey: _slotDateKey, ...item }) => item);

    return {
      announcementTimeline: [
        ...birthdayTimelineItems,
        ...meetingItems,
        ...calendarItems,
        ...noSmallGroupItems,
      ]
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 8),
      recentBirthdayNotices,
    };
  }, [calendarEvents, removedSnackSlots, snackSlots, upcomingBirthdays]);

  const { monthViewDays, monthViewItemsByDate, monthViewTodayKey } = useMemo(() => {
    const monthStart = monthStartDate(calendarMonthDate);
    const monthEnd = monthEndDate(calendarMonthDate);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const totalCells = Math.ceil((monthStart.getDay() + monthEnd.getDate()) / 7) * 7;
    const monthViewDays = Array.from({ length: totalCells }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      return date;
    });

    const monthViewItemsByDate = new Map<string, MonthCalendarItem[]>();
    const addItem = (date: Date, item: MonthCalendarItem) => {
      const key = localDateKey(date);
      const existing = monthViewItemsByDate.get(key);
      if (existing) {
        existing.push(item);
      } else {
        monthViewItemsByDate.set(key, [item]);
      }
    };

    members.forEach((member) => {
      const day = member.birthdayDay ?? null;
      const month = member.birthdayMonth ?? null;
      if (!day || !month) return;
      if (month !== monthStart.getMonth() + 1) return;
      if (day < 1 || day > monthEnd.getDate()) return;
      const date = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth(),
        day,
        12,
        0,
        0,
        0,
      );
      const fullName = resolveDisplayName({
        displayName: member.displayName,
        email: member.email,
        fallback: "Member",
      });
      const name = firstNameOnly(fullName) || "Member";
      addItem(date, {
        id: `calendar-birthday-${member.id}-${monthStart.getMonth() + 1}-${day}`,
        title: `${name}'s birthday`,
        detail: "All day",
        tone: "birthday",
      });
    });

    calendarMonthSnackSlots.forEach((slot) => {
      const date = new Date(`${slot.slotDate}T12:00:00`);
      const signupNames = slot.signups
        .map((signup) =>
          firstNameOnly(
            resolveDisplayName({
              displayName: signup.displayName,
              email: signup.email,
              fallback: "Member",
            }),
          ),
        )
        .filter((name): name is string => Boolean(name));
      addItem(date, {
        id: `calendar-meeting-${slot.id}`,
        title: "Small Group",
        detail: formatMonthTimeLabel("7:00 PM - 8:30 PM"),
        tone: "meeting",
        snackSlotId: slot.id,
        snackSignupNames: [...new Set(signupNames)],
      });
    });

    calendarMonthRemovedSlots.forEach((slot) => {
      const date = new Date(`${slot.slotDate}T12:00:00`);
      addItem(date, {
        id: `calendar-cancelled-${slot.id}`,
        title: "No Small Group",
        detail: slot.cancellationReason?.trim() || "No small group this week",
        tone: "cancelled",
        removedSlotId: slot.id,
      });
    });

    calendarMonthEvents.forEach((event) => {
      const date = new Date(event.startAt);
      addItem(date, {
        id: `calendar-event-${event.id}`,
        title: event.title,
        detail: formatMonthTimeLabel(formatCalendarEventTimeRange(event)),
        tone: "event",
      });
    });

    return {
      monthViewDays,
      monthViewItemsByDate,
      monthViewTodayKey: localDateKey(new Date()),
    };
  }, [
    calendarMonthDate,
    calendarMonthEvents,
    calendarMonthRemovedSlots,
    calendarMonthSnackSlots,
    members,
  ]);

  const chapterVerseHighlightCount = useMemo(() => {
    return chapterHighlights.reduce<Record<number, number>>((acc, item) => {
      acc[item.verseNumber] = (acc[item.verseNumber] ?? 0) + 1;
      return acc;
    }, {});
  }, [chapterHighlights]);

  const myVerseHighlightByNumber = useMemo(() => {
    return chapterHighlights.reduce<Record<number, VerseHighlight>>((acc, item) => {
      if (item.isMine && !acc[item.verseNumber]) {
        acc[item.verseNumber] = item;
      }
      return acc;
    }, {});
  }, [chapterHighlights]);

  const selectedVerses = useMemo(() => {
    return (chapterData?.verses ?? []).filter((item) =>
      selectedVerseNumbers.has(item.verseNumber),
    );
  }, [chapterData?.verses, selectedVerseNumbers]);

  const selectedVersesMine = useMemo(() => {
    return selectedVerses
      .map((item) => myVerseHighlightByNumber[item.verseNumber])
      .filter((item): item is VerseHighlight => !!item);
  }, [myVerseHighlightByNumber, selectedVerses]);

  const allSelectedHighlightedByMe = useMemo(() => {
    return (
      selectedVerses.length > 0 &&
      selectedVerses.every((item) => !!myVerseHighlightByNumber[item.verseNumber])
    );
  }, [myVerseHighlightByNumber, selectedVerses]);

  const bookPickerOptions = useMemo(
    () =>
      bookPickerTestament === "old"
        ? BIBLE_BOOKS.slice(0, OLD_TESTAMENT_BOOK_COUNT)
        : BIBLE_BOOKS.slice(OLD_TESTAMENT_BOOK_COUNT),
    [bookPickerTestament],
  );
  const chapterPickerBook = pickerBook ?? selectedBook;
  const selectedReaderBookOption =
    BIBLE_BOOKS.find((option) => option.name === selectedBook) ?? BIBLE_BOOKS[0];
  const chapterPickerBookOption =
    BIBLE_BOOKS.find((option) => option.name === chapterPickerBook) ?? BIBLE_BOOKS[0];
  const chapterPickerOptions = useMemo(
    () =>
      Array.from(
        { length: chapterPickerBookOption.chapters },
        (_, index) => index + 1,
      ),
    [chapterPickerBookOption.chapters],
  );

  const refreshSnackSlotsData = useCallback(
    async (token: string | null) => {
      if (!token) return;
      const snackData = await api.getSnackSlotsWithRemoved(token);
      setSnackSlots(Array.isArray(snackData.slots) ? snackData.slots : []);
      setRemovedSnackSlots(
        Array.isArray(snackData.removedSlots) ? snackData.removedSlots : [],
      );
    },
    [],
  );

  const loadCalendarMonthView = useCallback(
    async (monthDate: Date) => {
      const token = await fetchToken();
      if (!token) return;

      const startDate = localDateKey(monthStartDate(monthDate));
      const endDate = localDateKey(monthEndDate(monthDate));

      setCalendarMonthLoading(true);
      try {
        const [eventsRes, snackDataRes] = await Promise.all([
          api.getCalendarEvents(token, { startDate, endDate }),
          api.getSnackSlotsWithRemoved(token, {
            startDate,
            endDate,
            limit: 64,
            removedLimit: 64,
          }),
        ]);
        setCalendarMonthEvents(Array.isArray(eventsRes) ? eventsRes : []);
        setCalendarMonthSnackSlots(
          Array.isArray(snackDataRes.slots) ? snackDataRes.slots : [],
        );
        setCalendarMonthRemovedSlots(
          Array.isArray(snackDataRes.removedSlots) ? snackDataRes.removedSlots : [],
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const lower = message.toLowerCase();
        if (lower.includes("(401)") || lower.includes("unauthorized")) {
          await handleSignOut();
          return;
        }
        setError(friendlyLoadError(message));
      } finally {
        setCalendarMonthLoading(false);
      }
    },
    [fetchToken, handleSignOut],
  );

  const openCalendarMonthView = useCallback(() => {
    const currentMonth = monthStartDate(new Date());
    setHomeViewMode("calendar");
    setCalendarMonthDate(currentMonth);
    void loadCalendarMonthView(currentMonth);
  }, [loadCalendarMonthView]);

  const stepCalendarMonth = (delta: number) => {
    const nextMonth = new Date(
      calendarMonthDate.getFullYear(),
      calendarMonthDate.getMonth() + delta,
      1,
    );
    setCalendarMonthDate(nextMonth);
    void loadCalendarMonthView(nextMonth);
  };

  const openAnnouncementComposer = () => {
    setEditingAnnouncementId(null);
    setNewTitle("");
    setNewBody("");
    setAnnouncementFlipId(null);
    setAnnouncementOpen(true);
  };

  const openAnnouncementEditor = (item: Announcement) => {
    if (!isAdmin) return;
    setEditingAnnouncementId(item.id);
    setNewTitle(item.title);
    setNewBody(item.body);
    setAnnouncementFlipId(null);
    setAnnouncementOpen(true);
  };

  const closeAnnouncementComposer = () => {
    setAnnouncementOpen(false);
    setAnnouncementFlipId(null);
    setEditingAnnouncementId(null);
    setNewTitle("");
    setNewBody("");
  };

  const handleSaveAnnouncement = async () => {
    if (!newTitle.trim() || !newBody.trim()) return;
    const token = await fetchToken();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      if (editingAnnouncementId) {
        await api.updateAnnouncement(token, editingAnnouncementId, {
          title: newTitle.trim(),
          body: newBody.trim(),
        });
      } else {
        await api.createAnnouncement(token, {
          title: newTitle.trim(),
          body: newBody.trim(),
        });
      }
      setEditingAnnouncementId(null);
      setNewTitle("");
      setNewBody("");
      setAnnouncementFlipId(null);
      setAnnouncementOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async (item: Announcement) => {
    const token = await fetchToken();
    if (!token) return;
    try {
      await api.deleteAnnouncement(token, item.id);
      if (editingAnnouncementId === item.id) {
        setEditingAnnouncementId(null);
      }
      setAnnouncementFlipId(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSaveTopic = async () => {
    if (!topicTitle.trim()) return;
    const token = await fetchToken();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.setDiscussionTopic(token, {
        title: topicTitle.trim(),
        description: topicDescription.trim() || undefined,
        bibleReference: topicBibleRef.trim() || undefined,
        bibleText: topicBibleText.trim() || undefined,
      });
      setTopicOpen(false);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const togglePrayerRecipient = useCallback((memberId: string) => {
    setPrayerRecipientIds((current) => {
      if (current.includes(memberId)) {
        return current.filter((id) => id !== memberId);
      }
      return [...current, memberId];
    });
  }, []);

  const handleAddPrayer = async () => {
    if (!prayerContent.trim()) return;
    if (prayerVisibility === "my_gender" && me?.gender !== "male" && me?.gender !== "female") {
      setError("Set your gender in Settings before choosing 'Gender Specific'.");
      return;
    }
    if (prayerVisibility === "specific_people" && prayerRecipientIds.length === 0) {
      setError("Pick at least one person for 'Specific People'.");
      return;
    }
    const token = await fetchToken();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.createPrayerRequest(token, {
        content: prayerContent.trim(),
        visibility: prayerVisibility,
        recipientIds:
          prayerVisibility === "specific_people" ? prayerRecipientIds : undefined,
      });
      setPrayerContent("");
      setPrayerVisibility("everyone");
      setPrayerRecipientIds([]);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrayer = async (prayer: PrayerRequest) => {
    if (!confirm("Remove this prayer request?")) return;
    const token = await fetchToken();
    if (!token) return;
    try {
      await api.deletePrayerRequest(token, prayer.id);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleSaveProfile = async () => {
    const token = await fetchToken();
    if (!token) return;

    const birthdayMonthText = profileBirthdayMonth.trim();
    const birthdayDayText = profileBirthdayDay.trim();
    const typedName = profileDisplayName.trim();
    const safeTypedName = sanitizeDisplayName(typedName);
    if (typedName.length > 0 && !safeTypedName) {
      setError("Please enter your real name, not an ID.");
      return;
    }

    let birthdayMonth: number | null = null;
    let birthdayDay: number | null = null;
    const hasBirthdayMonth = birthdayMonthText.length > 0;
    const hasBirthdayDay = birthdayDayText.length > 0;
    if (hasBirthdayMonth !== hasBirthdayDay) {
      setError("Pick both month and day for birthday.");
      return;
    }
    if (hasBirthdayMonth && hasBirthdayDay) {
      const m = Number.parseInt(birthdayMonthText, 10);
      const d = Number.parseInt(birthdayDayText, 10);
      const testDate = new Date(Date.UTC(2000, m - 1, d));
      if (testDate.getUTCMonth() !== m - 1 || testDate.getUTCDate() !== d) {
        setError("Pick a valid birthday date.");
        return;
      }

      birthdayMonth = m;
      birthdayDay = d;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.updateMe(token, {
        displayName: safeTypedName,
        gender: profileGender || null,
        birthdayMonth,
        birthdayDay,
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveVerse = async () => {
    if (!verseRef.trim()) return;
    const token = await fetchToken();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.setVerseOfMonth(token, {
        verseReference: verseRef.trim(),
        verseSnippet: verseSnippet.trim() || undefined,
      });
      setVerseOpen(false);
      setVerseRef("");
      setVerseSnippet("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVerseMemorized = async (verse: VerseMemory) => {
    const token = await fetchToken();
    if (!token) return;
    try {
      await api.setVerseMemorized(token, verse.id, !verse.memorized);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggleSnackSignup = async (slot: SnackSlot) => {
    if (!me?.id) return;
    if (snackPendingIds.has(slot.id)) return;

    const token = await fetchToken();
    if (!token) return;

    const isSignedUp = slot.signups.some((signup) => signup.id === me.id);
    const optimisticSignup = {
      id: me.id,
      displayName: resolveDisplayName({
        displayName: me.displayName,
        email: me.email,
        fallback: "Member",
      }),
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
            signups: existingSlot.signups.filter((signup) => signup.id !== me.id),
          };
        }
        const alreadyInList = existingSlot.signups.some((signup) => signup.id === me.id);
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
        await api.snackSignOff(token, slot.id);
      } else {
        await api.snackSignUp(token, slot.id);
      }

      void refreshSnackSlotsData(token).catch(() => {});
      if (homeViewMode === "calendar") {
        void loadCalendarMonthView(calendarMonthDate).catch(() => {});
      }
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
      setError((e as Error).message);
    } finally {
      setSnackPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(slot.id);
        return next;
      });
    }
  };

  const handleRemoveMeeting = async (slot: SnackSlot, reason: string) => {
    if (!isAdmin) return;
    if (snackPendingIds.has(slot.id)) return;
    const token = await fetchToken();
    if (!token) return;

    const previousSlots = snackSlots.map((existingSlot) => ({
      ...existingSlot,
      signups: existingSlot.signups.map((signup) => ({ ...signup })),
    }));
    const previousRemovedSlots = removedSnackSlots.map((removedSlot) => ({
      ...removedSlot,
    }));
    const previousCalendarMonthSlots = calendarMonthSnackSlots.map((existingSlot) => ({
      ...existingSlot,
      signups: existingSlot.signups.map((signup) => ({ ...signup })),
    }));
    const previousCalendarMonthRemovedSlots = calendarMonthRemovedSlots.map(
      (removedSlot) => ({ ...removedSlot }),
    );

    setSnackPendingIds((prev) => {
      const next = new Set(prev);
      next.add(slot.id);
      return next;
    });

    setSnackSlots((prevSlots) => prevSlots.filter((existingSlot) => existingSlot.id !== slot.id));
    setRemovedSnackSlots((prev) => {
      if (prev.some((item) => item.id === slot.id)) return prev;
      return [
        ...prev,
        { id: slot.id, slotDate: slot.slotDate, cancellationReason: reason },
      ].sort((a, b) =>
        a.slotDate.localeCompare(b.slotDate),
      );
    });
    setCalendarMonthSnackSlots((prevSlots) =>
      prevSlots.filter((existingSlot) => existingSlot.id !== slot.id),
    );
    setCalendarMonthRemovedSlots((prev) => {
      if (prev.some((item) => item.id === slot.id)) {
        return prev.map((item) =>
          item.id === slot.id ? { ...item, cancellationReason: reason } : item,
        );
      }
      return [
        ...prev,
        { id: slot.id, slotDate: slot.slotDate, cancellationReason: reason },
      ].sort((a, b) => a.slotDate.localeCompare(b.slotDate));
    });

    try {
      await api.removeSnackSlot(token, slot.id, reason);
      void refreshSnackSlotsData(token).catch(() => {});
      if (homeViewMode === "calendar") {
        void loadCalendarMonthView(calendarMonthDate).catch(() => {});
      }
    } catch (e) {
      setSnackSlots(previousSlots);
      setRemovedSnackSlots(previousRemovedSlots);
      setCalendarMonthSnackSlots(previousCalendarMonthSlots);
      setCalendarMonthRemovedSlots(previousCalendarMonthRemovedSlots);
      setError((e as Error).message);
    } finally {
      setSnackPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(slot.id);
        return next;
      });
    }
  };

  const openRemoveMeetingDialog = (slot: SnackSlot) => {
    if (!isAdmin) return;
    if (snackPendingIds.has(slot.id)) return;
    setMeetingCancelFlipSlotId(null);
    setMeetingToRemove(slot);
    setRemoveMeetingReason("");
    setRemoveMeetingOpen(true);
  };

  const closeRemoveMeetingDialog = () => {
    setRemoveMeetingOpen(false);
    setMeetingToRemove(null);
    setRemoveMeetingReason("");
  };

  const handleSubmitRemoveMeeting = async () => {
    if (!meetingToRemove) return;
    const reason = removeMeetingReason.trim();
    if (!reason) {
      setError("Please enter a cancellation reason.");
      return;
    }
    closeRemoveMeetingDialog();
    await handleRemoveMeeting(meetingToRemove, reason);
  };

  const openRemoveMemberDialog = (member: Member) => {
    if (!isAdmin) return;
    if (member.id === me?.id) return;
    setMemberToRemove(member);
    setRemoveMemberOpen(true);
  };

  const closeRemoveMemberDialog = () => {
    setRemoveMemberOpen(false);
    setMemberToRemove(null);
  };

  const handleConfirmRemoveMember = async () => {
    if (!isAdmin || !memberToRemove) return;
    const token = await fetchToken();
    if (!token) return;

    setMemberRemoving(true);
    setError(null);
    try {
      await api.removeGroupMember(token, memberToRemove.id);
      closeRemoveMemberDialog();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMemberRemoving(false);
    }
  };

  const handleRestoreMeeting = async (slot: RemovedSnackSlot) => {
    if (!isAdmin) return;
    if (snackPendingIds.has(slot.id)) return;

    const token = await fetchToken();
    if (!token) return;

    const previousSlots = snackSlots.map((existingSlot) => ({
      ...existingSlot,
      signups: existingSlot.signups.map((signup) => ({ ...signup })),
    }));
    const previousRemovedSlots = removedSnackSlots.map((removedSlot) => ({
      ...removedSlot,
    }));
    const previousCalendarMonthSlots = calendarMonthSnackSlots.map((existingSlot) => ({
      ...existingSlot,
      signups: existingSlot.signups.map((signup) => ({ ...signup })),
    }));
    const previousCalendarMonthRemovedSlots = calendarMonthRemovedSlots.map(
      (removedSlot) => ({ ...removedSlot }),
    );

    setSnackPendingIds((prev) => {
      const next = new Set(prev);
      next.add(slot.id);
      return next;
    });

    setRemovedSnackSlots((prev) => prev.filter((item) => item.id !== slot.id));
    setSnackSlots((prev) =>
      [...prev, { id: slot.id, slotDate: slot.slotDate, signups: [] }].sort((a, b) =>
        a.slotDate.localeCompare(b.slotDate),
      ),
    );
    setCalendarMonthRemovedSlots((prev) => prev.filter((item) => item.id !== slot.id));
    setCalendarMonthSnackSlots((prev) =>
      [...prev, { id: slot.id, slotDate: slot.slotDate, signups: [] }].sort((a, b) =>
        a.slotDate.localeCompare(b.slotDate),
      ),
    );

    try {
      await api.restoreSnackSlot(token, slot.id);
      void refreshSnackSlotsData(token).catch(() => {});
      if (homeViewMode === "calendar") {
        void loadCalendarMonthView(calendarMonthDate).catch(() => {});
      }
    } catch (e) {
      setSnackSlots(previousSlots);
      setRemovedSnackSlots(previousRemovedSlots);
      setCalendarMonthSnackSlots(previousCalendarMonthSlots);
      setCalendarMonthRemovedSlots(previousCalendarMonthRemovedSlots);
      setError((e as Error).message);
    } finally {
      setSnackPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(slot.id);
        return next;
      });
    }
  };

  const handleJumpToVerseReference = (reference: string) => {
    const parsed = parseBookAndChapterFromReference(reference);
    if (!parsed) {
      setError("That verse reference format is not supported yet.");
      return;
    }

    setActiveTab("verse");
    setNavOpen(false);
    setSelectedBook(parsed.book);
    setSelectedChapter(parsed.chapter);
    setSelectedVerseNumbers(new Set());
    void loadVerseReader(parsed.book, parsed.chapter);
  };

  const handleSelectBookAndChapter = (book: string, chapter: number) => {
    const bookOption = BIBLE_BOOKS.find((option) => option.name === book);
    if (!bookOption) return;

    const nextChapter = Math.min(Math.max(chapter, 1), bookOption.chapters);
    setSelectedBook(book);
    setSelectedChapter(nextChapter);
    setSelectedVerseNumbers(new Set());
    void loadVerseReader(book, nextChapter);
  };

  const openBookPicker = () => {
    setPickerBook(null);
    setBookPickerTestament(getTestamentForBook(selectedBook));
    setBookPickerOpen(true);
  };

  const openChapterPicker = () => {
    setPickerBook(selectedBook);
    setChapterPickerOpen(true);
  };

  const handleStepChapter = (direction: -1 | 1) => {
    const nextChapter = selectedChapter + direction;
    if (nextChapter < 1 || nextChapter > selectedReaderBookOption.chapters) {
      return;
    }
    handleSelectBookAndChapter(selectedBook, nextChapter);
  };

  const handleToggleSelectedHighlight = async () => {
    if (selectedVerses.length === 0) return;
    const token = await fetchToken();
    if (!token) return;

    setHighlightSubmitting(true);
    setError(null);
    try {
      if (allSelectedHighlightedByMe) {
        await Promise.all(
          selectedVersesMine.map((item) => api.deleteVerseHighlight(token, item.id)),
        );
      } else {
        const toCreate = selectedVerses.filter(
          (item) => !myVerseHighlightByNumber[item.verseNumber],
        );
        await Promise.all(
          toCreate.map((item) =>
            api.createVerseHighlight(token, {
              book: selectedBook,
              chapter: selectedChapter,
              verseNumber: item.verseNumber,
              verseReference: item.reference,
            }),
          ),
        );
      }

      const refreshedHighlights = await api.getVerseHighlights(
        token,
        selectedBook,
        selectedChapter,
      );
      setChapterHighlights(
        Array.isArray(refreshedHighlights) ? refreshedHighlights : [],
      );
      if (!allSelectedHighlightedByMe) {
        setSelectedVerseNumbers(new Set());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHighlightSubmitting(false);
    }
  };

  const handleShareSelectedVerse = async () => {
    if (selectedVerses.length === 0) return;

    setSharingVerse(true);
    setError(null);
    setNotice(null);
    try {
      const orderedVerses = [...selectedVerses].sort(
        (a, b) => a.verseNumber - b.verseNumber,
      );
      const combinedReference = formatVerseRangeLabel(
        selectedBook,
        selectedChapter,
        orderedVerses.map((item) => item.verseNumber),
      );
      const combinedText = orderedVerses.map((item) => item.text).join(" ");
      const attribution = chapterData?.attribution ?? "(ESV)";
      const shareMessage = `${combinedReference} ${attribution}\n\n${combinedText}`;

      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share({ text: shareMessage });
      } else if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.writeText
      ) {
        await navigator.clipboard.writeText(shareMessage);
        setNotice("Verse copied to clipboard.");
      } else {
        setNotice(shareMessage);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSharingVerse(false);
    }
  };

  const topBarMemoryVerse = verseMemory[0]?.verseReference?.trim() ?? "";
  const birthdayMonthNumber = profileBirthdayMonth
    ? Number.parseInt(profileBirthdayMonth, 10)
    : null;
  const birthdayDayOptions = Array.from(
    {
      length: birthdayMonthNumber
        ? new Date(Date.UTC(2000, birthdayMonthNumber, 0)).getUTCDate()
        : 31,
    },
    (_, index) => index + 1,
  );
  const selectedMonthLabel =
    MONTH_OPTIONS.find((month) => String(month.value) === profileBirthdayMonth)?.label ??
    "Month";
  const selectedDayLabel = profileBirthdayDay || "Day";
  const selectedGenderLabel =
    profileGender === "male"
      ? "Male"
      : profileGender === "female"
        ? "Female"
        : "Select gender";

  const activeTabMeta = APP_TABS.find((item) => item.key === activeTab) ?? APP_TABS[0];

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/35 transition-opacity lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setNavOpen(false)}
        aria-hidden
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-background shadow-xl transition-transform lg:translate-x-0 lg:bg-primary/10 lg:shadow-none",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Image src="/sglogo.png" alt="" width={28} height={28} className="rounded" />
            <p className="text-lg font-semibold">Small Group</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 p-3">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Navigate
          </p>
          <div className="space-y-1">
            {APP_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground hover:bg-accent",
                  )}
                  onClick={() => {
                    setActiveTab(tab.key);
                    if (tab.key === "home") {
                      setHomeViewMode("default");
                    }
                    setNavOpen(false);
                  }}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
        <div className="p-3 pt-0">
          <Button
            variant="ghost"
            className="h-auto w-full justify-start rounded-md px-3 py-2 text-left text-sm font-medium text-foreground transition hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setNavOpen(false);
              void handleSignOut();
            }}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-72">
      <header className="sticky top-0 z-30 hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:block">
        <div className="relative mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="relative z-10 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open navigation"
              onClick={() => setNavOpen(true)}
            >
              <Menu className="size-5" />
            </Button>
            <Image
              src="/sglogo.png"
              alt=""
              width={28}
              height={28}
              className="rounded lg:hidden"
            />
            <h1 className="text-lg font-semibold lg:hidden">Small Group</h1>
          </div>

          {topBarMemoryVerse && (
            <div className="pointer-events-none absolute inset-x-0 px-20 text-center">
              <p className="truncate text-sm font-medium text-muted-foreground">
                {topBarMemoryVerse}
              </p>
            </div>
          )}

          <div className="relative z-10 w-10 lg:w-0" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        <div className="lg:hidden">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            aria-label="Open navigation"
            onClick={() => setNavOpen(true)}
          >
            <Menu className="size-4" />
            Menu
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3">
          {activeTab === "verse" ? (
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-w-0 shrink-0 px-0 py-0 text-3xl font-semibold hover:bg-transparent"
                onClick={openBookPicker}
                aria-label="Choose Bible book"
              >
                <span className="truncate">{selectedBook}</span>
              </Button>
              <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full w-full justify-end rounded-md border border-border/70 bg-muted/40 px-3 py-0 text-3xl font-semibold hover:bg-muted/70"
                  onClick={() => handleStepChapter(-1)}
                  disabled={selectedChapter <= 1}
                  aria-label="Previous chapter"
                >
                  <span>-</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full px-3 py-0 text-3xl font-semibold hover:bg-transparent"
                  onClick={openChapterPicker}
                  aria-label={`Choose chapter in ${selectedBook}`}
                >
                  <span>{selectedChapter}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-full w-full justify-start rounded-md border border-border/70 bg-muted/40 px-3 py-0 text-3xl font-semibold hover:bg-muted/70"
                  onClick={() => handleStepChapter(1)}
                  disabled={selectedChapter >= selectedReaderBookOption.chapters}
                  aria-label="Next chapter"
                >
                  <span>+</span>
                </Button>
              </div>
            </div>
          ) : (
            <h2 className="text-2xl font-semibold">{activeTabMeta.label}</h2>
          )}
          {activeTab === "verse" && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0"
              onClick={() => setVerseSettingsOpen(true)}
              aria-label="Open reader settings"
            >
              <Settings className="size-5" />
            </Button>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {notice && (
          <div className="rounded-lg bg-primary/10 px-4 py-3 text-sm text-foreground">
            {notice}
          </div>
        )}

        {activeTab === "home" && (
          <>
            {homeViewMode === "calendar" ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-base">
                    {calendarMonthDate.toLocaleDateString(undefined, {
                      month: "long",
                      year: "numeric",
                    })}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => stepCalendarMonth(-1)}>
                      Previous
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => stepCalendarMonth(1)}>
                      Next
                    </Button>
                    <Button size="sm" onClick={() => setHomeViewMode("default")}>
                      Back
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((weekday) => (
                      <div key={weekday}>{weekday}</div>
                    ))}
                  </div>

                  {calendarMonthLoading ? (
                    <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      <span
                        className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                        aria-hidden
                      />
                      Loading month...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
                      {monthViewDays.map((day) => {
                        const dayKey = localDateKey(day);
                        const items = monthViewItemsByDate.get(dayKey) ?? [];
                        const inActiveMonth = day.getMonth() === calendarMonthDate.getMonth();
                        const isToday = dayKey === monthViewTodayKey;
                        return (
                          <div
                            key={dayKey}
                            className={cn(
                              "min-h-[120px] rounded-lg border border-border/50 bg-card p-2",
                              !inActiveMonth && "opacity-45",
                            )}
                          >
                            <p
                              className={cn(
                                "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                                isToday && "bg-primary/15 text-primary",
                              )}
                            >
                              {day.getDate()}
                            </p>
                            <div className="mt-2 space-y-1">
                              {items.slice(0, 4).map((item) => {
                                const monthMeetingSlot =
                                  item.tone === "meeting" && item.snackSlotId
                                    ? calendarMonthSnackSlotById.get(item.snackSlotId) ?? null
                                    : null;
                                const monthRemovedSlot =
                                  item.tone === "cancelled" && item.removedSlotId
                                    ? calendarMonthRemovedSlotById.get(item.removedSlotId) ?? null
                                    : null;
                                const pendingActionId = monthMeetingSlot?.id ?? monthRemovedSlot?.id;
                                const meetingPending = pendingActionId
                                  ? snackPendingIds.has(pendingActionId)
                                  : false;
                                const canLeaderCancelMeeting = isAdmin && !!monthMeetingSlot;
                                const canLeaderRestoreMeeting = isAdmin && !!monthRemovedSlot;
                                const flipStateKey = monthMeetingSlot
                                  ? monthMeetingSlot.id
                                  : monthRemovedSlot
                                    ? `restore-${monthRemovedSlot.id}`
                                    : null;
                                const isCardFlipped = !!flipStateKey && meetingCancelFlipSlotId === flipStateKey;
                                const isCurrentUserSnackSignup =
                                  !!me &&
                                  !!monthMeetingSlot &&
                                  monthMeetingSlot.signups.some(
                                    (signup) => signup.id === me.id,
                                  );
                                const snackSignupNames = monthMeetingSlot
                                  ? [
                                      ...new Set(
                                        monthMeetingSlot.signups
                                          .map((signup) =>
                                            firstNameOnly(
                                              resolveDisplayName({
                                                displayName: signup.displayName,
                                                email: signup.email,
                                                fallback: "Member",
                                              }),
                                            ),
                                          )
                                          .filter((name): name is string => Boolean(name)),
                                      ),
                                    ]
                                  : item.snackSignupNames ?? [];
                                return (
                                  <div
                                    key={item.id}
                                    className={cn(
                                      (canLeaderCancelMeeting || canLeaderRestoreMeeting) &&
                                        "[perspective:1000px]",
                                    )}
                                  >
                                    <div
                                      className={cn(
                                        "relative",
                                        (canLeaderCancelMeeting || canLeaderRestoreMeeting) &&
                                          "transition-transform duration-300 [transform-style:preserve-3d]",
                                        isCardFlipped && "[transform:rotateY(180deg)]",
                                      )}
                                    >
                                      <div
                                        className={cn(
                                          "rounded px-2 py-1 text-[11px] leading-tight",
                                          item.tone === "birthday" &&
                                            "bg-primary/10 text-primary",
                                          item.tone === "meeting" &&
                                            "bg-secondary text-secondary-foreground",
                                          item.tone === "event" && "bg-muted text-foreground",
                                          item.tone === "cancelled" &&
                                            "bg-destructive/10 text-destructive",
                                          (canLeaderCancelMeeting || canLeaderRestoreMeeting) &&
                                            "cursor-pointer [backface-visibility:hidden]",
                                        )}
                                        onClick={
                                          (canLeaderCancelMeeting || canLeaderRestoreMeeting) &&
                                          flipStateKey
                                            ? () => {
                                                if (meetingPending) return;
                                                setMeetingCancelFlipSlotId((current) =>
                                                  current === flipStateKey
                                                    ? null
                                                    : flipStateKey,
                                                );
                                              }
                                            : undefined
                                        }
                                      >
                                        <p className="font-medium leading-tight">
                                          {item.title}
                                        </p>
                                        <p
                                          className={cn(
                                            "mt-0.5",
                                            (item.tone === "meeting" ||
                                              item.tone === "event") &&
                                              "whitespace-nowrap",
                                          )}
                                        >
                                          {item.detail}
                                        </p>
                                        {monthMeetingSlot &&
                                          snackSignupNames.length > 0 &&
                                          !isCurrentUserSnackSignup && (
                                            <p className="mt-0.5">
                                              Snacks: {snackSignupNames.join(", ")}
                                            </p>
                                          )}
                                        {monthMeetingSlot &&
                                          (snackSignupNames.length === 0 ||
                                            isCurrentUserSnackSignup) && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className={cn(
                                                "mt-1 h-5 w-full px-1.5 text-[10px] font-semibold",
                                                isCurrentUserSnackSignup
                                                  ? "bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive"
                                                  : "bg-destructive/10 text-destructive",
                                              )}
                                              disabled={meetingPending}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                void toggleSnackSignup(monthMeetingSlot);
                                              }}
                                              aria-label={
                                                isCurrentUserSnackSignup
                                                  ? "Remove my snack signup"
                                                  : "I'll bring snacks"
                                              }
                                            >
                                              {isCurrentUserSnackSignup ? "- Snacks" : "+ Snacks"}
                                            </Button>
                                          )}
                                      </div>

                                      {canLeaderCancelMeeting &&
                                        monthMeetingSlot && (
                                          <div
                                            className="absolute inset-0 flex items-center justify-center rounded bg-destructive/10 p-1 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                                            onClick={() =>
                                              setMeetingCancelFlipSlotId(null)
                                            }
                                          >
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-5 w-full px-1.5 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
                                              disabled={meetingPending}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                openRemoveMeetingDialog(monthMeetingSlot);
                                              }}
                                            >
                                              Cancel
                                            </Button>
                                          </div>
                                        )}
                                      {canLeaderRestoreMeeting &&
                                        monthRemovedSlot && (
                                          <div
                                            className="absolute inset-0 flex items-center justify-center rounded bg-primary/10 p-1 [backface-visibility:hidden] [transform:rotateY(180deg)]"
                                            onClick={() =>
                                              setMeetingCancelFlipSlotId(null)
                                            }
                                          >
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-5 w-full px-1.5 text-[10px]"
                                              disabled={meetingPending}
                                              onClick={(event) => {
                                                event.stopPropagation();
                                                setMeetingCancelFlipSlotId(null);
                                                void handleRestoreMeeting(monthRemovedSlot);
                                              }}
                                            >
                                              We&apos;re meeting
                                            </Button>
                                          </div>
                                        )}
                                    </div>
                                  </div>
                                );
                              })}
                              {items.length > 4 && (
                                <p className="text-[11px] text-muted-foreground">
                                  +{items.length - 4} more
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
            <Card className="border-0">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">This Week</CardTitle>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setTopicTitle(discussionTopic?.title ?? "");
                      setTopicDescription(discussionTopic?.description ?? "");
                      setTopicBibleRef(discussionTopic?.bibleReference ?? "");
                      setTopicBibleText(discussionTopic?.bibleText ?? "");
                      setTopicOpen(true);
                    }}
                  >
                    {discussionTopic ? "Edit" : "Set"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {discussionTopic ? (
                  <div className="space-y-2">
                    <p className="font-medium">{discussionTopic.title}</p>
                    {discussionTopic.description && (
                      <p className="text-sm text-muted-foreground">
                        {discussionTopic.description}
                      </p>
                    )}
                    {discussionTopic.bibleReference && (
                      <p className="text-sm font-medium">{discussionTopic.bibleReference}</p>
                    )}
                    {discussionTopic.bibleText && (
                      <p className="text-sm italic text-muted-foreground">
                        {discussionTopic.bibleText}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No topic set for this month.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="text-base">Events & Announcements</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={openCalendarMonthView}>
                    View all
                  </Button>
                  {isAdmin && (
                    <Button size="sm" onClick={openAnnouncementComposer}>
                      Manage
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentBirthdayNotices.length > 0 && (
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {recentBirthdayNotices.map((notice) => (
                      <p key={notice.id}>{notice.text}</p>
                    ))}
                  </div>
                )}

                <div className="overflow-x-auto">
                  {announcementTimeline.length === 0 ? (
                    <div className="rounded-lg bg-muted/30 px-4 py-8 text-sm text-muted-foreground">
                      No upcoming events in the next 14 days.
                    </div>
                  ) : (
                    <div className="flex min-w-max gap-3 pb-1">
                      {announcementTimeline.map((item, index) => {
                        const highlighted = index === 0;
                        const meetingSlot =
                          item.kind === "meeting" && item.snackSlotId
                            ? snackSlotById.get(item.snackSlotId) ?? null
                            : null;
                        const meetingPending = meetingSlot
                          ? snackPendingIds.has(meetingSlot.id)
                          : false;
                        const isCurrentUserSnackSignup =
                          !!me &&
                          !!meetingSlot &&
                          meetingSlot.signups.some((signup) => signup.id === me.id);
                        const canFlipForCancel = Boolean(
                          isAdmin && item.kind === "meeting" && meetingSlot,
                        );
                        const isFlipped =
                          canFlipForCancel &&
                          !!meetingSlot &&
                          meetingCancelFlipSlotId === meetingSlot.id;
                        const birthdayEmoji =
                          item.kind === "birthday" ? pickBirthdayEmoji(item.id) : null;
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "h-[220px] w-[210px]",
                              canFlipForCancel && "[perspective:1200px]",
                            )}
                          >
                            <div
                              className={cn(
                                "relative h-full w-full",
                                canFlipForCancel &&
                                  "transition-transform duration-300 [transform-style:preserve-3d]",
                                isFlipped && "[transform:rotateY(180deg)]",
                              )}
                            >
                              <article
                                className={cn(
                                  "relative flex h-full w-full flex-col justify-between rounded-lg border p-4",
                                  highlighted
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-card text-card-foreground",
                                  isCurrentUserSnackSignup
                                    ? "border-primary"
                                    : highlighted
                                      ? "border-primary/45"
                                      : "border-border/50",
                                  canFlipForCancel &&
                                    "absolute inset-0 cursor-pointer [backface-visibility:hidden]",
                                )}
                                onClick={
                                  canFlipForCancel && meetingSlot
                                    ? () => {
                                        if (meetingPending) return;
                                        setMeetingCancelFlipSlotId((current) =>
                                          current === meetingSlot.id ? null : meetingSlot.id,
                                        );
                                      }
                                    : undefined
                                }
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-4xl font-semibold leading-none">
                                      {String(item.date.getDate()).padStart(2, "0")}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-1 text-sm font-medium",
                                        highlighted
                                          ? "text-primary-foreground/90"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {item.date.toLocaleDateString(undefined, {
                                        month: "short",
                                      })}
                                    </p>
                                  </div>
                                  {item.kind === "meeting" && (
                                    <>
                                      {meetingSlot &&
                                      (item.snackSignupNames.length === 0 ||
                                        isCurrentUserSnackSignup) ? (
                                        <Button
                                          size="sm"
                                          variant={highlighted ? "secondary" : "outline"}
                                          className={cn(
                                            "h-7 px-2 text-xs font-semibold",
                                            isCurrentUserSnackSignup
                                              ? "bg-primary/10 text-primary"
                                              : "bg-destructive/10 text-destructive",
                                            isCurrentUserSnackSignup &&
                                              "hover:bg-destructive/10 hover:text-destructive",
                                            !isCurrentUserSnackSignup &&
                                              highlighted &&
                                              "hover:bg-primary-foreground/90",
                                          )}
                                          disabled={meetingPending}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void toggleSnackSignup(meetingSlot);
                                          }}
                                          aria-label={
                                            isCurrentUserSnackSignup
                                              ? "Remove my snack signup"
                                              : "I'll bring snacks"
                                          }
                                        >
                                          {isCurrentUserSnackSignup ? "- Snacks" : "+ Snacks"}
                                        </Button>
                                      ) : (
                                        <p
                                          className={cn(
                                            "max-w-[7.5rem] text-right text-xs leading-tight",
                                            highlighted
                                              ? "text-primary-foreground/85"
                                              : "text-muted-foreground",
                                          )}
                                        >
                                          Snacks:{" "}
                                          {item.snackSignupNames.length > 0
                                            ? item.snackSignupNames.join(", ")
                                            : "No one yet"}
                                        </p>
                                      )}
                                    </>
                                  )}
                                  {item.kind === "birthday" && birthdayEmoji && (
                                    <span
                                      aria-hidden
                                      className={cn(
                                        "text-xl leading-none",
                                        highlighted
                                          ? "text-primary-foreground/95"
                                          : "text-foreground/90",
                                      )}
                                    >
                                      {birthdayEmoji}
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  <p className="text-base font-semibold leading-tight">
                                    {item.title}
                                  </p>
                                  <p
                                    className={cn(
                                      "text-sm",
                                      highlighted
                                        ? "text-primary-foreground/90"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {item.timeLabel}
                                  </p>
                                  {item.location && (
                                    <p
                                      className={cn(
                                        "text-xs",
                                        highlighted
                                          ? "text-primary-foreground/80"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      @ {item.location}
                                    </p>
                                  )}
                                  <p
                                    className={cn(
                                      "text-xs",
                                      highlighted
                                        ? "text-primary-foreground/80"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {item.kind === "birthday"
                                      ? `Birthday ${item.relativeLabel}`
                                      : item.kind === "meeting"
                                        ? `Meeting ${item.relativeLabel}`
                                        : item.kind === "noSmallGroup"
                                          ? `Canceled ${item.relativeLabel}`
                                          : item.relativeLabel}
                                  </p>
                                </div>
                              </article>

                              {canFlipForCancel && meetingSlot && (
                                <article
                                  className="absolute inset-0 flex h-full w-full cursor-pointer flex-col justify-between rounded-lg bg-destructive/10 p-4 text-card-foreground [backface-visibility:hidden] [transform:rotateY(180deg)]"
                                  onClick={() => setMeetingCancelFlipSlotId(null)}
                                >
                                  <div className="space-y-2">
                                    <p className="text-base font-semibold leading-tight">
                                      Manage Small Group
                                    </p>
                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                      Cancel this meeting and provide a reason for members.
                                    </p>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    disabled={meetingPending}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openRemoveMeetingDialog(meetingSlot);
                                    }}
                                  >
                                    Cancel Small Group
                                  </Button>
                                </article>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {announcements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {announcementTimeline.length > 0
                      ? "No admin announcements yet."
                      : "No announcements yet."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {announcements.map((item) => {
                      const canFlipForDelete = isAdmin;
                      const isFlipped = canFlipForDelete && announcementFlipId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="relative grid overflow-hidden rounded-lg border border-border/50"
                        >
                            <article
                              className={cn(
                                "col-start-1 row-start-1 bg-card p-4 text-card-foreground",
                                canFlipForDelete &&
                                  "cursor-pointer transition-transform duration-300",
                                canFlipForDelete &&
                                  (isFlipped
                                    ? "-translate-x-full pointer-events-none"
                                    : "translate-x-0"),
                              )}
                              onClick={
                                canFlipForDelete
                                  ? () =>
                                      setAnnouncementFlipId((current) =>
                                        current === item.id ? null : item.id,
                                      )
                                  : undefined
                              }
                            >
                              <p className="font-medium">{item.title}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                            </article>

                            {canFlipForDelete && (
                              <article
                                className={cn(
                                  "col-start-1 row-start-1 flex cursor-pointer items-center justify-center bg-destructive/10 p-4 text-card-foreground transition-transform duration-300",
                                  isFlipped
                                    ? "translate-x-0"
                                    : "translate-x-full pointer-events-none",
                                )}
                                onClick={() => setAnnouncementFlipId(null)}
                              >
                                <div className="flex w-full items-center justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openAnnouncementEditor(item);
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleDeleteAnnouncement(item);
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </article>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <CardTitle className="justify-self-start text-base">Memory Verse</CardTitle>
                  {activeMemoryVerse ? (
                    <div className="flex items-center justify-self-center gap-2">
                      {[1, 2, 3].map((value) => {
                        const option = value as PracticeLevel;
                        const completed = memoryPracticeCompletion[option];
                        const isActive = memoryPracticeLevel === option;
                        const locked = !canAccessMemoryPracticeLevel(option);
                        return (
                          <Button
                            key={option}
                            size="sm"
                            variant={completed ? "outline" : isActive ? "default" : "outline"}
                            className={cn(
                              completed &&
                                "border-primary/35 bg-primary/15 text-primary hover:bg-primary/20",
                            )}
                            disabled={locked}
                            onClick={() => handleMemoryPracticeLevelChange(option)}
                          >
                            {completed && <Check className="mr-1 size-3.5" aria-hidden />}
                            Level {option}
                          </Button>
                        );
                      })}
                    </div>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center justify-self-end gap-2">
                    {activeMemoryVerse && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          handleJumpToVerseReference(activeMemoryVerse.verseReference)
                        }
                      >
                        Read this chapter
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setVerseRef(verseMemory[0]?.verseReference ?? "");
                          setVerseSnippet(verseMemory[0]?.verseSnippet ?? "");
                          setVerseOpen(true);
                        }}
                      >
                        {verseMemory.length ? "Edit" : "Set verse"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {!activeMemoryVerse ? (
                  <p className="text-sm text-muted-foreground">No verse set for this month.</p>
                ) : (
                  <PracticeVerseGame
                    initialReference={activeMemoryVerse.verseReference}
                    verseId={activeMemoryVerse.id}
                    embedded
                    level={memoryPracticeLevel}
                    onLevelChange={setMemoryPracticeLevel}
                    onCompletedLevelsChange={setMemoryPracticeCompletion}
                    showLevelSelector={false}
                  />
                )}
              </CardContent>
            </Card>
              </>
            )}
          </>
        )}

        {activeTab === "prayer" && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4 rounded-xl bg-card p-4">
                  <div className="space-y-2">
                    <Label htmlFor="prayer-request-input">Create a prayer request</Label>
                    <Textarea
                      id="prayer-request-input"
                      value={prayerContent}
                      onChange={(event) => setPrayerContent(event.target.value)}
                      placeholder="Share what you want prayer for..."
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Who can see this?</Label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {PRAYER_VISIBILITY_OPTIONS.map((option) => {
                        const isSelected = prayerVisibility === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setPrayerVisibility(option.value)}
                            className={cn(
                              "rounded-lg border p-3 text-left transition",
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background hover:bg-accent/40",
                            )}
                          >
                            <p className="text-sm font-semibold">{option.label}</p>
                            <p
                              className={cn(
                                "mt-1 text-xs",
                                isSelected
                                  ? "text-primary-foreground/80"
                                  : "text-muted-foreground",
                              )}
                            >
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {prayerVisibility === "my_gender" &&
                    me?.gender !== "male" &&
                    me?.gender !== "female" && (
                      <p className="text-xs text-amber-700">
                        Set your gender in Settings before using this option.
                      </p>
                    )}

                  {prayerVisibility === "specific_people" && (
                    <div className="space-y-2">
                      <Label>Pick people</Label>
                      {prayerRecipientMembers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No other members yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {prayerRecipientMembers.map((member) => {
                            const isSelected = prayerRecipientIds.includes(member.id);
                            const memberName = resolveDisplayName({
                              displayName: member.displayName,
                              email: member.email,
                              fallback: "Member",
                            });
                            return (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => togglePrayerRecipient(member.id)}
                                className={cn(
                                  "rounded-full border px-3 py-1.5 text-sm transition",
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-background hover:bg-accent/40",
                                )}
                              >
                                {memberName}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      onClick={() => void handleAddPrayer()}
                      disabled={
                        submitting ||
                        !prayerContent.trim() ||
                        (prayerVisibility === "my_gender" &&
                          me?.gender !== "male" &&
                          me?.gender !== "female") ||
                        (prayerVisibility === "specific_people" &&
                          prayerRecipientIds.length === 0)
                      }
                    >
                      {submitting ? (
                        <span
                          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        "Post request"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {prayerRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No prayer requests yet.</p>
            ) : (
              <div className="columns-2 gap-3 sm:gap-4 xl:columns-3">
                {prayerRequests.map((prayer, index) => {
                  const noteStyle = PRAYER_NOTE_STYLES[index % PRAYER_NOTE_STYLES.length];
                  const noteSizing = getPrayerNoteSizing(prayer.content);
                  const notePreviewText = noteSizing.needsReadMore
                    ? getPrayerPreviewContent(prayer.content)
                    : prayer.content;
                  return (
                    <article
                      key={prayer.id}
                      className={cn(
                        "relative mb-3 break-inside-avoid rounded-none border border-black/10 p-4 pt-5 shadow-[0_10px_18px_rgba(107,84,40,0.22)] transition-transform duration-150 hover:rotate-0 sm:mb-4 flex flex-col",
                        noteStyle.paper,
                        noteStyle.tilt,
                      )}
                      style={{ minHeight: `${noteSizing.minHeightRem}rem` }}
                    >
                      <div
                        className={cn(
                          "absolute -top-3 left-1/2 h-6 w-20 -translate-x-1/2 rounded-none opacity-80 shadow-sm",
                          noteStyle.tape,
                        )}
                        aria-hidden
                      />
                      {prayer.authorId === me?.id && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="absolute right-1 top-1 z-10 size-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeletePrayer(prayer)}
                          aria-label="Delete prayer request"
                        >
                          <X className="size-4" />
                        </Button>
                      )}
                      <p
                        className="pr-1 text-[1.45rem] leading-relaxed text-foreground whitespace-pre-wrap"
                        style={{ fontFamily: "var(--font-handwriting)" }}
                      >
                        {notePreviewText}
                      </p>
                      {noteSizing.needsReadMore && (
                        <button
                          type="button"
                          className="mt-2 w-fit text-xs font-semibold text-primary underline decoration-primary/60 underline-offset-2 hover:text-primary/80"
                          onClick={() => setReadMorePrayer(prayer)}
                        >
                          Read more
                        </button>
                      )}
                      <div className="mt-auto pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {prayer.authorName ?? "Someone"} •{" "}
                          {formatPrayerVisibilityLabel(prayer)}
                        </span>
                        <span>{formatPrayerDateLabel(prayer.createdAt)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "verse" && (
          <>
            <Card>
              <CardContent className="space-y-4">
                {chapterLoading && (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <span
                      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                    Loading chapter...
                  </div>
                )}

                {!chapterLoading && chapterError && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    <p>{chapterError}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => loadVerseReader(selectedBook, selectedChapter)}
                    >
                      Retry
                    </Button>
                  </div>
                )}

                {!chapterLoading && !chapterError && chapterData && (
                  <div className="space-y-3">
                    <div className="p-4 leading-8">
                      {chapterData.verses.map((verse, index) => {
                        const selected = selectedVerseNumbers.has(verse.verseNumber);
                        const highlightedByMe = !!myVerseHighlightByNumber[verse.verseNumber];
                        const highlightedCount = chapterVerseHighlightCount[verse.verseNumber] ?? 0;
                        return (
                          <span key={`${verse.reference}-${verse.verseNumber}`}>
                            {showEsvHeadings && verse.heading ? (
                              <span className="block pt-3 text-sm font-semibold text-foreground">
                                {verse.heading}
                              </span>
                            ) : null}
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedVerseNumbers((current) => {
                                  const next = new Set(current);
                                  if (next.has(verse.verseNumber)) {
                                    next.delete(verse.verseNumber);
                                  } else {
                                    next.add(verse.verseNumber);
                                  }
                                  return next;
                                });
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                setSelectedVerseNumbers((current) => {
                                  const next = new Set(current);
                                  if (next.has(verse.verseNumber)) {
                                    next.delete(verse.verseNumber);
                                  } else {
                                    next.add(verse.verseNumber);
                                  }
                                  return next;
                                });
                              }}
                              className={cn(
                                "inline cursor-pointer rounded px-1 py-0.5 align-baseline transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                highlightedCount > 0 && "bg-accent/60",
                                highlightedByMe && "bg-primary/15 text-primary",
                                selected &&
                                  "underline decoration-2 underline-offset-4 decoration-primary",
                              )}
                            >
                              {showVerseNumbers && (
                                <span
                                  className={cn(
                                    "mr-1 text-xs font-semibold text-muted-foreground",
                                    highlightedCount > 0 && "text-primary",
                                  )}
                                >
                                  {verse.verseNumber}
                                </span>
                              )}
                              {verse.text}
                            </span>
                            {index < chapterData.verses.length - 1 ? " " : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Highlights in {selectedBook} {selectedChapter}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {highlightsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span
                      className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                      aria-hidden
                    />
                    Loading highlights...
                  </div>
                ) : chapterHighlights.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No highlights yet in this chapter.
                  </p>
                ) : (
                  chapterHighlights.map((item) => (
                    <div key={item.id} className="rounded-lg bg-card p-3">
                      <p className="font-medium">{item.verseReference}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.userName}
                        {item.isMine ? " (You)" : ""}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "settings" && (
          <>
            <div className="grid gap-4 lg:grid-cols-[27rem_minmax(0,1fr)]">
              <Card className="lg:w-[27rem]">
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="settings-display-name">Display name</Label>
                      <Input
                        id="settings-display-name"
                        value={profileDisplayName}
                        onChange={(event) => setProfileDisplayName(event.target.value)}
                        placeholder="Your name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-birthday-month">Birthday</Label>
                      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              id="settings-birthday-month"
                              type="button"
                              variant="outline"
                              className="h-9 w-full justify-between bg-transparent font-normal"
                            >
                              {selectedMonthLabel}
                              <ChevronDown className="size-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto"
                          >
                            {MONTH_OPTIONS.map((month) => {
                              const monthValue = String(month.value);
                              const selected = profileBirthdayMonth === monthValue;
                              return (
                                <DropdownMenuItem
                                  key={`birthday-month-${month.value}`}
                                  className={cn(
                                    "justify-between",
                                    selected && "bg-primary/10 text-primary",
                                  )}
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    setProfileBirthdayMonth(monthValue);
                                  }}
                                >
                                  {month.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              id="settings-birthday-day"
                              type="button"
                              variant="outline"
                              disabled={!profileBirthdayMonth}
                              className="h-9 w-full justify-between bg-transparent font-normal"
                            >
                              {selectedDayLabel}
                              <ChevronDown className="size-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-[var(--radix-dropdown-menu-trigger-width)] max-h-64 overflow-y-auto"
                          >
                            {birthdayDayOptions.map((day) => {
                              const dayValue = String(day);
                              const selected = profileBirthdayDay === dayValue;
                              return (
                                <DropdownMenuItem
                                  key={`birthday-day-${day}`}
                                  className={cn(
                                    "justify-between",
                                    selected && "bg-primary/10 text-primary",
                                  )}
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    setProfileBirthdayDay(dayValue);
                                  }}
                                >
                                  {day}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-gender">Gender</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            id="settings-gender"
                            type="button"
                            variant="outline"
                            className="h-9 w-full justify-between bg-transparent font-normal"
                          >
                            {selectedGenderLabel}
                            <ChevronDown className="size-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-[var(--radix-dropdown-menu-trigger-width)]"
                        >
                          <DropdownMenuItem
                            className={cn(profileGender === "" && "bg-primary/10 text-primary")}
                            onSelect={(event) => {
                              event.preventDefault();
                              setProfileGender("");
                            }}
                          >
                            Select gender
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={cn(
                              profileGender === "male" && "bg-primary/10 text-primary",
                            )}
                            onSelect={(event) => {
                              event.preventDefault();
                              setProfileGender("male");
                            }}
                          >
                            Male
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className={cn(
                              profileGender === "female" && "bg-primary/10 text-primary",
                            )}
                            onSelect={(event) => {
                              event.preventDefault();
                              setProfileGender("female");
                            }}
                          >
                            Female
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Email:</span> {me?.email ?? "-"}
                    </p>
                    <p>
                      <span className="font-medium">Role:</span> {getRoleLabel(me?.role)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => void handleSaveProfile()}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <span
                          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        "Save profile"
                      )}
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void handleSignOut()}>
                      Sign out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="hidden lg:flex items-center justify-center">
                <Image
                  src="/sglogo.png"
                  alt="Small Group"
                  width={360}
                  height={360}
                  className="h-auto w-[min(24rem,80%)] object-contain"
                />
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Group members</CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-2 font-medium">Name</th>
                          <th className="px-2 py-2 font-medium">Email</th>
                          <th className="px-2 py-2 font-medium">Role</th>
                          <th className="px-2 py-2 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => (
                          <tr key={member.id}>
                            <td className="px-2 py-3 align-middle">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {member.displayName ?? "Member"}
                                </span>
                                {member.id === me?.id && <Badge variant="outline">You</Badge>}
                              </div>
                            </td>
                            <td className="px-2 py-3 align-middle text-muted-foreground">
                              {member.email}
                            </td>
                            <td className="px-2 py-3 align-middle">
                              <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                                {getRoleLabel(member.role)}
                              </Badge>
                            </td>
                            <td className="px-2 py-3 text-right align-middle">
                              {isAdmin && member.id !== me?.id ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => openRemoveMemberDialog(member)}
                                >
                                  Remove
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

      </main>

      <footer className="bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-3 text-center text-xs text-muted-foreground">
          <a href="https://www.esv.org" target="_blank" rel="noreferrer" className="underline">
            ESV text from Crossway
          </a>
        </div>
      </footer>
      </div>

      {activeTab === "verse" && selectedVerseNumbers.size > 0 && (
        <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl bg-background/95 p-2 shadow-lg backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={highlightSubmitting}
              onClick={() => void handleToggleSelectedHighlight()}
            >
              {allSelectedHighlightedByMe ? (
                <BookmarkCheck className="size-4" />
              ) : (
                <Bookmark className="size-4" />
              )}
              {allSelectedHighlightedByMe ? "Unhighlight" : "Highlight"}
            </Button>
            <Button
              size="sm"
              disabled={sharingVerse}
              onClick={() => void handleShareSelectedVerse()}
            >
              <Share2 className="size-4" />
              Share
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedVerseNumbers(new Set())}
            >
              <X className="size-4" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <Dialog open={bookPickerOpen} onOpenChange={setBookPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose book</DialogTitle>
            <DialogDescription>Select a Bible book.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                size="sm"
                variant={bookPickerTestament === "old" ? "default" : "secondary"}
                onClick={() => setBookPickerTestament("old")}
              >
                Old Testament
              </Button>
              <Button
                type="button"
                size="sm"
                variant={bookPickerTestament === "new" ? "default" : "secondary"}
                onClick={() => setBookPickerTestament("new")}
              >
                New Testament
              </Button>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {bookPickerOptions.map((option) => (
                <button
                  key={`book-picker-${option.name}`}
                  type="button"
                  className={cn(
                    "w-full rounded-md bg-muted px-3 py-2 text-left transition hover:bg-accent",
                    option.name === selectedBook && "bg-primary/10 text-primary",
                  )}
                  onClick={() => {
                    setPickerBook(option.name);
                    setBookPickerOpen(false);
                    setChapterPickerOpen(true);
                  }}
                >
                  <p className="text-sm font-semibold">{option.name}</p>
                  <p className="text-xs text-muted-foreground">{option.chapters} chapters</p>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={chapterPickerOpen}
        onOpenChange={(open) => {
          setChapterPickerOpen(open);
          if (!open) {
            setPickerBook(null);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose chapter</DialogTitle>
            <DialogDescription>
              Select a chapter in {chapterPickerBook}.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {chapterPickerOptions.map((chapter) => (
              <button
                key={`chapter-picker-${chapterPickerBookOption.name}-${chapter}`}
                type="button"
                className={cn(
                  "w-full rounded-md bg-muted px-3 py-2 text-left text-sm font-semibold transition hover:bg-accent",
                  chapterPickerBook === selectedBook &&
                    chapter === selectedChapter &&
                    "bg-primary/10 text-primary",
                )}
                onClick={() => {
                  setChapterPickerOpen(false);
                  handleSelectBookAndChapter(chapterPickerBook, chapter);
                  setPickerBook(null);
                }}
              >
                Chapter {chapter}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={verseSettingsOpen} onOpenChange={setVerseSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bible reader settings</DialogTitle>
            <DialogDescription>
              Choose how scripture appears while reading.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="verse-settings-numbers">Show verse numbers</Label>
              <Switch
                id="verse-settings-numbers"
                checked={showVerseNumbers}
                onCheckedChange={setShowVerseNumbers}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="verse-settings-headings">Show section headings</Label>
              <Switch
                id="verse-settings-headings"
                checked={showEsvHeadings}
                onCheckedChange={setShowEsvHeadings}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerseSettingsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeMeetingOpen}
        onOpenChange={(open) => {
          if (open) {
            setRemoveMeetingOpen(true);
            return;
          }
          closeRemoveMeetingDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Small Group</DialogTitle>
            <DialogDescription>
              Share why this Small Group is canceled. This reason is shown on the calendar card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {meetingToRemove && (
              <p className="text-sm font-medium">
                {new Date(`${meetingToRemove.slotDate}T12:00:00`).toLocaleDateString(
                  undefined,
                  {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  },
                )}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="cancel-meeting-reason">Reason</Label>
              <Textarea
                id="cancel-meeting-reason"
                value={removeMeetingReason}
                onChange={(event) => setRemoveMeetingReason(event.target.value)}
                placeholder="Example: Leader training retreat this week."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeRemoveMeetingDialog}>
              Keep meeting
            </Button>
            <Button
              onClick={() => void handleSubmitRemoveMeeting()}
              disabled={
                !meetingToRemove ||
                !removeMeetingReason.trim() ||
                snackPendingIds.has(meetingToRemove.id)
              }
            >
              Confirm cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeMemberOpen}
        onOpenChange={(open) => {
          if (open) {
            setRemoveMemberOpen(true);
            return;
          }
          closeRemoveMemberDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Group Member</DialogTitle>
            <DialogDescription>
              This removes the member from your Small Group.
            </DialogDescription>
          </DialogHeader>
          {memberToRemove && (
            <div className="space-y-1 py-2">
              <p className="text-sm font-medium">
                {resolveDisplayName({
                  displayName: memberToRemove.displayName,
                  email: memberToRemove.email,
                  fallback: "Member",
                })}
              </p>
              <p className="text-sm text-muted-foreground">{memberToRemove.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeRemoveMemberDialog} disabled={memberRemoving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmRemoveMember()}
              disabled={!memberToRemove || memberRemoving}
            >
              {memberRemoving ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Remove member"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && (
        <Dialog
          open={announcementOpen}
          onOpenChange={(open) => {
            if (open) {
              setAnnouncementOpen(true);
              return;
            }
            closeAnnouncementComposer();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAnnouncementId ? "Edit Announcement" : "Add Event / Announcement"}
              </DialogTitle>
              <DialogDescription>
                Post a group announcement or add back a canceled Small Group date.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Announcement</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  value={newTitle}
                  onChange={(event) => setNewTitle(event.target.value)}
                  placeholder="Title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-body">Body</Label>
                <Textarea
                  id="ann-body"
                  value={newBody}
                  onChange={(event) => setNewBody(event.target.value)}
                  placeholder="Body"
                  rows={4}
                />
              </div>
              <div className="space-y-2 rounded-lg bg-muted/30 p-3">
                <p className="text-sm font-medium">Canceled Small Groups</p>
                {removedSnackSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No canceled dates.</p>
                ) : (
                  <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                    {removedSnackSlots.map((slot) => (
                      <div key={slot.id} className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm">
                            {new Date(`${slot.slotDate}T12:00:00`).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                          {slot.cancellationReason && (
                            <p className="text-xs text-muted-foreground">{slot.cancellationReason}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          disabled={snackPendingIds.has(slot.id)}
                          onClick={() => void handleRestoreMeeting(slot)}
                        >
                          Add back
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={closeAnnouncementComposer}>
                Cancel
              </Button>
              <Button
                onClick={() => void handleSaveAnnouncement()}
                disabled={submitting || !newTitle.trim() || !newBody.trim()}
              >
                {submitting ? (
                  <span
                    className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                    aria-hidden
                  />
                ) : (
                  editingAnnouncementId ? "Save" : "Publish"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={topicOpen} onOpenChange={setTopicOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>This Week</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Topic title</Label>
              <Input
                value={topicTitle}
                onChange={(event) => setTopicTitle(event.target.value)}
                placeholder="Topic title"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={topicDescription}
                onChange={(event) => setTopicDescription(event.target.value)}
                placeholder="Description"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Bible reference</Label>
              <Input
                value={topicBibleRef}
                onChange={(event) => setTopicBibleRef(event.target.value)}
                placeholder="e.g. John 3:16"
              />
            </div>
            <div className="space-y-2">
              <Label>Bible text (optional)</Label>
              <Textarea
                value={topicBibleText}
                onChange={(event) => setTopicBibleText(event.target.value)}
                placeholder="Verse text"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveTopic()} disabled={submitting || !topicTitle.trim()}>
              {submitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(readMorePrayer)}
        onOpenChange={(open) => {
          if (!open) {
            setReadMorePrayer(null);
          }
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Prayer request</DialogTitle>
            {readMorePrayer && (
              <DialogDescription>
                {readMorePrayer.authorName ?? "Someone"} •{" "}
                {formatPrayerVisibilityLabel(readMorePrayer)} •{" "}
                {formatPrayerDateLabel(readMorePrayer.createdAt)}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto rounded-lg bg-muted/20 p-4">
            <p
              className="whitespace-pre-wrap text-[1.5rem] leading-relaxed text-foreground"
              style={{ fontFamily: "var(--font-handwriting)" }}
            >
              {readMorePrayer?.content ?? ""}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadMorePrayer(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={verseOpen} onOpenChange={setVerseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verse of the month</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Reference</Label>
              <Input
                value={verseRef}
                onChange={(event) => setVerseRef(event.target.value)}
                placeholder="e.g. John 3:16"
              />
            </div>
            <div className="space-y-2">
              <Label>Verse text (optional)</Label>
              <Textarea
                value={verseSnippet}
                onChange={(event) => setVerseSnippet(event.target.value)}
                placeholder="Verse text"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerseOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveVerse()} disabled={submitting || !verseRef.trim()}>
              {submitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
