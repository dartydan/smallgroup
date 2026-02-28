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
export const prayerRequestActivityTypeEnum = pgEnum(
  "prayer_request_activity_type",
  ["prayed", "comment"],
);
export const groupJoinRequestStatusEnum = pgEnum("group_join_request_status", [
  "pending",
  "approved",
  "rejected",
]);
export const featureBoardStatusEnum = pgEnum("feature_board_status", [
  "suggested",
  "planned",
  "in_progress",
  "done",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  authId: text("auth_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  isDeveloper: boolean("is_developer").notNull().default(false),
  gender: genderEnum("gender"),
  birthdayMonth: integer("birthday_month"),
  birthdayDay: integer("birthday_day"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const featureBoardCards = pgTable(
  "feature_board_cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description"),
    status: featureBoardStatusEnum("status").notNull().default("suggested"),
    sortOrder: integer("sort_order").notNull().default(0),
    suggestedByUserId: uuid("suggested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    suggestedByName: text("suggested_by_name").notNull(),
    suggestedByEmail: text("suggested_by_email").notNull(),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedToName: text("assigned_to_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    statusSortOrderIdx: index("feature_board_cards_status_sort_order_idx").on(
      table.status,
      table.sortOrder,
      table.createdAt,
    ),
  }),
);

export const featureBoardVotes = pgTable(
  "feature_board_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => featureBoardCards.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    cardUserUnique: uniqueIndex("feature_board_votes_card_user_unique").on(
      table.cardId,
      table.userId,
    ),
    cardCreatedIdx: index("feature_board_votes_card_created_idx").on(
      table.cardId,
      table.createdAt,
    ),
    userCreatedIdx: index("feature_board_votes_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  }),
);

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
    userJoinedIdx: index("group_members_user_joined_idx").on(
      table.userId,
      table.joinedAt,
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

export const genderChangeRequests = pgTable(
  "gender_change_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    currentGender: genderEnum("current_gender").notNull(),
    requestedGender: genderEnum("requested_gender").notNull(),
    status: groupJoinRequestStatusEnum("status").notNull().default("pending"),
    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    groupStatusIdx: index("gender_change_requests_group_status_idx").on(
      table.groupId,
      table.status,
      table.createdAt,
    ),
    userStatusIdx: index("gender_change_requests_user_status_idx").on(
      table.userId,
      table.status,
      table.createdAt,
    ),
  }),
);

export const announcements = pgTable(
  "announcements",
  {
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
  },
  (table) => ({
    groupCreatedIdx: index("announcements_group_created_idx").on(
      table.groupId,
      table.createdAt,
    ),
  }),
);

export const snackSlots = pgTable(
  "snack_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    slotDate: date("slot_date").notNull(),
    isCancelled: boolean("is_cancelled").notNull().default(false),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupDateCancelledIdx: index("snack_slots_group_date_cancelled_idx").on(
      table.groupId,
      table.slotDate,
      table.isCancelled,
    ),
  }),
);

export const snackSignups = pgTable(
  "snack_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => snackSlots.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    slotCreatedIdx: index("snack_signups_slot_created_idx").on(
      table.slotId,
      table.createdAt,
    ),
  }),
);

export const discussionTopics = pgTable(
  "discussion_topics",
  {
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
  },
  (table) => ({
    groupYearMonthIdx: index("discussion_topics_group_year_month_idx").on(
      table.groupId,
      table.year,
      table.month,
    ),
  }),
);

export const prayerRequests = pgTable(
  "prayer_requests",
  {
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
  },
  (table) => ({
    groupCreatedIdx: index("prayer_requests_group_created_idx").on(
      table.groupId,
      table.createdAt,
    ),
  }),
);

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

