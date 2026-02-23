"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type TouchEvent,
  type TransitionEvent,
  type UIEvent,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import {
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronDown,
  HandHeart,
  Handshake,
  Heart,
  Home,
  LogOut,
  MessageCircle,
  MoveDiagonal,
  Pencil,
  Reply,
  Settings,
  Share2,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  api,
  setActiveGroupId as setApiActiveGroupId,
  type AddGroupMemberResult,
  type Announcement,
  type BibleChapterResponse,
  type CalendarEvent,
  type DiscussionTopic,
  type GroupDirectoryItem,
  type GroupJoinRequest,
  type GroupSummary,
  type PrayerRequestActivity,
  type LeadershipTransition,
  type Profile,
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
  buildDateKey,
  addDaysToDateKey,
  dayDiffFromDateKeys,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getDatePartsFromDateKey,
  getDateKeyInTimeZone,
  getMonthYearInTimeZone,
  getWeekdayFromDateKey,
} from "@/lib/timezone";
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
import { Badge, badgeVariants } from "@/components/ui/badge";

type Member = {
  id: string;
  displayName: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "member";
  canEditEventsAnnouncements: boolean;
  birthdayMonth?: number | null;
  birthdayDay?: number | null;
};

type UserGender = "male" | "female";
type PrayerListViewMode = "my_wall" | "open";

type AppTab = "home" | "prayer" | "verse" | "settings";
const ACTIVE_GROUP_STORAGE_KEY = "smallgroup.activeGroupId";

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
function highestAvailablePracticeLevel(
  completion: PracticeLevelCompletion,
): PracticeLevel {
  if (completion[3] || completion[2]) return 3;
  if (completion[1]) return 2;
  return 1;
}
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
  { paper: "bg-[#d8e8d3]", tilt: "rotate-2", tape: "bg-muted/80" },
];
const PRAYER_NOTE_NORMAL_MAX_HEIGHT_REM = 14;
const PRAYER_NOTE_PREVIEW_CHAR_LIMIT = 220;
const HOME_ACTIVITY_PAGE_SIZE = 5;
const WEEKDAY_SHORT_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

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

function formatMemberFullName(
  member: Pick<Member, "firstName" | "lastName" | "displayName" | "email">,
): string {
  const fullName = [member.firstName, member.lastName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(" ");
  if (fullName) return fullName;

  const safeDisplayName = sanitizeDisplayName(member.displayName);
  if (safeDisplayName) return safeDisplayName;

  return resolveDisplayName({
    displayName: member.displayName,
    email: member.email,
    fallback: "Member",
  });
}

function formatBirthdayLabel(
  month: number | null | undefined,
  day: number | null | undefined,
): string {
  if (typeof month !== "number" || !Number.isInteger(month)) return "-";
  if (typeof day !== "number" || !Number.isInteger(day)) return "-";
  if (month < 1 || month > 12) return "-";
  const maxDays = new Date(Date.UTC(2000, month, 0)).getUTCDate();
  if (day < 1 || day > maxDays) return "-";

  const monthLabel = MONTH_OPTIONS.find((option) => option.value === month)?.label ?? String(month);
  return `${monthLabel} ${day}`;
}

function formatMemberBirthday(member: Pick<Member, "birthdayMonth" | "birthdayDay">): string {
  return formatBirthdayLabel(member.birthdayMonth, member.birthdayDay);
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

function parseVerseSelectionInput(raw: string): number[] | null {
  const normalized = raw
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/\s+/g, "");
  if (!normalized) return [];
  if (!/^[\d,-]+$/.test(normalized)) return null;

  const segments = normalized.split(",");
  if (segments.some((segment) => !segment)) return null;

  const numbers: number[] = [];
  for (const segment of segments) {
    if (/^\d+$/.test(segment)) {
      const value = Number.parseInt(segment, 10);
      if (!Number.isFinite(value) || value < 1) return null;
      numbers.push(value);
      continue;
    }

    const rangeMatch = segment.match(/^(\d+)-(\d+)$/);
    if (!rangeMatch) return null;

    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start) {
      return null;
    }
    // Guard against accidental very large ranges from malformed input.
    if (end - start > 199) return null;
    for (let value = start; value <= end; value += 1) {
      numbers.push(value);
    }
  }

  return [...new Set(numbers)].sort((a, b) => a - b);
}

