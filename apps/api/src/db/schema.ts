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

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
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

export const groupMembers = pgTable("group_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: roleEnum("role").notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

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
  isPrivate: boolean("is_private").default(false),
  prayed: boolean("prayed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  announcements: many(announcements),
  snackSignups: many(snackSignups),
  prayerRequests: many(prayerRequests),
  verseMemoryProgress: many(verseMemoryProgress),
  verseHighlights: many(verseHighlights),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  groupMembers: many(groupMembers),
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

export const prayerRequestsRelations = relations(prayerRequests, ({ one }) => ({
  group: one(groups),
  author: one(users),
}));

export const verseMemoryRelations = relations(verseMemory, ({ one, many }) => ({
  group: one(groups),
  progress: many(verseMemoryProgress),
}));

export const verseMemoryProgressRelations = relations(
  verseMemoryProgress,
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