export const prayerRequestActivity = pgTable(
  "prayer_request_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    prayerRequestId: uuid("prayer_request_id")
      .notNull()
      .references(() => prayerRequests.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activityType: prayerRequestActivityTypeEnum("activity_type").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    prayerRequestCreatedIdx: index(
      "prayer_request_activity_prayer_id_created_idx",
    ).on(table.prayerRequestId, table.createdAt),
    groupCreatedIdx: index("prayer_request_activity_group_created_idx").on(
      table.groupId,
      table.createdAt,
    ),
  }),
);

export const verseMemory = pgTable(
  "verse_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    verseReference: text("verse_reference").notNull(),
    verseSnippet: text("verse_snippet"),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    groupYearMonthIdx: index("verse_memory_group_year_month_idx").on(
      table.groupId,
      table.year,
      table.month,
    ),
  }),
);

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
  featureBoardSuggestions: many(featureBoardCards),
  featureBoardVotes: many(featureBoardVotes),
  groupJoinRequests: many(groupJoinRequests, {
    relationName: "group_join_request_user",
  }),
  reviewedGroupJoinRequests: many(groupJoinRequests, {
    relationName: "group_join_request_reviewer",
  }),
  genderChangeRequests: many(genderChangeRequests, {
    relationName: "gender_change_request_user",
  }),
  reviewedGenderChangeRequests: many(genderChangeRequests, {
    relationName: "gender_change_request_reviewer",
  }),
  announcements: many(announcements),
  snackSignups: many(snackSignups),
  prayerRequests: many(prayerRequests),
  prayerRequestRecipients: many(prayerRequestRecipients),
  prayerRequestActivities: many(prayerRequestActivity),
  verseMemoryProgress: many(verseMemoryProgress),
  versePracticeCompletions: many(versePracticeCompletions),
  verseHighlights: many(verseHighlights),
}));

export const groupsRelations = relations(groups, ({ many }) => ({
  groupMembers: many(groupMembers),
  groupJoinRequests: many(groupJoinRequests),
  genderChangeRequests: many(genderChangeRequests),
  announcements: many(announcements),
  snackSlots: many(snackSlots),
  discussionTopics: many(discussionTopics),
  prayerRequests: many(prayerRequests),
  prayerRequestActivities: many(prayerRequestActivity),
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

export const genderChangeRequestsRelations = relations(
  genderChangeRequests,
  ({ one }) => ({
    group: one(groups, {
      fields: [genderChangeRequests.groupId],
      references: [groups.id],
    }),
    user: one(users, {
      relationName: "gender_change_request_user",
      fields: [genderChangeRequests.userId],
      references: [users.id],
    }),
    reviewedBy: one(users, {
      relationName: "gender_change_request_reviewer",
      fields: [genderChangeRequests.reviewedByUserId],
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
    activity: many(prayerRequestActivity),
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

export const prayerRequestActivityRelations = relations(
  prayerRequestActivity,
  ({ one }) => ({
    group: one(groups, {
      fields: [prayerRequestActivity.groupId],
      references: [groups.id],
    }),
    prayerRequest: one(prayerRequests, {
      fields: [prayerRequestActivity.prayerRequestId],
      references: [prayerRequests.id],
    }),
    actor: one(users, {
      fields: [prayerRequestActivity.actorId],
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

export const featureBoardCardsRelations = relations(
  featureBoardCards,
  ({ one, many }) => ({
    suggestedBy: one(users, {
      fields: [featureBoardCards.suggestedByUserId],
      references: [users.id],
    }),
    assignedTo: one(users, {
      fields: [featureBoardCards.assignedToUserId],
      references: [users.id],
    }),
    votes: many(featureBoardVotes),
  }),
);

export const featureBoardVotesRelations = relations(
  featureBoardVotes,
  ({ one }) => ({
    card: one(featureBoardCards, {
      fields: [featureBoardVotes.cardId],
      references: [featureBoardCards.id],
    }),
    user: one(users, {
      fields: [featureBoardVotes.userId],
      references: [users.id],
    }),
  }),
);