function parseBookAndChapterFromReference(
  reference: string,
): { book: string; chapter: number; verseSelection: string; verseNumbers: number[] } | null {
  const normalized = reference
    .replace(/[‐‑‒–—−]/g, "-")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  if (!normalized) return null;
  const sortedBooks = [...BIBLE_BOOKS].sort((a, b) => b.name.length - a.name.length);
  for (const option of sortedBooks) {
    const bookLower = option.name.toLowerCase();
    if (!normalized.startsWith(`${bookLower} `)) continue;
    const rest = normalized.slice(bookLower.length).trim();
    const chapterMatch = rest.match(/^(\d{1,3})(?::([\d,\-\s]+))?/);
    if (!chapterMatch) continue;
    const chapter = Number.parseInt(chapterMatch[1], 10);
    if (!Number.isFinite(chapter) || chapter < 1 || chapter > option.chapters) {
      continue;
    }
    const verseSelection = chapterMatch[2]?.replace(/\s+/g, "") ?? "";
    const parsedVerseNumbers = parseVerseSelectionInput(verseSelection);
    return {
      book: option.name,
      chapter,
      verseSelection,
      verseNumbers: parsedVerseNumbers ?? [],
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

function buildVerseSnippetFromChapterVerses(
  verses: Array<{ verseNumber: number; text: string }>,
  verseNumbers: number[],
): string {
  if (verseNumbers.length === 0) return "";
  const verseSet = new Set(verseNumbers);
  return verses
    .filter((verse) => verseSet.has(verse.verseNumber))
    .map((verse) => verse.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
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

function getDayOrdinalSuffix(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return "th";
  const mod10 = day % 10;
  if (mod10 === 1) return "st";
  if (mod10 === 2) return "nd";
  if (mod10 === 3) return "rd";
  return "th";
}

function splitNameParts(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
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
  const startLabel = formatTimeInTimeZone(start, {
    hour: "numeric",
    minute: "2-digit",
  });
  if (!event.endAt) return startLabel;

  const end = new Date(event.endAt);
  const endLabel = formatTimeInTimeZone(end, {
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
  return formatDateInTimeZone(date, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrayerAgeDaysLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const createdDateKey = getDateKeyInTimeZone(date);
  const todayDateKey = getDateKeyInTimeZone(new Date());
  const ageDays = Math.max(0, dayDiffFromDateKeys(createdDateKey, todayDateKey));
  return `(${ageDays}d)`;
}

function formatPrayerActivityDateTimeLabel(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  const dateLabel = formatDateInTimeZone(date, {
    month: "short",
    day: "numeric",
  });
  const timeLabel = formatTimeInTimeZone(date, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateLabel} ${timeLabel}`;
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

function joinNamesWithAmpersand(rawNames: string[]): string {
  const names = [...new Set(rawNames.map((name) => name.trim()).filter(Boolean))];
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function formatPrayerActivityAudienceLabel(
  prayer: Pick<PrayerRequest, "visibility" | "isPrivate" | "recipientIds">,
  viewerGender: UserGender | null | undefined,
  memberDisplayNameById: ReadonlyMap<string, string>,
): string {
  const visibility =
    prayer.visibility ??
    (prayer.isPrivate ? ("specific_people" as PrayerVisibility) : "everyone");
  if (visibility === "my_gender") return viewerGender === "female" ? "the women" : "the men";
  if (visibility === "specific_people") {
    const recipientIds = Array.isArray(prayer.recipientIds) ? prayer.recipientIds : [];
    if (recipientIds.length === 0) return "users";
    const names = recipientIds
      .map((recipientId) => memberDisplayNameById.get(recipientId) ?? null)
      .filter((name): name is string => Boolean(name));
    if (names.length === 0) return "users";
    return joinNamesWithAmpersand(names);
  }
  return "everyone";
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

function truncateTimelineDetail(
  value: string | null | undefined,
  maxLength = 120,
): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
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
type PrayerCardActivity = {
  id: PrayerRequestActivity["id"];
  prayerRequestId: PrayerRequestActivity["prayerRequestId"];
  actorId: PrayerRequestActivity["actorId"];
  actorName: PrayerRequestActivity["actorName"];
  type: PrayerRequestActivity["type"];
  createdAt: PrayerRequestActivity["createdAt"];
  comment: PrayerRequestActivity["comment"];
};
type HomeActivityTimelineItem = {
  id: string;
  createdAt: Date;
  summary: string;
  detail: string | null;
  linkedPrayerRequestId?: string;
};

function prependUniquePrayerActivity(
  existing: PrayerCardActivity[],
  entry: PrayerCardActivity,
): PrayerCardActivity[] {
  const withoutSameId = existing.filter((activity) => activity.id !== entry.id);
  if (entry.type === "prayed") {
    return [
      entry,
      ...withoutSameId.filter(
        (activity) =>
          !(activity.type === "prayed" && activity.actorId === entry.actorId),
      ),
    ];
  }
  return [entry, ...withoutSameId];
}

function dayOffsetFromToday(date: Date, now: Date): number {
  const todayDateKey = getDateKeyInTimeZone(now);
  const targetDateKey = getDateKeyInTimeZone(date);
  return dayDiffFromDateKeys(todayDateKey, targetDateKey);
}

function localDateKey(date: Date): string {
  return getDateKeyInTimeZone(date);
}

function monthStartDate(date: Date): Date {
  const { year, month } = getMonthYearInTimeZone(date);
  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

function monthEndDate(date: Date): Date {
  const { year, month } = getMonthYearInTimeZone(date);
  return new Date(year, month, 0, 12, 0, 0, 0);
}

type TopInfoBarProps = {
  isAdmin: boolean;
  verseReference: string;
  topicTitle: string;
  topicDescription: string;
  onJumpToVerseReference: (reference: string) => void;
  onOpenEditor: () => void;
};

type TopInfoEntryKey = "verse" | "title" | "description" | "combined";
type TopInfoEntry = {
  key: TopInfoEntryKey;
  text: string;
  className: string;
};
type TopInfoContentEntry = Omit<TopInfoEntry, "key"> & {
  key: "verse" | "title" | "description";
};

function TopInfoBar({
  isAdmin,
  verseReference,
  topicTitle,
  topicDescription,
  onJumpToVerseReference,
  onOpenEditor,
}: TopInfoBarProps) {
  const normalizedVerseReference = verseReference.trim();
  const normalizedTitle = topicTitle.trim();
  const normalizedDescription = topicDescription.trim();
  const [isDesktop, setIsDesktop] = useState(false);
  const baseEntries = useMemo<TopInfoContentEntry[]>(
    () =>
      [
        normalizedVerseReference
          ? {
              key: "verse" as const,
              text: normalizedVerseReference,
              className: "font-semibold text-foreground",
            }
          : null,
        normalizedTitle
          ? {
              key: "title" as const,
              text: normalizedTitle,
              className: "font-semibold text-foreground",
            }
          : null,
        normalizedDescription
          ? {
              key: "description" as const,
              text: normalizedDescription,
              className: "text-muted-foreground",
            }
          : null,
      ].filter((item): item is TopInfoContentEntry => Boolean(item)),
    [normalizedDescription, normalizedTitle, normalizedVerseReference],
  );
  const entries = useMemo<TopInfoEntry[]>(() => {
    if (!isDesktop) return baseEntries;
    if (baseEntries.length === 0) return [];
    return [
      {
        key: "combined",
        text: baseEntries.map((entry) => entry.text).join(" | "),
        className: "text-foreground",
      },
    ];
  }, [baseEntries, isDesktop]);
  const hasTickerContent = entries.length > 0;
  const canJumpToVerse = normalizedVerseReference.length > 0;
  const entriesSignature = useMemo(
    () => entries.map((entry) => `${entry.key}:${entry.text}`).join("||"),
    [entries],
  );
  const tickerViewportRef = useRef<HTMLDivElement | null>(null);
  const lineMeasureRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const firstWordMeasureRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [activeEntryIndex, setActiveEntryIndex] = useState(0);
  const [tickerTranslateX, setTickerTranslateX] = useState(0);
  const [tickerTransitionMs, setTickerTransitionMs] = useState(0);

  const transitionPhaseRef = useRef<"idle" | "toPause" | "pause" | "toExit">("idle");
  const activePauseXRef = useRef(0);
  const pendingNextIndexRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<number | null>(null);
  const watchdogTimerRef = useRef<number | null>(null);
  const motionRafRef = useRef<number | null>(null);
  const viewportRafRef = useRef<number | null>(null);
  const [cycleToken, setCycleToken] = useState(0);

  const safeActiveEntryIndex =
    entries.length > 0 ? activeEntryIndex % entries.length : 0;
  const activeEntry = entries[safeActiveEntryIndex] ?? null;
  const firstWordByEntry = useMemo(
    () =>
      entries.map((entry) => {
        const [firstWord] = entry.text.split(/\s+/).filter(Boolean);
        return firstWord ?? entry.text;
      }),
    [entries],
  );

  const clearMotionTimers = useCallback(() => {
    if (typeof window === "undefined") return;
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    if (watchdogTimerRef.current !== null) {
      window.clearTimeout(watchdogTimerRef.current);
      watchdogTimerRef.current = null;
    }
    if (motionRafRef.current !== null) {
      window.cancelAnimationFrame(motionRafRef.current);
      motionRafRef.current = null;
    }
  }, []);

  const finalizeCycle = useCallback(
    (explicitNextIndex?: number | null) => {
      transitionPhaseRef.current = "idle";
      const rawNextIndex =
        typeof explicitNextIndex === "number"
          ? explicitNextIndex
          : pendingNextIndexRef.current;
      pendingNextIndexRef.current = null;
      if (rawNextIndex !== null && entries.length > 0) {
        const nextIndex = ((rawNextIndex % entries.length) + entries.length) % entries.length;
        setActiveEntryIndex(nextIndex);
        setCycleToken((value) => value + 1);
      }
    },
    [entries.length],
  );

  const schedulePauseThenExit = useCallback(() => {
    if (typeof window === "undefined") return;
    if (pauseTimerRef.current !== null) {
      window.clearTimeout(pauseTimerRef.current);
    }
    transitionPhaseRef.current = "pause";
    const runExit = () => {
      if (!activeEntry || viewportWidth <= 0) {
        transitionPhaseRef.current = "idle";
        return;
      }

      const activeWidth = lineMeasureRefs.current[safeActiveEntryIndex]?.scrollWidth ?? 0;
      if (activeWidth <= 0) {
        pauseTimerRef.current = window.setTimeout(runExit, 120);
        return;
      }
      const nextIndex =
        entries.length > 1
          ? (safeActiveEntryIndex + 1) % entries.length
          : safeActiveEntryIndex;
      pendingNextIndexRef.current = nextIndex;
      const activeExitX = -activeWidth;
      const speedPixelsPerSecond = 42;
      const activeExitDuration = Math.max(
        520,
        Math.round(
          (Math.abs(activePauseXRef.current - activeExitX) / speedPixelsPerSecond) * 1000,
        ),
      );

      transitionPhaseRef.current = "toExit";
      motionRafRef.current = window.requestAnimationFrame(() => {
        setTickerTransitionMs(activeExitDuration);
        setTickerTranslateX(activeExitX);
      });

      const watchdogMs = activeExitDuration + 220;
      watchdogTimerRef.current = window.setTimeout(() => {
        if (transitionPhaseRef.current === "toExit") {
          finalizeCycle(nextIndex);
        }
      }, watchdogMs);
    };

    const activeWidth = lineMeasureRefs.current[safeActiveEntryIndex]?.scrollWidth ?? 0;
    const pauseMs = activeWidth > viewportWidth ? 0 : 3000;
    pauseTimerRef.current = window.setTimeout(runExit, pauseMs);
  }, [activeEntry, entries.length, finalizeCycle, safeActiveEntryIndex, viewportWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const applyMatch = () => {
      setIsDesktop(desktopQuery.matches);
    };
    applyMatch();
    if (typeof desktopQuery.addEventListener === "function") {
      desktopQuery.addEventListener("change", applyMatch);
      return () => desktopQuery.removeEventListener("change", applyMatch);
    }
    desktopQuery.addListener(applyMatch);
    return () => desktopQuery.removeListener(applyMatch);
  }, []);

  useEffect(() => {
    return () => {
      clearMotionTimers();
    };
  }, [clearMotionTimers]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    clearMotionTimers();
    transitionPhaseRef.current = "idle";
    pendingNextIndexRef.current = null;

    const resetRaf = window.requestAnimationFrame(() => {
      setActiveEntryIndex(0);
      setTickerTransitionMs(0);
      setTickerTranslateX(0);
    });

    return () => window.cancelAnimationFrame(resetRaf);
  }, [clearMotionTimers, entriesSignature]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasTickerContent) {
      return;
    }
    const viewport = tickerViewportRef.current;
    if (!viewport) {
      return;
    }
    const updateViewportWidth = () => {
      setViewportWidth(viewport.clientWidth);
    };
    viewportRafRef.current = window.requestAnimationFrame(updateViewportWidth);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(updateViewportWidth);
      observer.observe(viewport);
      return () => {
        observer.disconnect();
        if (viewportRafRef.current !== null) {
          window.cancelAnimationFrame(viewportRafRef.current);
          viewportRafRef.current = null;
        }
      };
    }

    window.addEventListener("resize", updateViewportWidth);
    return () => {
      window.removeEventListener("resize", updateViewportWidth);
      if (viewportRafRef.current !== null) {
        window.cancelAnimationFrame(viewportRafRef.current);
        viewportRafRef.current = null;
      }
    };
  }, [hasTickerContent]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasTickerContent || !activeEntry || viewportWidth <= 0) {
      return;
    }

    clearMotionTimers();

    const activeWidth = lineMeasureRefs.current[safeActiveEntryIndex]?.scrollWidth ?? 0;
    if (activeWidth <= 0) {
      return;
    }
    const fitsViewportWithoutScroll = activeWidth + 24 <= viewportWidth;
    if (fitsViewportWithoutScroll) {
      const centeredX = (viewportWidth - activeWidth) / 2;
      transitionPhaseRef.current = entries.length > 1 ? "pause" : "idle";
      motionRafRef.current = window.requestAnimationFrame(() => {
        setTickerTransitionMs(0);
        setTickerTranslateX(centeredX);
      });
      if (entries.length > 1) {
        pauseTimerRef.current = window.setTimeout(() => {
          finalizeCycle((safeActiveEntryIndex + 1) % entries.length);
        }, 3000);
      }
      return;
    }

    const firstWordWidth =
      firstWordMeasureRefs.current[safeActiveEntryIndex]?.scrollWidth ?? activeWidth;
    const speedPixelsPerSecond = 42;
    const startX = viewportWidth;
    const pauseX =
      activeWidth > viewportWidth
        ? (viewportWidth - firstWordWidth) / 2
        : (viewportWidth - activeWidth) / 2;
    const toPauseDuration = Math.max(
      320,
      Math.round((Math.abs(startX - pauseX) / speedPixelsPerSecond) * 1000),
    );

    transitionPhaseRef.current = "toPause";
    activePauseXRef.current = pauseX;

    motionRafRef.current = window.requestAnimationFrame(() => {
      setTickerTransitionMs(0);
      setTickerTranslateX(startX);
      motionRafRef.current = window.requestAnimationFrame(() => {
        setTickerTransitionMs(toPauseDuration);
        setTickerTranslateX(pauseX);
      });
    });

    return () => {
      clearMotionTimers();
    };
  }, [
    activeEntry,
    clearMotionTimers,
    hasTickerContent,
    entries.length,
    finalizeCycle,
    schedulePauseThenExit,
    safeActiveEntryIndex,
    cycleToken,
    viewportWidth,
  ]);

  const handleTickerTransitionEnd = useCallback((event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    if (transitionPhaseRef.current === "toPause") {
      schedulePauseThenExit();
      return;
    }
    if (transitionPhaseRef.current === "toExit") {
      finalizeCycle();
    }
  }, [finalizeCycle, schedulePauseThenExit]);

  const handleTickerActivate = useCallback(() => {
    if (!canJumpToVerse) return;
    onJumpToVerseReference(normalizedVerseReference);
  }, [canJumpToVerse, normalizedVerseReference, onJumpToVerseReference]);

  const handleTickerKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!canJumpToVerse) return;
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      handleTickerActivate();
    },
    [canJumpToVerse, handleTickerActivate],
  );

  const combinedDesktopEntry = useMemo<TopInfoContentEntry[]>(
    () =>
      [
        normalizedVerseReference
          ? {
              key: "verse",
              text: normalizedVerseReference,
              className: "font-semibold text-foreground",
            }
          : null,
        normalizedTitle
          ? {
              key: "title",
              text: normalizedTitle,
              className: "font-semibold text-foreground",
            }
          : null,
        normalizedDescription
          ? {
              key: "description",
              text: normalizedDescription,
              className: "text-muted-foreground",
            }
          : null,
      ].filter((item): item is TopInfoContentEntry => Boolean(item)),
    [normalizedDescription, normalizedTitle, normalizedVerseReference],
  );

  return (
    <div
      className={cn(
        "relative flex min-h-9 min-w-0 items-center px-3",
        isAdmin && "pr-11",
      )}
    >
      <div aria-hidden className="pointer-events-none absolute -z-10 h-0 overflow-hidden opacity-0">
        {entries.map((entry, index) => (
          <div key={`top-info-measure-${entry.key}-${index}`} className="inline-block whitespace-nowrap">
            <span
              ref={(element) => {
                lineMeasureRefs.current[index] = element;
              }}
              className={cn("inline-block whitespace-nowrap px-1 text-sm", entry.className)}
            >
              {entry.text}
            </span>
            <span
              ref={(element) => {
                firstWordMeasureRefs.current[index] = element;
              }}
              className={cn("inline-block whitespace-nowrap px-1 text-sm", entry.className)}
            >
              {firstWordByEntry[index]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 items-center">
        {!hasTickerContent ? (
          <p className="mx-auto shrink-0 text-center text-sm text-muted-foreground">No verse set</p>
        ) : (
          <div
            ref={tickerViewportRef}
            className={cn(
              "relative h-6 min-w-0 flex-1 overflow-hidden",
              canJumpToVerse &&
                "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            )}
            onClick={handleTickerActivate}
            onKeyDown={handleTickerKeyDown}
            role={canJumpToVerse ? "button" : undefined}
            tabIndex={canJumpToVerse ? 0 : undefined}
            aria-label={canJumpToVerse ? `Open verse ${normalizedVerseReference}` : undefined}
          >
            <div
              className="absolute left-0 top-1/2"
              style={{
                transform: `translate3d(${tickerTranslateX}px, -50%, 0)`,
                transition:
                  tickerTransitionMs > 0
                    ? `transform ${tickerTransitionMs}ms linear`
                    : "none",
                willChange: "transform",
              }}
              onTransitionEnd={handleTickerTransitionEnd}
            >
              {activeEntry?.key === "combined" ? (
                <span className="inline-flex items-center whitespace-nowrap px-1 text-sm">
                  {combinedDesktopEntry.map((entry, index) => (
                    <span key={`desktop-ticker-${entry.key}-${index}`} className="inline-flex items-center">
                      {index > 0 ? (
                        <span aria-hidden className="px-2 text-muted-foreground/70">
                          |
                        </span>
                      ) : null}
                      <span className={entry.className}>{entry.text}</span>
                    </span>
                  ))}
                </span>
              ) : activeEntry ? (
                <span className={cn("inline-block whitespace-nowrap px-1 text-sm", activeEntry.className)}>
                  {activeEntry.text}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="absolute right-0 top-1/2 size-8 -translate-y-1/2 shrink-0"
          onClick={onOpenEditor}
          aria-label="Edit top info bar"
        >
          <Pencil className="size-4" />
        </Button>
      )}
    </div>
  );
}

export function Dashboard() {
  const { isLoaded, userId, getToken, signOut } = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<AppTab>("home");

  const [me, setMe] = useState<Profile | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [groupDirectory, setGroupDirectory] = useState<GroupDirectoryItem[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [groupJoinRequests, setGroupJoinRequests] = useState<GroupJoinRequest[]>(
    [],
  );
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
  const [didSetMemoryPracticeDefaultLevel, setDidSetMemoryPracticeDefaultLevel] =
    useState(false);
  const [loading, setLoading] = useState(true);
  const [homeViewMode, setHomeViewMode] = useState<"default" | "calendar">("default");
  const [homeActivityVisibleCount, setHomeActivityVisibleCount] = useState(
    HOME_ACTIVITY_PAGE_SIZE,
  );
  const [homeActivityHasMoreBelow, setHomeActivityHasMoreBelow] = useState(false);
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
  const [memberRolePendingIds, setMemberRolePendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [memberPermissionPendingIds, setMemberPermissionPendingIds] =
    useState<Set<string>>(() => new Set());
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [createGroupNameDraft, setCreateGroupNameDraft] = useState("");
  const [createGroupSubmitting, setCreateGroupSubmitting] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [groupRenameSubmitting, setGroupRenameSubmitting] = useState(false);
  const [groupRenameDialogOpen, setGroupRenameDialogOpen] = useState(false);
  const [transferLeadershipDialogOpen, setTransferLeadershipDialogOpen] =
    useState(false);
  const [transferLeadershipSubmitting, setTransferLeadershipSubmitting] =
    useState(false);
  const [nextLeaderUserId, setNextLeaderUserId] = useState("");
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [deleteGroupSubmitting, setDeleteGroupSubmitting] = useState(false);
  const [leaveGroupDialogOpen, setLeaveGroupDialogOpen] = useState(false);
  const [leaveGroupSubmitting, setLeaveGroupSubmitting] = useState(false);
  const [joinRequestSubmittingGroupIds, setJoinRequestSubmittingGroupIds] =
    useState<Set<string>>(() => new Set());
  const [joinRequestReviewPendingIds, setJoinRequestReviewPendingIds] =
    useState<Set<string>>(() => new Set());

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
  const [prayerContent, setPrayerContent] = useState("");
  const [prayerVisibility, setPrayerVisibility] = useState<PrayerVisibility>("everyone");
  const [prayerRecipientIds, setPrayerRecipientIds] = useState<string[]>([]);
  const [prayerComposerOpen, setPrayerComposerOpen] = useState(false);
  const [prayerListViewMode, setPrayerListViewMode] =
    useState<PrayerListViewMode>("my_wall");
  const [editPrayerOpen, setEditPrayerOpen] = useState(false);
  const [editingPrayerId, setEditingPrayerId] = useState<string | null>(null);
  const [editPrayerContent, setEditPrayerContent] = useState("");
  const [editPrayerVisibility, setEditPrayerVisibility] =
    useState<PrayerVisibility>("everyone");
  const [editPrayerRecipientIds, setEditPrayerRecipientIds] = useState<string[]>([]);
  const [editPrayerSaving, setEditPrayerSaving] = useState(false);
  const [readMorePrayer, setReadMorePrayer] = useState<PrayerRequest | null>(null);
  const [readMorePrayerFlipOpen, setReadMorePrayerFlipOpen] = useState(false);
  const [prayerActivityByPrayerId, setPrayerActivityByPrayerId] = useState<
    Record<string, PrayerCardActivity[]>
  >({});
  const [readMorePrayerPeekOpen, setReadMorePrayerPeekOpen] = useState(false);
  const [readMorePrayerSaving, setReadMorePrayerSaving] = useState(false);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileGender, setProfileGender] = useState<"" | UserGender>("");
  const [genderSetupSubmitting, setGenderSetupSubmitting] = useState(false);
  const [profileBirthdayMonth, setProfileBirthdayMonth] = useState("");
  const [profileBirthdayDay, setProfileBirthdayDay] = useState("");
  const [snackPendingIds, setSnackPendingIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [verseOpen, setVerseOpen] = useState(false);
  const [versePickerBook, setVersePickerBook] = useState("John");
  const [versePickerChapter, setVersePickerChapter] = useState(1);
  const [versePickerSelection, setVersePickerSelection] = useState("");
  const [versePreviewChapter, setVersePreviewChapter] =
    useState<BibleChapterResponse | null>(null);
  const [versePreviewLoading, setVersePreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chapterSwipeOffset, setChapterSwipeOffset] = useState(0);
  const chapterSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const chapterSwipeResetTimeoutRef = useRef<number | null>(null);
  const homeActivityScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (chapterSwipeResetTimeoutRef.current !== null) {
        window.clearTimeout(chapterSwipeResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setPrayerActivityByPrayerId(
      prayerRequests.reduce<Record<string, PrayerCardActivity[]>>((acc, prayer) => {
        acc[prayer.id] = Array.isArray(prayer.activity) ? prayer.activity : [];
        return acc;
      }, {}),
    );
  }, [prayerRequests]);

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

  const readStoredActiveGroupId = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    const stored = window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY)?.trim();
    return stored || null;
  }, []);

  const persistActiveGroupId = useCallback((groupId: string | null) => {
    if (typeof window === "undefined") return;
    if (groupId) {
      window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, groupId);
      return;
    }
    window.localStorage.removeItem(ACTIVE_GROUP_STORAGE_KEY);
  }, []);

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
        const chapterRes = await api.getEsvChapter(token, book, chapter);
        let highlightsRes: VerseHighlight[] = [];
        try {
          highlightsRes = await api.getVerseHighlights(token, book, chapter);
        } catch (highlightError) {
          const message =
            highlightError instanceof Error
              ? highlightError.message.toLowerCase()
              : String(highlightError).toLowerCase();
          const isGroupScopeIssue =
            message.includes("forbidden") ||
            message.includes("unauthorized") ||
            message.includes("no group");
          if (!isGroupScopeIssue) {
            throw highlightError;
          }
          highlightsRes = [];
        }

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

  const load = useCallback(async (requestedGroupId?: string | null) => {
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
      const preferredGroupId =
        requestedGroupId ?? activeGroupId ?? readStoredActiveGroupId();
      setApiActiveGroupId(preferredGroupId);

      const meRes = await api.getMe(token);
      const availableGroups = Array.isArray(meRes.groups) ? meRes.groups : [];
      const resolvedGroupId = meRes.activeGroupId ?? null;

      setApiActiveGroupId(resolvedGroupId);
      setActiveGroupId(resolvedGroupId);
      persistActiveGroupId(resolvedGroupId);
      setGroups(availableGroups);
      setMe(meRes);

      const groupDirectoryRes = await api.getGroups(token);
      setGroupDirectory(Array.isArray(groupDirectoryRes) ? groupDirectoryRes : []);

      const calendarEventsRes = await api.getCalendarEvents(token);
      setCalendarEvents(Array.isArray(calendarEventsRes) ? calendarEventsRes : []);

      if (resolvedGroupId) {
        const joinRequestsPromise =
          meRes.role === "admin"
            ? api.getGroupJoinRequests(token)
            : Promise.resolve([] as GroupJoinRequest[]);

        const [
          membersRes,
          announcementsRes,
          snackDataRes,
          topicRes,
          birthdaysRes,
          prayersRes,
          versesRes,
          joinRequestsRes,
        ] = await Promise.all([
          api.getGroupMembers(token),
          api.getAnnouncements(token),
          api.getSnackSlotsWithRemoved(token),
          api.getDiscussionTopic(token),
          api.getUpcomingBirthdays(token, 14, 3),
          api.getPrayerRequests(token),
          api.getVerseMemory(token),
          joinRequestsPromise,
        ]);

        setMembers(membersRes as Member[]);
        setAnnouncements(Array.isArray(announcementsRes) ? announcementsRes : []);
        setSnackSlots(Array.isArray(snackDataRes.slots) ? snackDataRes.slots : []);
        setRemovedSnackSlots(
          Array.isArray(snackDataRes.removedSlots) ? snackDataRes.removedSlots : [],
        );
        setDiscussionTopic(topicRes ?? null);
        setUpcomingBirthdays(Array.isArray(birthdaysRes) ? birthdaysRes : []);
        setPrayerRequests(Array.isArray(prayersRes) ? prayersRes : []);
        setVerseMemory(Array.isArray(versesRes) ? versesRes : []);
        setGroupJoinRequests(Array.isArray(joinRequestsRes) ? joinRequestsRes : []);
      } else {
        setMembers([]);
        setAnnouncements([]);
        setSnackSlots([]);
        setRemovedSnackSlots([]);
        setDiscussionTopic(null);
        setUpcomingBirthdays([]);
        setPrayerRequests([]);
        setVerseMemory([]);
        setGroupJoinRequests([]);
      }

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
    activeGroupId,
    fetchToken,
    handleSignOut,
    isLoaded,
    loadVerseReader,
    persistActiveGroupId,
    readStoredActiveGroupId,
    selectedBook,
    selectedChapter,
    userId,
  ]);

  useEffect(() => {
    if (!isLoaded) return;
    void load();
  }, [isLoaded, load]);

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
    if (activeTab !== "home") return;
    if (typeof window === "undefined") return;
    window.scrollTo(0, 0);
  }, [activeTab]);

  useEffect(() => {
    const safeDisplayName = sanitizeDisplayName(me?.displayName);
    const safeFirstName =
      sanitizeDisplayName(me?.firstName) ??
      sanitizeDisplayName(user?.firstName) ??
      "";
    const safeLastName =
      sanitizeDisplayName(me?.lastName) ??
      sanitizeDisplayName(user?.lastName) ??
      "";
    const parsedDisplayName = splitNameParts(safeDisplayName ?? "");
    const resolvedFirstName = safeFirstName || parsedDisplayName.firstName;
    const resolvedLastName = safeLastName || parsedDisplayName.lastName;
    const resolvedDisplayName = safeDisplayName ?? resolvedFirstName;

    setProfileFirstName(resolvedFirstName);
    setProfileLastName(resolvedLastName);
    setProfileDisplayName(resolvedDisplayName);

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
    me?.firstName,
    me?.lastName,
    user?.firstName,
    user?.lastName,
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

  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) ?? null,
    [activeGroupId, groups],
  );
  const hasGroupAccess = Boolean(activeGroup);
  const visibleTabs = useMemo(
    () =>
      APP_TABS.filter((tab) => (hasGroupAccess ? true : tab.key !== "prayer")),
    [hasGroupAccess],
  );
  const handleSelectTab = useCallback(
    (nextTab: AppTab) => {
      if (nextTab === activeTab) return;

      setActiveTab(nextTab);
      if (nextTab === "home") {
        setHomeViewMode("default");
      }
    },
    [activeTab],
  );
  useEffect(() => {
    if (visibleTabs.some((tab) => tab.key === activeTab)) return;
    setActiveTab("home");
  }, [activeTab, visibleTabs]);
  useEffect(() => {
    setGroupNameDraft(activeGroup?.name ?? "");
  }, [activeGroup?.id, activeGroup?.name]);
  const isAdmin = me?.role === "admin";
  const canCreateGroup =
    !createGroupSubmitting &&
    createGroupNameDraft.trim().length >= 2 &&
    createGroupNameDraft.trim().length <= 80;
  const canManageEventsAnnouncements =
    isAdmin || me?.canEditEventsAnnouncements === true;
  const leadershipCandidates = useMemo(
    () => members.filter((member) => member.id !== me?.id),
    [me?.id, members],
  );
  const selectedNextLeader = useMemo(
    () => leadershipCandidates.find((member) => member.id === nextLeaderUserId) ?? null,
    [leadershipCandidates, nextLeaderUserId],
  );
  useEffect(() => {
    if (leadershipCandidates.length === 0) {
      setNextLeaderUserId("");
      return;
    }
    if (leadershipCandidates.some((member) => member.id === nextLeaderUserId)) {
      return;
    }
    setNextLeaderUserId(leadershipCandidates[0]?.id ?? "");
  }, [leadershipCandidates, nextLeaderUserId]);
  const activeMemoryVerse = verseMemory[0] ?? null;
  const activeMemoryParsedReference = useMemo(
    () =>
      activeMemoryVerse?.verseReference
        ? parseBookAndChapterFromReference(activeMemoryVerse.verseReference)
        : null,
    [activeMemoryVerse?.verseReference],
  );
  const memberDisplayNameById = useMemo(
    () =>
      new Map(
        members.map((member) => [
          member.id,
          resolveDisplayName({
            displayName: member.displayName,
            email: member.email,
            fallback: formatMemberFullName(member),
          }),
        ]),
      ),
    [members],
  );
  const prayerRecipientMembers = useMemo(
    () => members.filter((member) => member.id !== me?.id),
    [me?.id, members],
  );
  const readMorePrayerStyle = useMemo(() => {
    if (!readMorePrayer) return PRAYER_NOTE_STYLES[0];
    const index = prayerRequests.findIndex((prayer) => prayer.id === readMorePrayer.id);
    if (index < 0) return PRAYER_NOTE_STYLES[0];
    return PRAYER_NOTE_STYLES[index % PRAYER_NOTE_STYLES.length];
  }, [prayerRequests, readMorePrayer]);
  const canEditReadMorePrayer = readMorePrayer?.authorId === me?.id;
  const readMorePrayerResolvedVisibility = useMemo<PrayerVisibility>(() => {
    if (!readMorePrayer) return "everyone";
    return readMorePrayer.visibility ?? (readMorePrayer.isPrivate ? "specific_people" : "everyone");
  }, [readMorePrayer]);
  const readMorePrayerAudienceOptions = useMemo(() => {
    if (!canEditReadMorePrayer || !readMorePrayer) return [];
    const hasGender = me?.gender === "male" || me?.gender === "female";
    const hasSpecificRecipients = (readMorePrayer.recipientIds?.length ?? 0) > 0;

    return PRAYER_VISIBILITY_OPTIONS.filter((option) => {
      if (option.value === readMorePrayerResolvedVisibility) return false;
      if (option.value === "my_gender" && !hasGender) return false;
      if (option.value === "specific_people" && !hasSpecificRecipients) return false;
      return true;
    });
  }, [canEditReadMorePrayer, me?.gender, readMorePrayer, readMorePrayerResolvedVisibility]);
  const readMorePrayerActivity = useMemo(
    () => (readMorePrayer ? prayerActivityByPrayerId[readMorePrayer.id] ?? [] : []),
    [prayerActivityByPrayerId, readMorePrayer],
  );
  const readMorePrayerPrayedByNames = useMemo(() => {
    const namesByActorId = new Map<string, string>();
    readMorePrayerActivity.forEach((activity) => {
      if (activity.type !== "prayed") return;
      if (!namesByActorId.has(activity.actorId)) {
        namesByActorId.set(activity.actorId, activity.actorName);
      }
    });
    return Array.from(namesByActorId.values());
  }, [readMorePrayerActivity]);
  const readMorePrayerCommentActivity = useMemo(
    () => readMorePrayerActivity.filter((activity) => activity.type === "comment"),
    [readMorePrayerActivity],
  );
  const readMorePrayerExpandedAudienceLabel = useMemo(() => {
    if (!readMorePrayer) return "";
    if (readMorePrayerResolvedVisibility !== "specific_people") {
      return formatPrayerVisibilityLabel(readMorePrayer);
    }
    const recipientIds = Array.isArray(readMorePrayer.recipientIds)
      ? readMorePrayer.recipientIds
      : [];
    const names = recipientIds
      .map((recipientId) => memberDisplayNameById.get(recipientId) ?? null)
      .filter((name): name is string => Boolean(name));
    const joined = joinNamesWithAmpersand(names);
    return joined || formatPrayerVisibilityLabel(readMorePrayer);
  }, [memberDisplayNameById, readMorePrayer, readMorePrayerResolvedVisibility]);
  const filteredPrayerRequests = useMemo(() => {
    if (!me?.id) return prayerRequests;
    return prayerRequests.filter((prayer) => {
      const activity = prayerActivityByPrayerId[prayer.id] ?? prayer.activity ?? [];
      const hasPrayedByMe = activity.some(
        (entry) => entry.type === "prayed" && entry.actorId === me.id,
      );
      return prayerListViewMode === "open" ? !hasPrayedByMe : hasPrayedByMe;
    });
  }, [me?.id, prayerActivityByPrayerId, prayerListViewMode, prayerRequests]);
  const hasReadMorePrayerBeenPrayedByMe = useMemo(() => {
    if (!readMorePrayer || !me?.id) return false;
    return readMorePrayerActivity.some(
      (activity) => activity.type === "prayed" && activity.actorId === me.id,
    );
  }, [me?.id, readMorePrayer, readMorePrayerActivity]);

  useEffect(() => {
    setMemoryPracticeLevel(1);
    setMemoryPracticeCompletion(EMPTY_PRACTICE_LEVEL_COMPLETION);
    setDidSetMemoryPracticeDefaultLevel(false);
  }, [activeMemoryVerse?.id]);

  useEffect(() => {
    setReadMorePrayerFlipOpen(false);
    setReadMorePrayerSaving(false);
  }, [readMorePrayer?.id]);

  const handleMemoryPracticeCompletionChange = useCallback(
    (completion: PracticeLevelCompletion, source: "reset" | "server" | "local") => {
      setMemoryPracticeCompletion(completion);
      if (source === "server" && !didSetMemoryPracticeDefaultLevel) {
        setMemoryPracticeLevel(highestAvailablePracticeLevel(completion));
        setDidSetMemoryPracticeDefaultLevel(true);
      }
    },
    [didSetMemoryPracticeDefaultLevel],
  );

  useEffect(() => {
    setPrayerRecipientIds((current) =>
      current.filter((id) =>
        prayerRecipientMembers.some((member) => member.id === id),
      ),
    );
    setEditPrayerRecipientIds((current) =>
      current.filter((id) =>
        prayerRecipientMembers.some((member) => member.id === id),
      ),
    );
  }, [prayerRecipientMembers]);

  const canAccessMemoryPracticeLevel = useCallback(
    (targetLevel: PracticeLevel): boolean => {
      if (targetLevel === 1) return true;
      if (targetLevel === 2) {
        return (
          memoryPracticeCompletion[1] ||
          memoryPracticeCompletion[2] ||
          memoryPracticeCompletion[3]
        );
      }
      return memoryPracticeCompletion[2] || memoryPracticeCompletion[3];
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
    const nowDateKey = localDateKey(now);

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
        const dateKey = addDaysToDateKey(nowDateKey, birthday.daysUntil);
        const date = new Date(`${dateKey}T12:00:00Z`);
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
        const shortDate = formatDateInTimeZone(item.date, {
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
        const date = new Date(`${slot.slotDate}T12:00:00Z`);
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
        const date = new Date(`${slot.slotDate}T12:00:00Z`);
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

  const homeActivityTimeline = useMemo<HomeActivityTimelineItem[]>(() => {
    const items: HomeActivityTimelineItem[] = [];

    announcements.forEach((announcement) => {
      const createdAt = new Date(announcement.createdAt);
      if (Number.isNaN(createdAt.getTime())) return;
      items.push({
        id: `announcement-${announcement.id}`,
        createdAt,
        summary: "Announcement posted",
        detail: truncateTimelineDetail(announcement.title),
      });
    });

    prayerRequests.forEach((prayer) => {
      const prayerCreatedAt = new Date(prayer.createdAt);
      if (!Number.isNaN(prayerCreatedAt.getTime())) {
        const authorName = firstNameOnly(prayer.authorName ?? "Someone") || "Someone";
        const audienceLabel = formatPrayerActivityAudienceLabel(
          prayer,
          me?.gender,
          memberDisplayNameById,
        );
        items.push({
          id: `prayer-request-${prayer.id}`,
          createdAt: prayerCreatedAt,
          summary: `${authorName} is requesting prayer from ${audienceLabel}`,
          detail: truncateTimelineDetail(prayer.content),
          linkedPrayerRequestId: prayer.id,
        });
      }

      const prayerActivity = prayerActivityByPrayerId[prayer.id] ?? prayer.activity ?? [];
      prayerActivity.forEach((activity) => {
        const activityCreatedAt = new Date(activity.createdAt);
        if (Number.isNaN(activityCreatedAt.getTime())) return;
        const actorName = firstNameOnly(activity.actorName) || "Someone";
        const actorDisplayName = activity.actorName.trim() || "Someone";

        if (activity.type === "comment") {
          items.push({
            id: `prayer-comment-${activity.id}`,
            createdAt: activityCreatedAt,
            summary: `${actorName} commented on a prayer request`,
            detail: truncateTimelineDetail(activity.comment),
            linkedPrayerRequestId: prayer.id,
          });
          return;
        }

        items.push({
          id: `prayer-prayed-${activity.id}`,
          createdAt: activityCreatedAt,
          summary: `${actorDisplayName} is praying`,
          detail: truncateTimelineDetail(prayer.content),
          linkedPrayerRequestId: prayer.id,
        });
      });
    });

    return items
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 20);
  }, [announcements, me?.gender, memberDisplayNameById, prayerActivityByPrayerId, prayerRequests]);

  const visibleHomeActivityTimeline = useMemo(
    () => homeActivityTimeline.slice(0, homeActivityVisibleCount),
    [homeActivityTimeline, homeActivityVisibleCount],
  );

  useEffect(() => {
    setHomeActivityVisibleCount(Math.min(HOME_ACTIVITY_PAGE_SIZE, homeActivityTimeline.length));
    const container = homeActivityScrollRef.current;
    if (container) {
      container.scrollTop = 0;
    }
  }, [homeActivityTimeline]);

  const handleHomeActivityScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const container = event.currentTarget;
      const nearBottom =
        container.scrollTop + container.clientHeight >= container.scrollHeight - 24;
      if (nearBottom && homeActivityVisibleCount < homeActivityTimeline.length) {
        setHomeActivityVisibleCount((current) =>
          Math.min(current + HOME_ACTIVITY_PAGE_SIZE, homeActivityTimeline.length),
        );
      }

      const hasMoreBelow =
        container.scrollTop + container.clientHeight < container.scrollHeight - 2;
      setHomeActivityHasMoreBelow(hasMoreBelow);
    },
    [homeActivityTimeline.length, homeActivityVisibleCount],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rafId = window.requestAnimationFrame(() => {
      const container = homeActivityScrollRef.current;
      if (!container) {
        setHomeActivityHasMoreBelow(false);
        return;
      }
      const hasMoreBelow =
        container.scrollTop + container.clientHeight < container.scrollHeight - 2;
      setHomeActivityHasMoreBelow(hasMoreBelow);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [homeActivityTimeline.length, visibleHomeActivityTimeline.length]);

  const { monthViewDays, monthViewItemsByDate, monthViewTodayKey } = useMemo(() => {
    const { year: activeYear, month: activeMonth } =
      getMonthYearInTimeZone(calendarMonthDate);
    const monthStartDateKey = buildDateKey(activeYear, activeMonth, 1);
    if (!monthStartDateKey) {
      return {
        monthViewDays: [],
        monthViewItemsByDate: new Map<string, MonthCalendarItem[]>(),
        monthViewTodayKey: localDateKey(new Date()),
      };
    }
    const firstWeekday = getWeekdayFromDateKey(monthStartDateKey);
    const monthEndDay = new Date(Date.UTC(activeYear, activeMonth, 0)).getUTCDate();
    const gridStartDateKey = addDaysToDateKey(monthStartDateKey, -firstWeekday);
    const totalCells = Math.ceil((firstWeekday + monthEndDay) / 7) * 7;
    const monthViewDays = Array.from({ length: totalCells }, (_, index) => {
      const dateKey = addDaysToDateKey(gridStartDateKey, index);
      const parts = getDatePartsFromDateKey(dateKey);
      return {
        dateKey,
        dayNumber: parts.day,
        inActiveMonth: parts.month === activeMonth,
      };
    });

    const monthViewItemsByDate = new Map<string, MonthCalendarItem[]>();
    const addItem = (dateKey: string, item: MonthCalendarItem) => {
      const key = dateKey;
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
      if (month !== activeMonth) return;
      if (day < 1 || day > monthEndDay) return;
      const dateKey = buildDateKey(activeYear, activeMonth, day);
      if (!dateKey) return;
      const fullName = resolveDisplayName({
        displayName: member.displayName,
        email: member.email,
        fallback: "Member",
      });
      const name = firstNameOnly(fullName) || "Member";
      addItem(dateKey, {
        id: `calendar-birthday-${member.id}-${activeMonth}-${day}`,
        title: `${name}'s birthday`,
        detail: "All day",
        tone: "birthday",
      });
    });

    calendarMonthSnackSlots.forEach((slot) => {
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
      addItem(slot.slotDate, {
        id: `calendar-meeting-${slot.id}`,
        title: "Small Group",
        detail: formatMonthTimeLabel("7:00 PM - 8:30 PM"),
        tone: "meeting",
        snackSlotId: slot.id,
        snackSignupNames: [...new Set(signupNames)],
      });
    });

    calendarMonthRemovedSlots.forEach((slot) => {
      addItem(slot.slotDate, {
        id: `calendar-cancelled-${slot.id}`,
        title: "No Small Group",
        detail: slot.cancellationReason?.trim() || "No small group this week",
        tone: "cancelled",
        removedSlotId: slot.id,
      });
    });

    calendarMonthEvents.forEach((event) => {
      const eventDateKey = localDateKey(new Date(event.startAt));
      addItem(eventDateKey, {
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
  const mobileVisibleMonthDayKeys = useMemo(() => {
    const activeDaysWithEvents = monthViewDays.filter((day) => {
      if (!day.inActiveMonth) return false;
      const items = monthViewItemsByDate.get(day.dateKey) ?? [];
      return items.some(
        (item) =>
          item.tone === "meeting" || item.tone === "event" || item.tone === "cancelled",
      );
    });
    const startIndex = activeDaysWithEvents.findIndex(
      (day) => day.dateKey >= monthViewTodayKey,
    );
    if (startIndex < 0) return new Set<string>();
    return new Set(activeDaysWithEvents.slice(startIndex).map((day) => day.dateKey));
  }, [monthViewDays, monthViewItemsByDate, monthViewTodayKey]);
  const hasMobileVisibleMonthDays = mobileVisibleMonthDayKeys.size > 0;

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
  const versePickerBookOption =
    BIBLE_BOOKS.find((option) => option.name === versePickerBook) ?? BIBLE_BOOKS[0];
  const versePickerChapterOptions = useMemo(
    () =>
      Array.from(
        { length: versePickerBookOption.chapters },
        (_, index) => index + 1,
      ),
    [versePickerBookOption.chapters],
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

  const openPrayerFromActivityTimeline = useCallback(
    (prayerRequestId: string) => {
      const prayer = prayerRequests.find((item) => item.id === prayerRequestId);
      if (!prayer) return;
      setReadMorePrayer(prayer);
      setReadMorePrayerFlipOpen(false);
      setReadMorePrayerPeekOpen(false);
    },
    [prayerRequests],
  );

  const openAnnouncementComposer = () => {
    if (!canManageEventsAnnouncements) return;
    setEditingAnnouncementId(null);
    setNewTitle("");
    setNewBody("");
    setAnnouncementFlipId(null);
    setAnnouncementOpen(true);
  };

  const openAnnouncementEditor = (item: Announcement) => {
    if (!canManageEventsAnnouncements) return;
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

  const openTopInfoBarEditor = () => {
    if (!isAdmin) return;
    setTopicTitle(discussionTopic?.title ?? "");
    setTopicDescription(discussionTopic?.description ?? "");
    setTopicBibleRef(discussionTopic?.bibleReference ?? "");
    setTopicOpen(true);
  };

  const handleSaveTopic = async () => {
    const token = await fetchToken();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.setDiscussionTopic(token, {
        title: topicTitle.trim(),
        description: topicDescription.trim() || undefined,
        bibleReference: topicBibleRef.trim() || undefined,
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

  const toggleEditPrayerRecipient = useCallback((memberId: string) => {
    setEditPrayerRecipientIds((current) => {
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
      setPrayerComposerOpen(false);
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

  const openPrayerEditor = useCallback(
    (prayer: PrayerRequest) => {
      if (prayer.authorId !== me?.id) return;
      const resolvedVisibility =
        prayer.visibility ?? (prayer.isPrivate ? "specific_people" : "everyone");
      setEditingPrayerId(prayer.id);
      setEditPrayerContent(prayer.content);
      setEditPrayerVisibility(resolvedVisibility);
      setEditPrayerRecipientIds(prayer.recipientIds ?? []);
      setEditPrayerOpen(true);
    },
    [me?.id],
  );

  const handleSavePrayerEdits = async () => {
    const prayerId = editingPrayerId;
    if (!prayerId) return;
    const nextContent = editPrayerContent.trim();
    if (!nextContent) {
      setError("Please enter a prayer request.");
      return;
    }
    if (
      editPrayerVisibility === "my_gender" &&
      me?.gender !== "male" &&
      me?.gender !== "female"
    ) {
      setError("Set your gender in Settings before choosing 'Gender Specific'.");
      return;
    }
    if (editPrayerVisibility === "specific_people" && editPrayerRecipientIds.length === 0) {
      setError("Pick at least one person for 'Specific People'.");
      return;
    }

    const token = await fetchToken();
    if (!token) return;

    setEditPrayerSaving(true);
    setError(null);
    try {
      const updated = (await api.updatePrayerRequest(token, prayerId, {
        content: nextContent,
        visibility: editPrayerVisibility,
        recipientIds:
          editPrayerVisibility === "specific_people" ? editPrayerRecipientIds : [],
      })) as Partial<PrayerRequest>;
      setPrayerRequests((current) =>
        current.map((item) =>
          item.id === prayerId
            ? {
                ...item,
                ...updated,
                content: nextContent,
                visibility: editPrayerVisibility,
                isPrivate: false,
                recipientIds:
                  editPrayerVisibility === "specific_people" ? editPrayerRecipientIds : [],
              }
            : item,
        ),
      );
      setReadMorePrayer((current) =>
        current && current.id === prayerId
          ? {
              ...current,
              ...updated,
              content: nextContent,
              visibility: editPrayerVisibility,
              isPrivate: false,
              recipientIds:
                editPrayerVisibility === "specific_people" ? editPrayerRecipientIds : [],
            }
          : current,
      );
      setEditPrayerOpen(false);
      setEditingPrayerId(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEditPrayerSaving(false);
    }
  };

  const openReadMorePrayer = useCallback(
    (prayer: PrayerRequest) => {
      setReadMorePrayer(prayer);
      setReadMorePrayerFlipOpen(false);
      setReadMorePrayerPeekOpen(false);
    },
    [],
  );

  const appendPrayerCardActivity = useCallback(
    (prayerId: string, entry: PrayerCardActivity) => {
      setPrayerActivityByPrayerId((current) => ({
        ...current,
        [prayerId]: prependUniquePrayerActivity(current[prayerId] ?? [], entry),
      }));
      setPrayerRequests((current) =>
        current.map((item) =>
          item.id === prayerId
            ? {
                ...item,
                activity: prependUniquePrayerActivity(item.activity ?? [], entry),
              }
            : item,
        ),
      );
      setReadMorePrayer((current) =>
        current && current.id === prayerId
          ? {
              ...current,
              activity: prependUniquePrayerActivity(current.activity ?? [], entry),
            }
          : current,
      );
    },
    [],
  );

  const removePrayerCardPrayedActivityByActor = useCallback(
    (prayer: PrayerRequest, actorId: string) => {
      const stripPrayedByActor = (
        activity: PrayerCardActivity[] | undefined,
      ): PrayerCardActivity[] =>
        (activity ?? []).filter(
          (entry) => !(entry.type === "prayed" && entry.actorId === actorId),
        );

      setPrayerActivityByPrayerId((current) => ({
        ...current,
        [prayer.id]: stripPrayedByActor(current[prayer.id] ?? prayer.activity ?? []),
      }));
      setPrayerRequests((current) =>
        current.map((item) =>
          item.id === prayer.id
            ? {
                ...item,
                activity: stripPrayedByActor(item.activity),
              }
            : item,
        ),
      );
      setReadMorePrayer((current) =>
        current && current.id === prayer.id
          ? {
              ...current,
              activity: stripPrayedByActor(current.activity),
            }
          : current,
      );
    },
    [],
  );

  const handlePrayerMarkPrayed = useCallback(
    async (prayer: PrayerRequest) => {
      if (!me?.id) return;
      const currentActivity = prayerActivityByPrayerId[prayer.id] ?? prayer.activity ?? [];
      const hasPrayedAlready = currentActivity.some(
        (activity) => activity.type === "prayed" && activity.actorId === me.id,
      );
      if (hasPrayedAlready) return;
      const token = await fetchToken();
      if (!token) return;
      setError(null);
      try {
        const created = await api.addPrayerRequestActivity(token, prayer.id, {
          type: "prayed",
        });
        appendPrayerCardActivity(prayer.id, created);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [appendPrayerCardActivity, fetchToken, me?.id, prayerActivityByPrayerId],
  );

  const handlePrayerUnmarkPrayed = useCallback(
    async (prayer: PrayerRequest) => {
      if (!me?.id) return;
      const token = await fetchToken();
      if (!token) return;
      setError(null);
      try {
        await api.removePrayerRequestPrayedActivity(token, prayer.id);
        removePrayerCardPrayedActivityByActor(prayer, me.id);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [fetchToken, me?.id, removePrayerCardPrayedActivityByActor],
  );

  const handlePrayerAddComment = useCallback(
    async (prayer: PrayerRequest) => {
      const rawComment = window.prompt("Add a comment");
      if (!rawComment) return;
      const comment = rawComment.trim();
      if (!comment) return;
      const token = await fetchToken();
      if (!token) return;
      setError(null);
      try {
        const created = await api.addPrayerRequestActivity(token, prayer.id, {
          type: "comment",
          comment,
        });
        appendPrayerCardActivity(prayer.id, created);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [appendPrayerCardActivity, fetchToken],
  );

  const handleSwitchReadMorePrayerAudience = async (
    nextVisibility: PrayerVisibility,
  ) => {
    if (!readMorePrayer) return;
    if (readMorePrayer.authorId !== me?.id) return;
    if (nextVisibility === readMorePrayerResolvedVisibility) {
      setReadMorePrayerPeekOpen(false);
      return;
    }
    if (nextVisibility === "my_gender" && me?.gender !== "male" && me?.gender !== "female") {
      setError("Set your gender in Settings before choosing 'Gender Specific'.");
      return;
    }

    const recipientIdsForSpecific = readMorePrayer.recipientIds ?? [];
    if (nextVisibility === "specific_people" && recipientIdsForSpecific.length === 0) {
      setError("No saved recipients available for 'Specific People'.");
      return;
    }

    const token = await fetchToken();
    if (!token) return;

    const prayerId = readMorePrayer.id;
    setReadMorePrayerSaving(true);
    setError(null);
    try {
      const updated = (await api.updatePrayerRequest(token, prayerId, {
        visibility: nextVisibility,
        recipientIds: nextVisibility === "specific_people" ? recipientIdsForSpecific : [],
      })) as Partial<PrayerRequest>;
      setPrayerRequests((current) =>
        current.map((item) =>
          item.id === prayerId
            ? {
                ...item,
                ...updated,
                visibility: nextVisibility,
                isPrivate: false,
                recipientIds: nextVisibility === "specific_people" ? recipientIdsForSpecific : [],
              }
            : item,
        ),
      );
      setReadMorePrayer((current) =>
        current && current.id === prayerId
          ? {
              ...current,
              ...updated,
              visibility: nextVisibility,
              isPrivate: false,
              recipientIds: nextVisibility === "specific_people" ? recipientIdsForSpecific : [],
            }
          : current,
      );
      setReadMorePrayerPeekOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReadMorePrayerSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    const token = await fetchToken();
    if (!token) return;

    const birthdayMonthText = profileBirthdayMonth.trim();
    const birthdayDayText = profileBirthdayDay.trim();
    const firstNameText = profileFirstName.trim();
    const lastNameText = profileLastName.trim();
    const displayNameText = profileDisplayName.trim();
    const safeFirstName = sanitizeDisplayName(firstNameText);
    if (firstNameText.length > 0 && !safeFirstName) {
      setError("Please enter a valid first name.");
      return;
    }

    const safeLastName = sanitizeDisplayName(lastNameText);
    if (lastNameText.length > 0 && !safeLastName) {
      setError("Please enter a valid last name.");
      return;
    }

    const displayNameCandidate = displayNameText || safeFirstName || safeLastName || "";
    const safeTypedDisplayName = sanitizeDisplayName(displayNameCandidate);
    if (displayNameCandidate.length > 0 && !safeTypedDisplayName) {
      setError("Please enter your real name, not an ID.");
      return;
    }

    let birthdayMonth: number;
    let birthdayDay: number;
    const lockedBirthdayMonth = me?.birthdayMonth;
    const lockedBirthdayDay = me?.birthdayDay;
    const hasLockedBirthday =
      typeof lockedBirthdayMonth === "number" &&
      Number.isInteger(lockedBirthdayMonth) &&
      typeof lockedBirthdayDay === "number" &&
      Number.isInteger(lockedBirthdayDay) &&
      lockedBirthdayMonth >= 1 &&
      lockedBirthdayMonth <= 12 &&
      lockedBirthdayDay >= 1 &&
      lockedBirthdayDay <=
        new Date(Date.UTC(2000, lockedBirthdayMonth, 0)).getUTCDate();
    if (hasLockedBirthday) {
      birthdayMonth = lockedBirthdayMonth;
      birthdayDay = lockedBirthdayDay;
    } else {
      const hasBirthdayMonth = birthdayMonthText.length > 0;
      const hasBirthdayDay = birthdayDayText.length > 0;
      if (!hasBirthdayMonth || !hasBirthdayDay) {
        setError("Choose your birthday to continue.");
        return;
      }

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

    const lockedGender = me?.gender === "male" || me?.gender === "female" ? me.gender : null;
    const genderForSave = lockedGender ?? (profileGender || null);
    if (!genderForSave) {
      setError("Choose your gender to continue.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await api.updateMe(token, {
        firstName: safeFirstName,
        lastName: safeLastName,
        displayName: safeTypedDisplayName,
        gender: genderForSave,
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

  const handleCompleteInitialSetup = async () => {
    const payload: {
      gender?: "male" | "female" | null;
      birthdayMonth?: number | null;
      birthdayDay?: number | null;
    } = {};

    const lockedGender = me?.gender === "male" || me?.gender === "female" ? me.gender : null;
    if (!lockedGender) {
      if (profileGender !== "male" && profileGender !== "female") {
        setError("Choose your gender to continue.");
        return;
      }
      payload.gender = profileGender;
    }

    const lockedBirthdayMonth = me?.birthdayMonth;
    const lockedBirthdayDay = me?.birthdayDay;
    const hasLockedBirthday =
      typeof lockedBirthdayMonth === "number" &&
      Number.isInteger(lockedBirthdayMonth) &&
      typeof lockedBirthdayDay === "number" &&
      Number.isInteger(lockedBirthdayDay) &&
      lockedBirthdayMonth >= 1 &&
      lockedBirthdayMonth <= 12 &&
      lockedBirthdayDay >= 1 &&
      lockedBirthdayDay <=
        new Date(Date.UTC(2000, lockedBirthdayMonth, 0)).getUTCDate();
    if (!hasLockedBirthday) {
      const birthdayMonthText = profileBirthdayMonth.trim();
      const birthdayDayText = profileBirthdayDay.trim();
      if (!birthdayMonthText || !birthdayDayText) {
        setError("Choose your birthday to continue.");
        return;
      }

      const m = Number.parseInt(birthdayMonthText, 10);
      const d = Number.parseInt(birthdayDayText, 10);
      const testDate = new Date(Date.UTC(2000, m - 1, d));
      if (testDate.getUTCMonth() !== m - 1 || testDate.getUTCDate() !== d) {
        setError("Pick a valid birthday date.");
        return;
      }

      payload.birthdayMonth = m;
      payload.birthdayDay = d;
    }

    const token = await fetchToken();
    if (!token) return;

    setGenderSetupSubmitting(true);
    setError(null);
    try {
      await api.updateMe(token, payload);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenderSetupSubmitting(false);
    }
  };

  const openVerseEditor = () => {
    if (!canManageEventsAnnouncements) return;
    const parsedReference = activeMemoryParsedReference;
    const initialBookName = parsedReference?.book ?? selectedBook;
    const initialBookOption =
      BIBLE_BOOKS.find((option) => option.name === initialBookName) ?? BIBLE_BOOKS[0];
    const safeInitialChapter = Math.min(
      Math.max(parsedReference?.chapter ?? selectedChapter, 1),
      initialBookOption.chapters,
    );

    setVersePickerBook(initialBookOption.name);
    setVersePickerChapter(safeInitialChapter);
    setVersePickerSelection(parsedReference?.verseSelection ?? "");
    setVersePreviewChapter(null);
    setVersePreviewLoading(false);
    setVerseOpen(true);
  };

  const handleSaveVerse = async () => {
    const trimmedSelection = versePickerSelection.trim();
    let verseReference = activeMemoryVerse?.verseReference?.trim() ?? "";
    if (trimmedSelection.length > 0) {
      const parsedVerseNumbers = parseVerseSelectionInput(trimmedSelection);
      if (!parsedVerseNumbers || parsedVerseNumbers.length === 0) {
        setError("Enter a valid verse selection.");
        return;
      }
      verseReference = formatVerseRangeLabel(
        versePickerBook,
        versePickerChapter,
        parsedVerseNumbers,
      );
    }
    if (!verseReference) {
      setError("Pick at least one verse number.");
      return;
    }
    const token = await fetchToken();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    try {
      const parsedReference = parseBookAndChapterFromReference(verseReference);
      let nextVerseSnippet = "";
      if (parsedReference && parsedReference.verseNumbers.length > 0) {
        const previewMatchesSelectedChapter =
          versePreviewChapter?.book === parsedReference.book &&
          versePreviewChapter?.chapter === parsedReference.chapter;
        const chapterForSnippet = previewMatchesSelectedChapter
          ? versePreviewChapter
          : await api.getEsvChapter(
              token,
              parsedReference.book,
              parsedReference.chapter,
            );
        nextVerseSnippet = buildVerseSnippetFromChapterVerses(
          chapterForSnippet.verses,
          parsedReference.verseNumbers,
        );
      }

      const response = (await api.setVerseOfMonth(token, {
        verseReference,
        verseSnippet: nextVerseSnippet || undefined,
      })) as {
        verse?: Partial<VerseMemory>;
      };
      const nowMonthYear = getMonthYearInTimeZone(new Date());
      const savedVerse = response.verse;
      const nextReference =
        typeof savedVerse?.verseReference === "string" && savedVerse.verseReference.trim()
          ? savedVerse.verseReference.trim()
          : verseReference;
      const nextSnippet =
        typeof savedVerse?.verseSnippet === "string"
          ? savedVerse.verseSnippet.trim() || null
          : nextVerseSnippet || null;
      setVerseMemory((previous) => {
        const previousVerse = previous[0] ?? null;
        const nextId =
          typeof savedVerse?.id === "string" && savedVerse.id.trim()
            ? savedVerse.id
            : previousVerse?.id ?? "";
        if (!nextId) return previous;

        const nextMonth =
          typeof savedVerse?.month === "number"
            ? savedVerse.month
            : previousVerse?.month ?? nowMonthYear.month;
        const nextYear =
          typeof savedVerse?.year === "number"
            ? savedVerse.year
            : previousVerse?.year ?? nowMonthYear.year;

        return [
          {
            id: nextId,
            verseReference: nextReference,
            verseSnippet: nextSnippet,
            month: nextMonth,
            year: nextYear,
            memorized: previousVerse?.memorized ?? false,
          },
        ];
      });
      setVerseOpen(false);
      setVersePickerSelection("");
      setVersePreviewChapter(null);
      setVersePreviewLoading(false);
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
    if (!canManageEventsAnnouncements) return;
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
    if (!canManageEventsAnnouncements) return;
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

  const handleChangeMemberRole = async (
    member: Member,
    role: "admin" | "member",
  ) => {
    if (!isAdmin) return;
    if (member.id === me?.id) return;
    if (member.role === role) return;
    const token = await fetchToken();
    if (!token) return;

    setMemberRolePendingIds((current) => {
      const next = new Set(current);
      next.add(member.id);
      return next;
    });

    setError(null);
    setNotice(null);
    try {
      await api.updateGroupMemberRole(token, member.id, role);
      setMembers((current) =>
        current.map((item) =>
          item.id === member.id ? { ...item, role } : item,
        ),
      );
      setNotice(
        role === "admin"
          ? `${member.firstName} is now a leader.`
          : `${member.firstName} is now a member.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMemberRolePendingIds((current) => {
        const next = new Set(current);
        next.delete(member.id);
        return next;
      });
    }
  };

  const handleToggleMemberContentPermission = async (
    member: Member,
    canEditEventsAnnouncements: boolean,
  ) => {
    if (!isAdmin) return;
    if (member.id === me?.id || member.role === "admin") return;
    const token = await fetchToken();
    if (!token) return;

    setMemberPermissionPendingIds((current) => {
      const next = new Set(current);
      next.add(member.id);
      return next;
    });

    setError(null);
    setNotice(null);
    try {
      await api.updateGroupMemberPermissions(
        token,
        member.id,
        canEditEventsAnnouncements,
      );
      setMembers((current) =>
        current.map((item) =>
          item.id === member.id
            ? { ...item, canEditEventsAnnouncements }
            : item,
        ),
      );
      setNotice(
        canEditEventsAnnouncements
          ? `${member.firstName} can now edit events and announcements.`
          : `${member.firstName} can no longer edit events and announcements.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMemberPermissionPendingIds((current) => {
        const next = new Set(current);
        next.delete(member.id);
        return next;
      });
    }
  };

  const handleSwitchGroup = async (groupId: string) => {
    if (isAdmin) return;
    if (!groupId || groupId === activeGroupId) return;
    setApiActiveGroupId(groupId);
    setActiveGroupId(groupId);
    persistActiveGroupId(groupId);
    setLoading(true);
    await load(groupId);
  };

  const handleAddMember = async () => {
    if (!isAdmin || !activeGroupId) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    const token = await fetchToken();
    if (!token) return;

    setInviteSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = (await api.addGroupMember(token, email)) as AddGroupMemberResult;
      setInviteEmail("");
      await load(activeGroupId);
      const memberName = resolveDisplayName({
        displayName: result.member.displayName,
        email: result.member.email,
        fallback: "Member",
      });
      setNotice(
        result.alreadyMember
          ? `${memberName} is already in this group.`
          : `${memberName} was added to ${activeGroup?.name ?? "this group"}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setInviteSubmitting(false);
    }
  };

  const handleRequestJoinGroup = async (groupId: string) => {
    if (!groupId) return;
    const token = await fetchToken();
    if (!token) return;

    setJoinRequestSubmittingGroupIds((current) => {
      const next = new Set(current);
      next.add(groupId);
      return next;
    });

    setError(null);
    setNotice(null);
    try {
      const result = await api.requestJoinGroup(token, groupId);
      await load();
      const groupName = result.group?.name ?? "that group";
      setNotice(
        result.alreadyMember
          ? `You are already a member of ${groupName}.`
          : `Request sent to join ${groupName}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoinRequestSubmittingGroupIds((current) => {
        const next = new Set(current);
        next.delete(groupId);
        return next;
      });
    }
  };

  const handleCreateGroup = async () => {
    if (activeGroup) return;
    const nextName = createGroupNameDraft.trim();
    if (nextName.length < 2 || nextName.length > 80) {
      setError("Group name must be 2 to 80 characters.");
      return;
    }

    const token = await fetchToken();
    if (!token) return;

    setCreateGroupSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.createGroup(token, nextName);
      const createdGroupId = result.group?.id ?? null;
      const createdGroupName = result.group?.name ?? nextName;
      setCreateGroupNameDraft("");

      if (createdGroupId) {
        setApiActiveGroupId(createdGroupId);
        setActiveGroupId(createdGroupId);
        persistActiveGroupId(createdGroupId);
        await load(createdGroupId);
      } else {
        await load();
      }

      setNotice(`You created ${createdGroupName} and are now the leader.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreateGroupSubmitting(false);
    }
  };

  const handleReviewJoinRequest = async (
    requestId: string,
    action: "approve" | "reject",
  ) => {
    if (!isAdmin || !activeGroupId || !requestId) return;
    const token = await fetchToken();
    if (!token) return;

    setJoinRequestReviewPendingIds((current) => {
      const next = new Set(current);
      next.add(requestId);
      return next;
    });

    setError(null);
    setNotice(null);
    try {
      await api.reviewGroupJoinRequest(token, requestId, action);
      await load(activeGroupId);
      setNotice(action === "approve" ? "Request approved." : "Request declined.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setJoinRequestReviewPendingIds((current) => {
        const next = new Set(current);
        next.delete(requestId);
        return next;
      });
    }
  };

  const handleRenameActiveGroup = async () => {
    if (!isAdmin || !activeGroup) return;
    const nextName = groupNameDraft.trim();
    if (nextName.length < 2 || nextName.length > 80) {
      setError("Group name must be 2 to 80 characters.");
      return;
    }

    const token = await fetchToken();
    if (!token) return;

    setGroupRenameSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.renameActiveGroup(token, nextName);
      await load(activeGroup.id);
      setGroupRenameDialogOpen(false);
      setNotice("Group name updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGroupRenameSubmitting(false);
    }
  };

  const openGroupRenameDialog = () => {
    if (!isAdmin || !activeGroup) return;
    setGroupNameDraft(activeGroup.name);
    setGroupRenameDialogOpen(true);
  };

  const openTransferLeadershipDialog = () => {
    if (!isAdmin || !activeGroup) return;
    if (leadershipCandidates.length === 0) {
      setError("Add at least one other member before transferring leadership.");
      return;
    }
    setTransferLeadershipDialogOpen(true);
  };

  const handleTransferLeadership = async (transition: LeadershipTransition) => {
    if (!isAdmin || !activeGroup || !nextLeaderUserId) return;
    const token = await fetchToken();
    if (!token) return;

    const currentGroupName = activeGroup.name;
    const promotedMemberName = selectedNextLeader
      ? resolveDisplayName({
          displayName: selectedNextLeader.displayName,
          email: selectedNextLeader.email,
          fallback: "Selected member",
        })
      : "Selected member";

    setTransferLeadershipSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.transferGroupLeadership(token, nextLeaderUserId, transition);
      setTransferLeadershipDialogOpen(false);
      await load();
      if (transition === "leave") {
        setNotice(
          `${promotedMemberName} is now leader. You left ${currentGroupName}.`,
        );
      } else {
        setNotice(
          `${promotedMemberName} is now leader. You are now a member.`,
        );
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTransferLeadershipSubmitting(false);
    }
  };

  const openDeleteGroupDialog = () => {
    if (!isAdmin || !activeGroup) return;
    setDeleteGroupDialogOpen(true);
  };

  const handleDeleteActiveGroup = async () => {
    if (!isAdmin || !activeGroup) return;
    const token = await fetchToken();
    if (!token) return;

    const currentGroupName = activeGroup.name;
    setDeleteGroupSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.deleteActiveGroup(token);
      setDeleteGroupDialogOpen(false);
      await load();
      setNotice(`${currentGroupName} was deleted.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleteGroupSubmitting(false);
    }
  };

  const openLeaveGroupDialog = () => {
    if (isAdmin || !activeGroup) return;
    setLeaveGroupDialogOpen(true);
  };

  const handleLeaveActiveGroup = async () => {
    if (isAdmin || !activeGroup) return;
    const token = await fetchToken();
    if (!token) return;

    const currentGroupName = activeGroup.name;
    setLeaveGroupSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      await api.leaveActiveGroup(token);
      setLeaveGroupDialogOpen(false);
      await load();
      setNotice(
        `You left ${currentGroupName}. You’ll need leader approval to join again.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeaveGroupSubmitting(false);
    }
  };

  const handleRestoreMeeting = async (slot: RemovedSnackSlot) => {
    if (!canManageEventsAnnouncements) return;
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

  const handleJumpToVerseReference = useCallback(
    (reference: string) => {
      const parsed = parseBookAndChapterFromReference(reference);
      if (!parsed) {
        setError("That verse reference format is not supported yet.");
        return;
      }

      handleSelectTab("verse");
      setSelectedBook(parsed.book);
      setSelectedChapter(parsed.chapter);
      setSelectedVerseNumbers(new Set(parsed.verseNumbers));
      void loadVerseReader(parsed.book, parsed.chapter);
    },
    [handleSelectTab, loadVerseReader],
  );

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

  const clearChapterSwipeAnimation = () => {
    if (chapterSwipeResetTimeoutRef.current !== null) {
      window.clearTimeout(chapterSwipeResetTimeoutRef.current);
      chapterSwipeResetTimeoutRef.current = null;
    }
  };

  const playChapterSwipeAnimation = (offsetPx: number) => {
    clearChapterSwipeAnimation();
    setChapterSwipeOffset(offsetPx);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setChapterSwipeOffset(0);
      });
    });
    chapterSwipeResetTimeoutRef.current = window.setTimeout(() => {
      setChapterSwipeOffset(0);
      chapterSwipeResetTimeoutRef.current = null;
    }, 240);
  };

  const handleVerseReaderTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    chapterSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleVerseReaderTouchMove = (event: TouchEvent<HTMLDivElement>) => {
    const swipeStart = chapterSwipeStartRef.current;
    if (!swipeStart) return;

    const touch = event.touches[0];
    if (!touch) return;

    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const isHorizontalDrag = Math.abs(deltaX) >= 10 && Math.abs(deltaX) > Math.abs(deltaY);
    if (isHorizontalDrag && event.cancelable) {
      event.preventDefault();
    }
  };

  const handleVerseReaderTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const swipeStart = chapterSwipeStartRef.current;
    chapterSwipeStartRef.current = null;
    if (!swipeStart) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const isHorizontalSwipe = Math.abs(deltaX) >= 64 && Math.abs(deltaX) > Math.abs(deltaY);
    if (!isHorizontalSwipe) return;

    if (deltaX < 0 && selectedChapter < selectedReaderBookOption.chapters) {
      playChapterSwipeAnimation(-18);
      handleStepChapter(1);
      return;
    }

    if (deltaX > 0 && selectedChapter > 1) {
      playChapterSwipeAnimation(18);
      handleStepChapter(-1);
    }
  };

  const handleVerseReaderTouchCancel = () => {
    chapterSwipeStartRef.current = null;
    clearChapterSwipeAnimation();
    setChapterSwipeOffset(0);
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

  const topBarVerseReference = discussionTopic?.bibleReference?.trim() ?? "";
  const topBarTopicTitle = discussionTopic?.title?.trim() ?? "";
  const topBarTopicDescription = discussionTopic?.description?.trim() ?? "";
  const shouldShowTopInfoBar = Boolean(
    activeGroup &&
      (topBarVerseReference.length > 0 ||
        topBarTopicTitle.length > 0 ||
        topBarTopicDescription.length > 0 ||
        isAdmin),
  );
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
  const genderIsLocked = me?.gender === "male" || me?.gender === "female";
  const lockedBirthdayLabel = formatBirthdayLabel(me?.birthdayMonth, me?.birthdayDay);
  const birthdayIsLocked = lockedBirthdayLabel !== "-";
  const requiresInitialProfileSetup =
    Boolean(me) && (!genderIsLocked || !birthdayIsLocked);

  const activeTabMeta = visibleTabs.find((item) => item.key === activeTab) ?? visibleTabs[0];
  const activeMobileTabIndex = Math.max(
    0,
    visibleTabs.findIndex((item) => item.key === activeTab),
  );
  const mobileTabCount = Math.max(visibleTabs.length, 1);
  const homeNow = new Date();
  const greetingDisplayName =
    sanitizeDisplayName(me?.displayName) ??
    ([
      sanitizeDisplayName(me?.firstName) ?? sanitizeDisplayName(user?.firstName) ?? "",
      sanitizeDisplayName(me?.lastName) ?? sanitizeDisplayName(user?.lastName) ?? "",
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
      "Friend");
  const greetingPrefix =
    homeNow.getHours() < 4
      ? "Go to bed"
      : homeNow.getHours() < 12
        ? "Good morning"
        : homeNow.getHours() < 18
          ? "Good afternoon"
          : "Good evening";
  const homeTodayDateParts = getDatePartsFromDateKey(getDateKeyInTimeZone(homeNow));
  const homeTodayMonthLabel = formatDateInTimeZone(homeNow, {
    month: "long",
  });
  const homeTodayMonthDayLabel = `Today is ${homeTodayMonthLabel} ${homeTodayDateParts.day}${getDayOrdinalSuffix(
    homeTodayDateParts.day,
  )}`;
  const editorParsedVerseNumbers = parseVerseSelectionInput(versePickerSelection);
  const editorPreviewTarget = (() => {
    const trimmedSelection = versePickerSelection.trim();
    if (!trimmedSelection) {
      if (!activeMemoryParsedReference || activeMemoryParsedReference.verseNumbers.length === 0) {
        return null;
      }
      return {
        book: activeMemoryParsedReference.book,
        chapter: activeMemoryParsedReference.chapter,
        verseNumbers: activeMemoryParsedReference.verseNumbers,
      };
    }
    if (!editorParsedVerseNumbers || editorParsedVerseNumbers.length === 0) {
      return null;
    }
    return {
      book: versePickerBook,
      chapter: versePickerChapter,
      verseNumbers: editorParsedVerseNumbers,
    };
  })();
  const editorPreviewTargetKey = editorPreviewTarget
    ? `${editorPreviewTarget.book} ${editorPreviewTarget.chapter}`
    : "";
  const loadedVersePreviewKey = versePreviewChapter
    ? `${versePreviewChapter.book} ${versePreviewChapter.chapter}`
    : "";
  const editorPreviewReference = (() => {
    const trimmedSelection = versePickerSelection.trim();
    if (!trimmedSelection) {
      return activeMemoryVerse?.verseReference?.trim() || "No verse selected";
    }
    if (!editorParsedVerseNumbers || editorParsedVerseNumbers.length === 0) {
      return "Enter a valid verse selection";
    }
    return formatVerseRangeLabel(
      versePickerBook,
      versePickerChapter,
      editorParsedVerseNumbers,
    );
  })();
  const editorPreviewText = (() => {
    if (!editorPreviewTarget || !versePreviewChapter) return "";
    if (loadedVersePreviewKey !== editorPreviewTargetKey) return "";
    return buildVerseSnippetFromChapterVerses(
      versePreviewChapter.verses,
      editorPreviewTarget.verseNumbers,
    );
  })();
  const canSaveMemoryVerse =
    versePickerSelection.trim().length > 0 ||
    (activeMemoryVerse?.verseReference?.trim().length ?? 0) > 0;

  useEffect(() => {
    if (!verseOpen || !editorPreviewTarget) {
      setVersePreviewLoading(false);
      return;
    }
    if (loadedVersePreviewKey === editorPreviewTargetKey) return;

    let cancelled = false;
    setVersePreviewLoading(true);
    void (async () => {
      const token = await fetchToken();
      if (!token || cancelled) {
        if (!cancelled) setVersePreviewLoading(false);
        return;
      }

      try {
        const chapter = await api.getEsvChapter(
          token,
          editorPreviewTarget.book,
          editorPreviewTarget.chapter,
        );
        if (cancelled) return;
        setVersePreviewChapter(chapter);
      } catch {
        if (!cancelled) {
          setVersePreviewChapter(null);
        }
      } finally {
        if (!cancelled) setVersePreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    editorPreviewTarget,
    editorPreviewTargetKey,
    fetchToken,
    loadedVersePreviewKey,
    verseOpen,
  ]);

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
      <aside
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:flex lg:w-72 lg:flex-col lg:bg-primary/10 lg:shadow-none"
      >
        <div className="flex h-14 items-center px-4">
          <div className="flex items-center gap-2">
            <Image src="/sglogo.png" alt="" width={28} height={28} className="rounded" />
            <p className="text-lg font-semibold">{activeGroup?.name ?? "Small Group"}</p>
          </div>
        </div>

        <nav className="flex-1 p-3">
          <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Navigate
          </p>
          <div className="space-y-1">
            {visibleTabs.map((tab) => {
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
                  onClick={() => handleSelectTab(tab.key)}
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
            onClick={() => void handleSignOut()}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col pb-[max(4.75rem,env(safe-area-inset-bottom))] lg:pb-0 lg:pl-72">
      <header
        className={cn(
          "hidden bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:block",
          activeTab === "verse" ? "relative z-30" : "sticky top-0 z-30",
        )}
      >
        <div className="relative mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          <div className="relative z-10 w-0" />

          {shouldShowTopInfoBar && (
            <div className="min-w-0 flex-1">
              <TopInfoBar
                isAdmin={isAdmin}
                verseReference={topBarVerseReference}
                topicTitle={topBarTopicTitle}
                topicDescription={topBarTopicDescription}
                onJumpToVerseReference={handleJumpToVerseReference}
                onOpenEditor={openTopInfoBarEditor}
              />
            </div>
          )}

          <div className="relative z-10 w-10 lg:w-0" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-4 py-6">
        {shouldShowTopInfoBar && (
          <div className="lg:hidden">
            <TopInfoBar
              isAdmin={isAdmin}
              verseReference={topBarVerseReference}
              topicTitle={topBarTopicTitle}
              topicDescription={topBarTopicDescription}
              onJumpToVerseReference={handleJumpToVerseReference}
              onOpenEditor={openTopInfoBarEditor}
            />
          </div>
        )}
        <div
          className={cn(
            "flex items-center justify-between gap-3",
            activeTab === "verse" &&
              "sticky top-0 z-20 -mx-4 bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70",
          )}
        >
          {activeTab === "verse" ? (
            <div className="relative min-w-0 flex-1">
              <div className="hidden items-center justify-center sm:flex">
                <div className="inline-flex min-w-0 max-w-[76vw] items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-14 min-w-0 max-w-[62vw] rounded-l-full rounded-r-none bg-muted px-6 text-3xl font-semibold hover:bg-muted active:bg-muted"
                    onClick={openBookPicker}
                    aria-label="Choose Bible book"
                  >
                    <span className="truncate text-center">{selectedBook}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-14 min-w-[5.5rem] rounded-l-none rounded-r-full bg-muted px-6 text-3xl font-semibold hover:bg-muted active:bg-muted"
                    onClick={openChapterPicker}
                    aria-label={`Choose chapter in ${selectedBook}`}
                  >
                    <span className="text-center">{selectedChapter}</span>
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-center sm:hidden">
                <div className="inline-flex min-w-0 max-w-[76vw] items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 min-w-0 max-w-[62vw] rounded-l-full rounded-r-none bg-muted px-4 text-base font-semibold hover:bg-muted active:bg-muted"
                    onClick={openBookPicker}
                    aria-label="Choose Bible book"
                  >
                    <span className="truncate">{selectedBook}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 min-w-[3.75rem] rounded-l-none rounded-r-full bg-muted px-4 text-base font-semibold hover:bg-muted active:bg-muted"
                    onClick={openChapterPicker}
                    aria-label={`Choose chapter in ${selectedBook}`}
                  >
                    <span>{selectedChapter}</span>
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-0 top-1/2 size-8 -translate-y-1/2 sm:size-9"
                onClick={() => setVerseSettingsOpen(true)}
                aria-label="Open reader settings"
              >
                <Settings className="size-5" />
              </Button>
            </div>
          ) : (
            <h2
              className={cn(
                "text-2xl font-semibold",
                activeTab === "home" && "w-full text-center text-primary sm:w-auto sm:text-left",
              )}
            >
              {activeTab === "home"
                ? `${greetingPrefix}, ${greetingDisplayName}`
                : activeTabMeta.label}
            </h2>
          )}
          {activeTab === "prayer" && hasGroupAccess && (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-semibold lowercase shadow-none hover:bg-transparent",
                  prayerListViewMode === "open" && "border-primary text-primary",
                )}
                onClick={() => setPrayerListViewMode("open")}
                aria-pressed={prayerListViewMode === "open"}
              >
                view open
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-semibold lowercase shadow-none hover:bg-transparent",
                  prayerListViewMode === "my_wall" && "border-primary text-primary",
                )}
                onClick={() => setPrayerListViewMode("my_wall")}
                aria-pressed={prayerListViewMode === "my_wall"}
              >
                my wall
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-lg border border-border bg-transparent px-4 py-2 text-sm font-semibold lowercase shadow-none hover:bg-transparent"
                onClick={() => setPrayerComposerOpen((current) => !current)}
              >
                + add request
              </Button>
            </div>
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
          !activeGroup ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Request to join a group</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {groupDirectory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No groups exist yet. Ask a leader to create a group first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {groupDirectory.map((group) => {
                      const isSubmitting = joinRequestSubmittingGroupIds.has(group.id);
                      const requestPending = group.requestStatus === "pending";
                      return (
                        <div
                          key={`home-joinable-group-${group.id}`}
                          className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-medium">{group.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {group.memberCount} members
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={requestPending ? "secondary" : "default"}
                            disabled={!group.canRequest || isSubmitting || requestPending}
                            onClick={() => void handleRequestJoinGroup(group.id)}
                          >
                            {isSubmitting ? (
                              <span
                                className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                                aria-hidden
                              />
                            ) : requestPending ? (
                              "Requested"
                            ) : (
                              "Request"
                            )}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-2 border-t border-border pt-4">
                  <Label htmlFor="create-group-name" className="text-xs text-muted-foreground">
                    Or create your own group
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="create-group-name"
                      value={createGroupNameDraft}
                      onChange={(event) => setCreateGroupNameDraft(event.target.value)}
                      placeholder="New group name"
                      maxLength={80}
                    />
                    <Button
                      type="button"
                      className="sm:w-auto"
                      disabled={!canCreateGroup}
                      onClick={() => void handleCreateGroup()}
                    >
                      {createGroupSubmitting ? (
                        <span
                          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        "Create group"
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
            {homeViewMode === "calendar" ? (
              <Card>
                <CardHeader className="space-y-3 pb-2 sm:flex sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                  <CardTitle className="text-base">
                    {formatDateInTimeZone(calendarMonthDate, {
                      month: "long",
                      year: "numeric",
                    })}
                  </CardTitle>
                  <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:grid-cols-none">
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
                  <div className="hidden grid-cols-7 gap-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:grid">
                    {WEEKDAY_SHORT_LABELS.map((weekday) => (
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
                      {!hasMobileVisibleMonthDays && (
                        <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground sm:hidden">
                          No upcoming events this month.
                        </div>
                      )}
                      {monthViewDays.map((day) => {
                        const dayKey = day.dateKey;
                        const items = monthViewItemsByDate.get(dayKey) ?? [];
                        const hasItems = items.length > 0;
                        const inActiveMonth = day.inActiveMonth;
                        const isToday = dayKey === monthViewTodayKey;
                        const showOnMobile = mobileVisibleMonthDayKeys.has(dayKey);
                        const weekdayLabel =
                          WEEKDAY_SHORT_LABELS[getWeekdayFromDateKey(dayKey)] ?? "";
                        return (
                          <div
                            key={dayKey}
                            className={cn(
                              "rounded-lg border border-border/50 bg-card p-2",
                              showOnMobile ? "block" : "hidden sm:block",
                              hasItems ? "min-h-[84px] sm:min-h-[120px]" : "min-h-[56px] sm:min-h-[120px]",
                              !inActiveMonth && "sm:opacity-45",
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p
                                className={cn(
                                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                                  isToday && "bg-primary/15 text-primary",
                                )}
                              >
                                {day.dayNumber}
                              </p>
                              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:hidden">
                                {weekdayLabel}
                              </p>
                            </div>
                            {hasItems ? (
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
                                const canLeaderCancelMeeting =
                                  canManageEventsAnnouncements && !!monthMeetingSlot;
                                const canLeaderRestoreMeeting =
                                  canManageEventsAnnouncements && !!monthRemovedSlot;
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
                            ) : (
                              <p className="mt-2 text-[11px] text-muted-foreground sm:hidden">
                                No events
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
            <Card>
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-2xl font-semibold">
                      {homeTodayMonthDayLabel}
                    </CardTitle>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-9 shrink-0 border-0 bg-transparent p-0 hover:bg-transparent"
                    onClick={openCalendarMonthView}
                    aria-label="View all calendar days"
                  >
                    <MoveDiagonal className="size-4" />
                  </Button>
                </div>
                {canManageEventsAnnouncements && (
                  <div className="flex justify-start">
                    <Button size="sm" onClick={openAnnouncementComposer}>
                      Manage
                    </Button>
                  </div>
                )}
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
                          canManageEventsAnnouncements &&
                            item.kind === "meeting" &&
                            meetingSlot,
                        );
                        const isFlipped =
                          canFlipForCancel &&
                          !!meetingSlot &&
                          meetingCancelFlipSlotId === meetingSlot.id;
                        const birthdayEmoji =
                          item.kind === "birthday" ? pickBirthdayEmoji(item.id) : null;
                        const itemDateParts = getDatePartsFromDateKey(localDateKey(item.date));
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
                                      {String(itemDateParts.day).padStart(2, "0")}
                                    </p>
                                    <p
                                      className={cn(
                                        "mt-1 text-sm font-medium",
                                        highlighted
                                          ? "text-primary-foreground/90"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {formatDateInTimeZone(item.date, {
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

                {announcements.length === 0 ? null : (
                  <div className="space-y-3">
                    {announcements.map((item) => {
                      const canFlipForDelete = canManageEventsAnnouncements;
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
                <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                  <CardTitle className="order-1 text-base sm:order-none sm:justify-self-start">
                    Memory Verse
                  </CardTitle>
                  {activeMemoryVerse ? (
                    <div className="order-3 flex w-full items-center gap-2 sm:order-none sm:w-auto sm:justify-self-center">
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
                              "min-w-0 flex-1 whitespace-nowrap sm:min-w-0 sm:flex-none",
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
                    <div className="hidden sm:block" />
                  )}
                  <div className="order-2 flex w-full items-center gap-2 sm:order-none sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-self-end sm:justify-end">
                    {canManageEventsAnnouncements && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "sm:w-auto sm:flex-none",
                          activeMemoryVerse ? "flex-1" : "w-full",
                        )}
                        onClick={openVerseEditor}
                      >
                        {activeMemoryVerse ? "Edit verse" : "Set verse"}
                      </Button>
                    )}
                    {activeMemoryVerse && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={cn(
                          "sm:w-auto sm:flex-none",
                          canManageEventsAnnouncements ? "flex-1" : "w-full",
                        )}
                        onClick={() =>
                          handleJumpToVerseReference(activeMemoryVerse.verseReference)
                        }
                      >
                        Read this chapter
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
                    onCompletedLevelsChange={handleMemoryPracticeCompletionChange}
                    showLevelSelector={false}
                  />
                )}
              </CardContent>
            </Card>

            <section className="space-y-3">
              <h3 className="text-base font-semibold">Group activity</h3>
              {homeActivityTimeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent group activity yet.</p>
              ) : (
                <div className="relative">
                  <div
                    ref={homeActivityScrollRef}
                    onScroll={handleHomeActivityScroll}
                    className={cn(
                      "max-h-[24rem] overflow-y-auto pr-1",
                      (homeActivityHasMoreBelow ||
                        homeActivityVisibleCount < homeActivityTimeline.length) &&
                        "[mask-image:linear-gradient(to_bottom,black_0%,black_84%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_bottom,black_0%,black_84%,transparent_100%)]",
                    )}
                  >
                    <ol className="space-y-4 pb-8">
                      {visibleHomeActivityTimeline.map((item, index) => {
                        const hasMore =
                          index < visibleHomeActivityTimeline.length - 1 ||
                          homeActivityVisibleCount < homeActivityTimeline.length;
                        const linkedPrayerRequestId = item.linkedPrayerRequestId;
                        return (
                          <li key={item.id} className="relative pl-6">
                            <span
                              aria-hidden
                              className="absolute left-0.5 top-1.5 size-2.5 rounded-full bg-primary/70"
                            />
                            {hasMore && (
                              <span
                                aria-hidden
                                className="absolute left-[0.58rem] top-4 h-[calc(100%+0.5rem)] w-px bg-border/60"
                              />
                            )}
                            <p className="text-sm font-medium leading-tight text-foreground">
                              {linkedPrayerRequestId ? (
                                <button
                                  type="button"
                                  className="cursor-pointer text-left underline decoration-border underline-offset-2 hover:text-primary"
                                  onClick={() => openPrayerFromActivityTimeline(linkedPrayerRequestId)}
                                >
                                  {item.summary}
                                </button>
                              ) : (
                                item.summary
                              )}
                            </p>
                            {item.detail ? (
                              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                                {item.detail}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatPrayerActivityDateTimeLabel(item.createdAt.toISOString())}
                            </p>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                </div>
              )}
            </section>
              </>
            )}
          </>
          )
        )}

        {activeTab === "prayer" && hasGroupAccess && (
          <div className="space-y-4">
            {prayerComposerOpen && (
              <Card className="border-0 bg-transparent shadow-none">
                <CardContent className="p-0">
                  <div className="space-y-4">
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
            )}

            {filteredPrayerRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {prayerListViewMode === "open"
                  ? "No open prayer requests."
                  : "No prayers on your wall yet."}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-2 sm:gap-4 md:grid-cols-3">
                {filteredPrayerRequests.map((prayer, index) => {
                  const noteStyle = PRAYER_NOTE_STYLES[index % PRAYER_NOTE_STYLES.length];
                  const noteSizing = getPrayerNoteSizing(prayer.content);
                  const notePreviewText = noteSizing.needsReadMore
                    ? getPrayerPreviewContent(prayer.content)
                    : prayer.content;
                  const myActorId = me?.id ?? null;
                  const prayerActivity = prayerActivityByPrayerId[prayer.id] ?? prayer.activity ?? [];
                  const hasPrayerBeenPrayedByMe = myActorId !== null &&
                    prayerActivity.some(
                      (activity) => activity.type === "prayed" && activity.actorId === myActorId,
                    );
                  return (
                    <article
                      key={prayer.id}
                      className={cn(
                        "relative rounded-none border border-black/10 p-4 pt-5 shadow-[0_10px_18px_rgba(107,84,40,0.22)] transition-transform duration-150 hover:rotate-0 flex flex-col cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                        noteStyle.paper,
                        noteStyle.tilt,
                      )}
                      style={{ minHeight: `${noteSizing.minHeightRem}rem` }}
                      role="button"
                      tabIndex={0}
                      onClick={() => openReadMorePrayer(prayer)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openReadMorePrayer(prayer);
                        }
                      }}
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
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeletePrayer(prayer);
                          }}
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
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pr-8 pt-3 text-xs text-muted-foreground">
                        <span>
                          {prayer.authorName ?? "Someone"} •{" "}
                          {formatPrayerVisibilityLabel(prayer)}
                        </span>
                        <span>
                          {formatPrayerDateLabel(prayer.createdAt)}{" "}
                          {formatPrayerAgeDaysLabel(prayer.createdAt)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute bottom-1 right-1 z-20 size-7 bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (hasPrayerBeenPrayedByMe) {
                            void handlePrayerUnmarkPrayed(prayer);
                            return;
                          }
                          void handlePrayerMarkPrayed(prayer);
                        }}
                        aria-label={
                          hasPrayerBeenPrayedByMe
                            ? "Send back to open requests"
                            : "Pray for this"
                        }
                        aria-pressed={hasPrayerBeenPrayedByMe}
                      >
                        {hasPrayerBeenPrayedByMe ? (
                          <Reply className="size-4" />
                        ) : (
                          <HandHeart className="size-4" />
                        )}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "verse" && (
          <>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 -left-14 z-10 hidden w-12 sm:block">
                <div className="pointer-events-auto sticky top-0 h-screen">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-full rounded-none px-0 text-3xl leading-none hover:bg-transparent"
                    onClick={() => handleStepChapter(-1)}
                    disabled={selectedChapter <= 1}
                    aria-label="Previous chapter"
                  >
                    <span aria-hidden>◀</span>
                  </Button>
                </div>
              </div>
              <Card
                className="touch-pan-y gap-4 overflow-x-hidden rounded-none bg-transparent shadow-none transition-transform duration-200 ease-out sm:rounded-xl sm:bg-card sm:shadow-sm"
                onTouchStart={handleVerseReaderTouchStart}
                onTouchMove={handleVerseReaderTouchMove}
                onTouchEnd={handleVerseReaderTouchEnd}
                onTouchCancel={handleVerseReaderTouchCancel}
                style={{ transform: `translate3d(${chapterSwipeOffset}px, 0, 0)` }}
              >
                <CardContent className="space-y-4 px-0 pt-0 sm:px-6">
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
              <div className="pointer-events-none absolute inset-y-0 -right-14 z-10 hidden w-12 sm:block">
                <div className="pointer-events-auto sticky top-0 h-screen">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-full w-full rounded-none px-0 text-3xl leading-none hover:bg-transparent"
                    onClick={() => handleStepChapter(1)}
                    disabled={selectedChapter >= selectedReaderBookOption.chapters}
                    aria-label="Next chapter"
                  >
                    <span aria-hidden>▶</span>
                  </Button>
                </div>
              </div>
            </div>

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
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="settings-first-name">First name</Label>
                        <Input
                          id="settings-first-name"
                          value={profileFirstName}
                          onChange={(event) => {
                            const nextFirstName = event.target.value;
                            setProfileFirstName(nextFirstName);
                          }}
                          placeholder="First name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="settings-last-name">Last name</Label>
                        <Input
                          id="settings-last-name"
                          value={profileLastName}
                          onChange={(event) => {
                            const nextLastName = event.target.value;
                            setProfileLastName(nextLastName);
                          }}
                          placeholder="Last name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="settings-display-name">Display name</Label>
                      <Input
                        id="settings-display-name"
                        value={profileDisplayName}
                        onChange={(event) => {
                          setProfileDisplayName(event.target.value);
                        }}
                        placeholder="Your name"
                      />
                    </div>

                    {!birthdayIsLocked ? (
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
                                    onSelect={() => {
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
                                    onSelect={() => {
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
                    ) : null}

                    {!genderIsLocked ? (
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
                    ) : null}

                    {groups.length === 0 && groupDirectory.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        No groups exist yet. Ask a leader to create a group first.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Email:</span> {me?.email ?? "-"}
                    </p>
                    <p>
                      <span className="font-medium">Role:</span>{" "}
                      {me?.role ? getRoleLabel(me.role) : "No group assigned"}
                    </p>
                    {birthdayIsLocked ? (
                      <p id="settings-birthday">
                        <span className="font-medium">Birthday:</span>{" "}
                        {lockedBirthdayLabel}
                      </p>
                    ) : null}
                    {genderIsLocked ? (
                      <p id="settings-gender">
                        <span className="font-medium">Gender:</span>{" "}
                        {selectedGenderLabel}
                      </p>
                    ) : null}
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
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base">
                  {activeGroup ? activeGroup.name : "Group"}
                </CardTitle>
                {activeGroup ? (
                  isAdmin ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={openGroupRenameDialog}
                        aria-label="Rename group"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={openTransferLeadershipDialog}
                        disabled={
                          transferLeadershipSubmitting ||
                          deleteGroupSubmitting ||
                          leadershipCandidates.length === 0
                        }
                        aria-label="Transfer leadership"
                      >
                        <Handshake className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={openDeleteGroupDialog}
                        disabled={transferLeadershipSubmitting || deleteGroupSubmitting}
                        aria-label="Delete group"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={openLeaveGroupDialog}
                      aria-label="Leave group"
                    >
                      <LogOut className="size-4" />
                    </Button>
                  )
                ) : null}
              </CardHeader>
              <CardContent>
                {isAdmin && activeGroup && groupJoinRequests.length > 0 && (
                  <div className="mb-4 space-y-2 rounded-lg border border-border/70 p-3">
                    <p className="text-sm font-medium">Pending join requests</p>
                    <div className="space-y-2">
                      {groupJoinRequests.map((request) => {
                        const pending = joinRequestReviewPendingIds.has(request.id);
                        return (
                          <div
                            key={`join-request-${request.id}`}
                            className="flex flex-col gap-2 rounded-md bg-muted/40 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="text-sm font-medium">{request.displayName}</p>
                              <p className="text-xs text-muted-foreground">
                                {request.email}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={pending}
                                onClick={() =>
                                  void handleReviewJoinRequest(request.id, "approve")
                                }
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={pending}
                                onClick={() =>
                                  void handleReviewJoinRequest(request.id, "reject")
                                }
                              >
                                Decline
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isAdmin && activeGroup && (
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row">
                    <Input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="member@email.com"
                    />
                    <Button
                      onClick={() => void handleAddMember()}
                      disabled={inviteSubmitting || !inviteEmail.trim()}
                    >
                      {inviteSubmitting ? (
                        <span
                          className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                          aria-hidden
                        />
                      ) : (
                        "Add member"
                      )}
                    </Button>
                  </div>
                )}
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {activeGroup
                      ? "No members in this group yet."
                      : "No group selected yet."}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className={cn("w-full text-sm", isAdmin ? "min-w-[900px]" : "min-w-[640px]")}>
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-2 py-2 font-medium">First name</th>
                          <th className="px-2 py-2 font-medium">Last name</th>
                          <th className="px-2 py-2 font-medium">Email</th>
                          <th className="px-2 py-2 font-medium">Birthday</th>
                          {isAdmin ? <th className="px-2 py-2 font-medium">Role</th> : null}
                          {isAdmin ? (
                            <th className="px-2 py-2 text-right font-medium">Edit access</th>
                          ) : null}
                          {isAdmin ? <th className="px-2 py-2 text-right font-medium">Action</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((member) => {
                          const memberFullName = formatMemberFullName(member);
                          const memberBirthdayLabel = formatMemberBirthday(member);
                          const parsedNameParts = splitNameParts(memberFullName);
                          const memberFirstName = member.firstName.trim() || parsedNameParts.firstName || "Member";
                          const memberLastName = member.lastName.trim() || parsedNameParts.lastName || "-";

                          return (
                            <tr key={member.id}>
                              <td className="px-2 py-3 align-middle">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{memberFirstName}</span>
                                  {member.id === me?.id ? <Badge variant="outline">You</Badge> : null}
                                </div>
                              </td>
                              <td className="px-2 py-3 align-middle">
                                <span className="font-medium">{memberLastName}</span>
                              </td>
                              <td className="px-2 py-3 align-middle text-muted-foreground">
                                {member.email}
                              </td>
                              <td className="px-2 py-3 align-middle text-muted-foreground">
                                {memberBirthdayLabel}
                              </td>
                              {isAdmin ? (
                                <td className="px-2 py-3 align-middle">
                                  {member.id !== me?.id ? (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          className={cn(
                                            badgeVariants({
                                              variant:
                                                member.role === "admin"
                                                  ? "default"
                                                  : "secondary",
                                            }),
                                            "cursor-pointer gap-1 pr-1",
                                          )}
                                          disabled={memberRolePendingIds.has(member.id)}
                                          aria-label={`Change role for ${memberFullName}`}
                                        >
                                          {getRoleLabel(member.role)}
                                          <ChevronDown
                                            className="size-3.5 opacity-70"
                                            aria-hidden
                                          />
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem
                                          disabled={member.role === "admin"}
                                          onClick={() =>
                                            void handleChangeMemberRole(member, "admin")
                                          }
                                        >
                                          Leader
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          disabled={member.role === "member"}
                                          onClick={() =>
                                            void handleChangeMemberRole(member, "member")
                                          }
                                        >
                                          Member
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  ) : (
                                    <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                                      {getRoleLabel(member.role)}
                                    </Badge>
                                  )}
                                </td>
                              ) : null}
                              {isAdmin ? (
                                <td className="px-2 py-3 text-right align-middle">
                                  {member.role === "admin" ? (
                                    <span className="text-muted-foreground">Leader has access</span>
                                  ) : (
                                    <div className="inline-flex items-center">
                                      <Switch
                                        checked={member.canEditEventsAnnouncements}
                                        onCheckedChange={(checked) =>
                                          void handleToggleMemberContentPermission(
                                            member,
                                            checked,
                                          )
                                        }
                                        disabled={
                                          memberPermissionPendingIds.has(member.id) ||
                                          memberRolePendingIds.has(member.id)
                                        }
                                        aria-label={`Toggle event and announcement editing for ${memberFullName}`}
                                      />
                                    </div>
                                  )}
                                </td>
                              ) : null}
                              {isAdmin ? (
                                <td className="px-2 py-3 text-right align-middle">
                                  {member.id !== me?.id ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      onClick={() => openRemoveMemberDialog(member)}
                                      disabled={
                                        memberRolePendingIds.has(member.id) ||
                                        memberPermissionPendingIds.has(member.id)
                                      }
                                    >
                                      Remove
                                    </Button>
                                  ) : (
                                    <span className="text-muted-foreground">-</span>
                                  )}
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

      </main>

      <footer className="bg-transparent">
        <div className="mx-auto w-full max-w-5xl px-4 py-3 text-center text-xs text-muted-foreground">
          <a
            href="https://www.esv.org"
            target="_blank"
            rel="noreferrer"
            className="bg-transparent underline"
          >
            ESV text from Crossway
          </a>
        </div>
      </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#b0cdb1] bg-[#c8e6c9] text-foreground lg:hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 bg-primary"
          style={{ height: "env(safe-area-inset-bottom)" }}
        />
        <div className="relative z-10 mx-auto flex w-full max-w-5xl items-stretch pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 bg-primary transition-transform duration-300 ease-out"
            style={{
              width: `${100 / mobileTabCount}%`,
              transform: `translateX(${activeMobileTabIndex * 100}%)`,
            }}
          />
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={`bottom-nav-${tab.key}`}
                type="button"
                className={cn(
                  "relative z-10 flex min-h-16 flex-1 flex-col items-center justify-center gap-1 px-2 text-[11px] font-semibold transition-colors duration-300",
                  isActive ? "text-primary-foreground" : "text-foreground/75",
                )}
                onClick={() => handleSelectTab(tab.key)}
                aria-current={isActive ? "page" : undefined}
                aria-label={tab.label}
              >
                <Icon className="size-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {activeTab === "verse" && selectedVerseNumbers.size > 0 && (
        <div className="fixed bottom-24 left-1/2 z-30 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl bg-background/95 p-2 shadow-lg backdrop-blur lg:bottom-4">
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

      <Dialog
        open={requiresInitialProfileSetup}
        onOpenChange={(open) => {
          if (open) return;
        }}
      >
        <DialogContent
          className="max-w-sm [&>button]:hidden"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Finish Setup</DialogTitle>
            <DialogDescription>
              This can&apos;t be changed later.
            </DialogDescription>
          </DialogHeader>
          {!birthdayIsLocked ? (
            <div className="space-y-2">
              <Label htmlFor="setup-birthday-month">Birthday</Label>
              <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      id="setup-birthday-month"
                      type="button"
                      variant="outline"
                      disabled={genderSetupSubmitting}
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
                          key={`setup-birthday-month-${month.value}`}
                          className={cn(
                            "justify-between",
                            selected && "bg-primary/10 text-primary",
                          )}
                          onSelect={() => {
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
                      id="setup-birthday-day"
                      type="button"
                      variant="outline"
                      disabled={genderSetupSubmitting || !profileBirthdayMonth}
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
                          key={`setup-birthday-day-${day}`}
                          className={cn(
                            "justify-between",
                            selected && "bg-primary/10 text-primary",
                          )}
                          onSelect={() => {
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
          ) : null}
          {!genderIsLocked ? (
            <div className="space-y-2">
              <Label>Gender</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={profileGender === "male" ? "default" : "outline"}
                  onClick={() => setProfileGender("male")}
                  disabled={genderSetupSubmitting}
                >
                  Male
                </Button>
                <Button
                  type="button"
                  variant={profileGender === "female" ? "default" : "outline"}
                  onClick={() => setProfileGender("female")}
                  disabled={genderSetupSubmitting}
                >
                  Female
                </Button>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void handleCompleteInitialSetup()}
              disabled={genderSetupSubmitting}
            >
              {genderSetupSubmitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Continue"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                {formatDateInTimeZone(
                  new Date(`${meetingToRemove.slotDate}T12:00:00Z`),
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
              This removes the member from the active group.
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

      <Dialog
        open={groupRenameDialogOpen}
        onOpenChange={(open) => {
          if (groupRenameSubmitting) return;
          setGroupRenameDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename group</DialogTitle>
            <DialogDescription>Choose a name from 2 to 80 characters.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-group-name">Group name</Label>
            <Input
              id="rename-group-name"
              value={groupNameDraft}
              onChange={(event) => setGroupNameDraft(event.target.value)}
              placeholder="Group name"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGroupRenameDialogOpen(false)}
              disabled={groupRenameSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleRenameActiveGroup()}
              disabled={
                groupRenameSubmitting ||
                !activeGroup ||
                groupNameDraft.trim().length < 2 ||
                groupNameDraft.trim() === activeGroup.name
              }
            >
              {groupRenameSubmitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Save name"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={transferLeadershipDialogOpen}
        onOpenChange={(open) => {
          if (transferLeadershipSubmitting) return;
          setTransferLeadershipDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Transfer leadership</DialogTitle>
            <DialogDescription>
              Choose who becomes leader, then decide whether you stay as a member
              or leave this group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="next-leader-user-id">New leader</Label>
            <select
              id="next-leader-user-id"
              value={nextLeaderUserId}
              onChange={(event) => setNextLeaderUserId(event.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={transferLeadershipSubmitting || leadershipCandidates.length === 0}
            >
              {leadershipCandidates.map((member) => {
                const memberName = resolveDisplayName({
                  displayName: member.displayName,
                  email: member.email,
                  fallback: "Member",
                });
                const memberRoleLabel = getRoleLabel(member.role);
                return (
                  <option key={`leadership-option-${member.id}`} value={member.id}>
                    {memberName} - {memberRoleLabel} ({member.email})
                  </option>
                );
              })}
            </select>
            {selectedNextLeader ? (
              <p className="text-xs text-muted-foreground">
                {resolveDisplayName({
                  displayName: selectedNextLeader.displayName,
                  email: selectedNextLeader.email,
                  fallback: "Selected member",
                })}{" "}
                will become the leader first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Add at least one other member before transferring leadership.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferLeadershipDialogOpen(false)}
              disabled={transferLeadershipSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleTransferLeadership("member")}
              disabled={
                transferLeadershipSubmitting || !activeGroup || !selectedNextLeader
              }
            >
              {transferLeadershipSubmitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Stay as member"
              )}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleTransferLeadership("leave")}
              disabled={
                transferLeadershipSubmitting || !activeGroup || !selectedNextLeader
              }
            >
              {transferLeadershipSubmitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Assign and leave"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteGroupDialogOpen}
        onOpenChange={(open) => {
          if (deleteGroupSubmitting) return;
          setDeleteGroupDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete group?</DialogTitle>
            <DialogDescription>
              This permanently deletes {activeGroup?.name ?? "this group"} and all
              related content.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteGroupDialogOpen(false)}
              disabled={deleteGroupSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteActiveGroup()}
              disabled={deleteGroupSubmitting || !activeGroup}
            >
              {deleteGroupSubmitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Delete group"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={leaveGroupDialogOpen}
        onOpenChange={(open) => {
          if (leaveGroupSubmitting) return;
          setLeaveGroupDialogOpen(open);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Leave group?</DialogTitle>
            <DialogDescription>
              You will lose access to this group. If you want to come back, a leader
              must approve your join request again.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLeaveGroupDialogOpen(false)}
              disabled={leaveGroupSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleLeaveActiveGroup()}
              disabled={leaveGroupSubmitting}
            >
              {leaveGroupSubmitting ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Leave group"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {canManageEventsAnnouncements && (
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
                            {formatDateInTimeZone(
                              new Date(`${slot.slotDate}T12:00:00Z`),
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )}
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
              <Label>Description</Label>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopicOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveTopic()} disabled={submitting}>
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
        open={editPrayerOpen}
        onOpenChange={(open) => {
          setEditPrayerOpen(open);
          if (!open) {
            setEditingPrayerId(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit prayer request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="edit-prayer-request-input">Create a prayer request</Label>
              <Textarea
                id="edit-prayer-request-input"
                value={editPrayerContent}
                onChange={(event) => setEditPrayerContent(event.target.value)}
                placeholder="Share what you want prayer for..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Who can see this?</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {PRAYER_VISIBILITY_OPTIONS.map((option) => {
                  const isSelected = editPrayerVisibility === option.value;
                  return (
                    <button
                      key={`edit-prayer-visibility-${option.value}`}
                      type="button"
                      onClick={() => setEditPrayerVisibility(option.value)}
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

            {editPrayerVisibility === "my_gender" &&
              me?.gender !== "male" &&
              me?.gender !== "female" && (
                <p className="text-xs text-amber-700">
                  Set your gender in Settings before using this option.
                </p>
              )}

            {editPrayerVisibility === "specific_people" && (
              <div className="space-y-2">
                <Label>Pick people</Label>
                {prayerRecipientMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No other members yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {prayerRecipientMembers.map((member) => {
                      const isSelected = editPrayerRecipientIds.includes(member.id);
                      const memberName = resolveDisplayName({
                        displayName: member.displayName,
                        email: member.email,
                        fallback: "Member",
                      });
                      return (
                        <button
                          key={`edit-prayer-member-${member.id}`}
                          type="button"
                          onClick={() => toggleEditPrayerRecipient(member.id)}
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditPrayerOpen(false);
                setEditingPrayerId(null);
              }}
              disabled={editPrayerSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSavePrayerEdits()}
              disabled={
                editPrayerSaving ||
                !editPrayerContent.trim() ||
                (editPrayerVisibility === "my_gender" &&
                  me?.gender !== "male" &&
                  me?.gender !== "female") ||
                (editPrayerVisibility === "specific_people" &&
                  editPrayerRecipientIds.length === 0)
              }
            >
              {editPrayerSaving ? (
                <span
                  className="inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              ) : (
                "Save request"
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
            setReadMorePrayerPeekOpen(false);
            setReadMorePrayerFlipOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-xl border-0 bg-transparent p-0 shadow-none [&>button]:hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Prayer request</DialogTitle>
            <DialogDescription>
              Expanded prayer request note.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mx-auto w-full max-w-[34rem] py-1 [perspective:1600px]">
            <div
              role="button"
              tabIndex={0}
              onClick={(event) => {
                const target = event.target as HTMLElement;
                if (target.closest("[data-no-flip='true']")) return;
                setReadMorePrayerPeekOpen(false);
                setReadMorePrayerFlipOpen((current) => !current);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                const target = event.target as HTMLElement;
                if (target.closest("[data-no-flip='true']")) return;
                event.preventDefault();
                setReadMorePrayerPeekOpen(false);
                setReadMorePrayerFlipOpen((current) => !current);
              }}
              className={cn(
                "relative grid cursor-pointer transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
                readMorePrayerStyle.tilt,
                readMorePrayerFlipOpen ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]",
              )}
              aria-label={readMorePrayerFlipOpen ? "Show prayer note" : "Show prayer activity"}
            >
              <div
                className={cn(
                  "relative col-start-1 row-start-1 rounded-none border border-black/10 p-5 pb-12 pt-6 shadow-[0_10px_18px_rgba(107,84,40,0.22)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
                  readMorePrayerStyle.paper,
                )}
              >
                <div
                  className={cn(
                    "absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rounded-none opacity-80 shadow-sm",
                    readMorePrayerStyle.tape,
                  )}
                  aria-hidden
                />
                {canEditReadMorePrayer && readMorePrayerPeekOpen && (
                  <div
                    data-no-flip="true"
                    onClick={(event) => event.stopPropagation()}
                    className="absolute bottom-10 right-2 z-40 w-64 bg-transparent p-0 shadow-none"
                  >
                    {readMorePrayerAudienceOptions.length === 0 ? (
                      <p className="rounded-sm bg-background/85 px-2 py-1 text-xs text-muted-foreground">
                        No other audience options.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {readMorePrayerAudienceOptions.map((option) => (
                          <button
                            key={`switch-prayer-audience-${option.value}`}
                            type="button"
                            onClick={() => void handleSwitchReadMorePrayerAudience(option.value)}
                            disabled={readMorePrayerSaving}
                            data-no-flip="true"
                            className="w-full rounded-sm border border-border bg-background/85 px-2 py-1 text-left text-xs font-semibold text-foreground transition hover:bg-accent/40 disabled:opacity-60"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {readMorePrayer?.authorName ?? "Someone"}{" "}
                    {readMorePrayer ? `• ${readMorePrayerExpandedAudienceLabel}` : ""}
                  </span>
                  <span>
                    {readMorePrayer
                      ? `${formatPrayerDateLabel(readMorePrayer.createdAt)} ${formatPrayerAgeDaysLabel(readMorePrayer.createdAt)}`
                      : ""}
                  </span>
                </div>
                <div className="max-h-[56vh] overflow-y-auto pr-1">
                  <p
                    className="whitespace-pre-wrap text-[1.5rem] leading-relaxed text-foreground"
                    style={{ fontFamily: "var(--font-handwriting)" }}
                  >
                    {readMorePrayer?.content ?? ""}
                  </p>
                </div>
                {canEditReadMorePrayer && readMorePrayer && (
                  <div
                    data-no-flip="true"
                    className="absolute bottom-1 left-1 z-20"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      data-no-flip="true"
                      className="size-8 bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                      onClick={(event) => {
                        event.stopPropagation();
                        openPrayerEditor(readMorePrayer);
                      }}
                      aria-label="Edit prayer request"
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                )}
                <div
                  data-no-flip="true"
                  className="absolute bottom-1 right-1 z-20 flex items-center gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    data-no-flip="true"
                    className="size-8 bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!readMorePrayer) return;
                      if (hasReadMorePrayerBeenPrayedByMe) {
                        void handlePrayerUnmarkPrayed(readMorePrayer);
                        return;
                      }
                      void handlePrayerMarkPrayed(readMorePrayer);
                    }}
                    aria-label={
                      hasReadMorePrayerBeenPrayedByMe
                        ? "Send back to open requests"
                        : "Pray for this"
                    }
                    aria-pressed={hasReadMorePrayerBeenPrayedByMe}
                  >
                    {hasReadMorePrayerBeenPrayedByMe ? (
                      <Reply className="size-4" />
                    ) : (
                      <HandHeart className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    data-no-flip="true"
                    className="size-8 bg-transparent text-muted-foreground hover:bg-transparent hover:text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      if (!readMorePrayer) return;
                      void handlePrayerAddComment(readMorePrayer);
                    }}
                    aria-label="Add a comment"
                  >
                    <MessageCircle className="size-4" />
                  </Button>
                </div>
              </div>
              <div
                className={cn(
                  "col-start-1 row-start-1 rounded-none border border-black/10 p-5 pt-6 shadow-[0_10px_18px_rgba(107,84,40,0.22)] [transform:rotateY(180deg)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden]",
                  readMorePrayerStyle.paper,
                )}
              >
                <div
                  className={cn(
                    "absolute -top-3 left-1/2 h-6 w-24 -translate-x-1/2 rounded-none opacity-80 shadow-sm",
                    readMorePrayerStyle.tape,
                  )}
                  aria-hidden
                />
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {readMorePrayer?.authorName ?? "Someone"}{" "}
                    {readMorePrayer ? `• ${readMorePrayerExpandedAudienceLabel}` : ""}
                  </span>
                  <span>
                    {readMorePrayer
                      ? `${formatPrayerDateLabel(readMorePrayer.createdAt)} ${formatPrayerAgeDaysLabel(readMorePrayer.createdAt)}`
                      : ""}
                  </span>
                </div>
                {readMorePrayerPrayedByNames.length > 0 && (
                  <div className="mb-3 space-y-2">
                    <p className="text-xs font-semibold text-foreground/80">
                      These people are praying for this
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {readMorePrayerPrayedByNames.map((name, index) => (
                        <span
                          key={`prayed-by-${name}-${index}`}
                          className={cn(
                            "inline-flex rounded-none border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-foreground shadow-sm",
                            readMorePrayerStyle.tape,
                            index % 2 === 0 ? "-rotate-1" : "rotate-1",
                          )}
                        >
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {readMorePrayerCommentActivity.length > 0 && (
                  <div className="max-h-[44vh] space-y-2 overflow-y-auto pr-1">
                    {readMorePrayerCommentActivity.slice(0, 20).map((activity) => (
                      <div key={activity.id} className="space-y-0.5">
                        <p className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {activity.actorName}
                          </span>{" "}
                          {formatPrayerActivityDateTimeLabel(activity.createdAt)}
                        </p>
                        {activity.comment ? (
                          <p className="whitespace-pre-wrap text-xs text-foreground/90">
                            {activity.comment}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={verseOpen}
        onOpenChange={(open) => {
          setVerseOpen(open);
          if (!open) {
            setVersePickerSelection("");
            setVersePreviewChapter(null);
            setVersePreviewLoading(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Memory verse</DialogTitle>
            <DialogDescription>
              This updates both memory practice and the top bar verse.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Book</Label>
                <select
                  value={versePickerBook}
                  onChange={(event) => {
                    const nextBook =
                      BIBLE_BOOKS.find((option) => option.name === event.target.value) ??
                      BIBLE_BOOKS[0];
                    setVersePickerBook(nextBook.name);
                    setVersePickerChapter((current) =>
                      Math.min(Math.max(current, 1), nextBook.chapters),
                    );
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {BIBLE_BOOKS.map((option) => (
                    <option key={`verse-editor-book-${option.name}`} value={option.name}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Chapter</Label>
                <select
                  value={versePickerChapter}
                  onChange={(event) =>
                    setVersePickerChapter(Number.parseInt(event.target.value, 10) || 1)
                  }
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {versePickerChapterOptions.map((chapter) => (
                    <option
                      key={`verse-editor-chapter-${versePickerBookOption.name}-${chapter}`}
                      value={chapter}
                    >
                      {chapter}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Verse(s)</Label>
              <Input
                value={versePickerSelection}
                onChange={(event) => setVersePickerSelection(event.target.value)}
                placeholder="e.g. 16 or 16-18,20"
              />
              <p className="text-xs text-muted-foreground">
                Multi-verse supported: use commas and ranges (example: 4,6-8).
              </p>
              <p className="text-xs text-muted-foreground">
                Leave blank to keep the current verse.
              </p>
            </div>
            <p className="text-xs">
              <span className="text-muted-foreground">Preview: </span>
              <span className="font-medium text-foreground">
                {editorPreviewReference || "No verse selected"}
              </span>
            </p>
            <p
              className={cn(
                "text-sm leading-relaxed",
                editorPreviewText ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {versePreviewLoading
                ? "Loading verse text..."
                : editorPreviewText || "Verse text will appear here."}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setVerseOpen(false);
                setVersePickerSelection("");
                setVersePreviewChapter(null);
                setVersePreviewLoading(false);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveVerse()}
              disabled={submitting || !canSaveMemoryVerse}
            >
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
