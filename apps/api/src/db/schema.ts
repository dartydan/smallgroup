import {
  pgTable,
  text,
  timestamp,
  uuid,
  date,
  integer,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const roleEnum = pgEnum("role", ["admin", "member"]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
export const prayerVisibilityEnum = pgEnum("prayer_visibility", [
  "everyone",
  "my_gender",
  "specific_people",
]);
export const groupJoinRequestStatusEnum = pgEnum("group_join_request_status", [
  "pending",
  "approved",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  gender: genderEnum("gender"),
  birthdayMonth: integer("birthday_month"),
  birthdayDay: integer("birthday_day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const groups = pgTable("groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const groupMembers = pgTable(
  "group_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("member"),
    canEditEventsAnnouncements: boolean("can_edit_events_announcements")
      .notNull()
      .default(false),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    groupUserUnique: uniqueIndex("group_members_group_user_unique").on(
      table.groupId,
      table.userId,
    ),
  }),
);

export const groupJoinRequests = pgTable(
  "group_join_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: groupJoinRequestStatusEnum("status").notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupUserUnique: uniqueIndex("group_join_requests_group_user_unique").on(
      table.groupId,
      table.userId,
    ),
    groupStatusIdx: index("group_join_requests_group_status_idx").on(
      table.groupId,
      table.status,
      table.createdAt,
    ),
    userStatusIdx: index("group_join_requests_user_status_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
  }),
);

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const snackSlots = pgTable("snack_slots", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  slotDate: date("slot_date").notNull(),
  isCancelled: boolean("is_cancelled").notNull().default(false),
  cancellationReason: text("cancellation_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const snackSignups = pgTable("snack_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  slotId: uuid("slot_id")
    .notNull()
    .references(() => snackSlots.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const discussionTopics = pgTable("discussion_topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  bibleReference: text("bible_reference"),
  bibleText: text("bible_text"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const prayerRequests = pgTable("prayer_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  authorId: uuid("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  visibility: prayerVisibilityEnum("visibility").notNull().default("everyone"),
  isPrivate: boolean("is_private").default(false),
  prayed: boolean("prayed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const prayerRequestRecipients = pgTable(
  "prayer_request_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    prayerRequestId: uuid("prayer_request_id")
      .notNull()
      .references(() => prayerRequests.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    prayerUserUnique: uniqueIndex(
      "prayer_request_recipients_prayer_user_unique",
    ).on(table.prayerRequestId, table.userId),
    prayerRequestIdx: index("prayer_request_recipients_prayer_id_idx").on(
      table.prayerRequestId,
    ),
  }),
);

export const verseMemory = pgTable("verse_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  verseReference: text("verse_reference").notNull(),
  verseSnippet: text("verse_snippet"),
  month: integer("month").notNull(),
  year: integer("year").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const verseMemoryProgress = pgTable("verse_memory_progress", {
  id: uuid("id").primaryKey().defaultRandom(),
  verseId: uuid("verse_id")
    .notNull()
    .references(() => verseMemory.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  memorized: boolean("memorized").default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const versePracticeCompletions = pgTable(
  "verse_practice_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    verseId: uuid("verse_id")
      .notNull()
      .references(() => verseMemory.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (table) => ({
    verseUserLevelUnique: uniqueIndex(
      "verse_practice_completions_verse_user_level_unique",
    ).on(table.verseId, table.userId, table.level),
    verseLevelCompletedIdx: index(
      "verse_practice_completions_verse_level_completed_idx",
    ).on(table.verseId, table.level, table.completedAt),
  }),
);

export const verseHighlights = pgTable(
  "verse_highlights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    book: text("book").notNull(),
    chapter: integer("chapter").notNull(),
    verseNumber: integer("verse_number").notNull(),
    verseReference: text("verse_reference").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupUserVerseUnique: uniqueIndex(
      "verse_highlights_group_user_verse_unique",
    ).on(
      table.groupId,
      table.userId,
      table.book,
      table.chapter,
      table.verseNumber,
    ),
    chapterFeedIdx: index("verse_highlights_group_book_chapter_created_idx").on(
      table.groupId,
      table.book,
      table.chapter,
      table.createdAt,
    ),
  }),
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  groupMembers: many(groupMembers),
  groupJoinRequests: many(groupJoinRequests, {
    relationName: "group_join_request_user",
  }),
  reviewedGroupJoinRequests: many(groupJoinRequests, {
    relationName: "group_join_request_reviewer",
  }),
  announcements: many(announcements),
  snackSignups: many(snackSignups),
  prayerRequests: many(prayerRequests),
  prayerRequestRecipients: many(prayerRequestRecipients),
  verseMemoryProgress: many(verseMemoryProgress),
  versePracticeCompletions: many(versePracticeCompletions),
  verseHighlights: many(verseHighlights),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  groupMembers: many(groupMembers),
  groupJoinRequests: many(groupJoinRequests),
  announcements: many(announcements),
  snackSlots: many(snackSlots),
  discussionTopics: many(discussionTopics),
  prayerRequests: many(prayerRequests),
  verseMemory: many(verseMemory),
  verseHighlights: many(verseHighlights),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groups),
  user: one(users),
}));

export const groupJoinRequestsRelations = relations(
  groupJoinRequests,
  ({ one }) => ({
    group: one(groups, {
      fields: [groupJoinRequests.groupId],
      references: [groups.id],
    }),
    user: one(users, {
      relationName: "group_join_request_user",
      fields: [groupJoinRequests.userId],
      references: [users.id],
    }),
    reviewedBy: one(users, {
      relationName: "group_join_request_reviewer",
      fields: [groupJoinRequests.reviewedByUserId],
      references: [users.id],
    }),
  }),
);

export const announcementsRelations = relations(announcements, ({ one }) => ({
  group: one(groups),
  author: one(users),
}));

export const snackSlotsRelations = relations(snackSlots, ({ one, many }) => ({
  group: one(groups),
  signups: many(snackSignups),
}));

export const snackSignupsRelations = relations(snackSignups, ({ one }) => ({
  slot: one(snackSlots),
  user: one(users),
}));

export const discussionTopicsRelations = relations(
  discussionTopics,
  ({ one }) => ({
    group: one(groups),
  }),
);

export const prayerRequestsRelations = relations(
  prayerRequests,
  ({ one, many }) => ({
    group: one(groups),
    author: one(users),
    recipients: many(prayerRequestRecipients),
  }),
);

export const prayerRequestRecipientsRelations = relations(
  prayerRequestRecipients,
  ({ one }) => ({
    prayerRequest: one(prayerRequests, {
      fields: [prayerRequestRecipients.prayerRequestId],
      references: [prayerRequests.id],
    }),
    user: one(users, {
      fields: [prayerRequestRecipients.userId],
      references: [users.id],
    }),
  }),
);

export const verseMemoryRelations = relations(verseMemory, ({ one, many }) => ({
  group: one(groups),
  progress: many(verseMemoryProgress),
  practiceCompletions: many(versePracticeCompletions),
}));

export const verseMemoryProgressRelations = relations(
  verseMemoryProgress,
  ({ one }) => ({
    verse: one(verseMemory),
    user: one(users),
  }),
);

export const versePracticeCompletionsRelations = relations(
  versePracticeCompletions,
  ({ one }) => ({
    verse: one(verseMemory),
    user: one(users),
  }),
);

export const verseHighlightsRelations = relations(
  verseHighlights,
  ({ one }) => ({
    group: one(groups),
    user: one(users),
  }),
);
