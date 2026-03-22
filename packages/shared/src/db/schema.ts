import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Enums (as string literals for PostgreSQL)
// ============================================

export const MemberStatus = {
  PENDING_APPROVAL: 'pending_approval',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DORMANT: 'dormant',
  OB: 'ob',
  WITHDRAWN: 'withdrawn',
} as const;

export type MemberStatusType = (typeof MemberStatus)[keyof typeof MemberStatus];

export const AttendanceStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  LATE: 'LATE',
  ABSENT: 'ABSENT',
} as const;

export type AttendanceStatusType = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const FineType = {
  LATE: 'late',
  ABSENT: 'absent',
} as const;

export type FineTypeValue = (typeof FineType)[keyof typeof FineType];

export const FineStatus = {
  UNPAID: 'PENDING',
  PAID: 'PAID',
  WAIVED: 'WAIVED',
} as const;

export type FineStatusType = (typeof FineStatus)[keyof typeof FineStatus];

export const CurationCategory = {
  CONFERENCE: 'conference',
  ARTICLE: 'article',
} as const;

export type CurationCategoryType = (typeof CurationCategory)[keyof typeof CurationCategory];

export const ActivityScoreType = {
  BLOG_POST: 'blog_post',
  BOARD_POST: 'board_post',
  POST_COMMENT: 'post_comment',
  BOARD_COMMENT: 'board_comment',
  ADMIN_MANUAL: 'admin_manual',
  POST_VIEW: 'post_view',
} as const;

export type ActivityScoreTypeValue = (typeof ActivityScoreType)[keyof typeof ActivityScoreType];

// ============================================
// Tables
// ============================================

/**
 * 스터디 참가자 (Members)
 * Discord 사용자가 스터디에 참가 등록하면 생성됨
 */
export const members = pgTable(
  'members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    discordId: varchar('discord_id', { length: 20 }).notNull().unique(),
    discordUsername: varchar('discord_username', { length: 100 }).notNull(),
    name: varchar('name', { length: 50 }).notNull(),
    nickname: varchar('nickname', { length: 100 }).notNull(),
    part: varchar('part', { length: 50 }).notNull(),
    blogUrl: varchar('blog_url', { length: 2000 }).notNull(),
    rssUrl: varchar('rss_url', { length: 2000 }),
    // 프로필 정보 (온보딩)
    profileImageUrl: varchar('profile_image_url', { length: 2000 }),
    bio: varchar('bio', { length: 200 }),
    interests: text('interests').array(),
    resolution: varchar('resolution', { length: 300 }),
    onboardingCompleted: boolean('onboarding_completed').default(false),
    rssConsent: boolean('rss_consent').default(true),
    // 소셜 링크
    githubUrl: varchar('github_url', { length: 2000 }),
    linkedinUrl: varchar('linkedin_url', { length: 2000 }),
    instagramUrl: varchar('instagram_url', { length: 2000 }),
    // 상태 관리
    status: varchar('status', { length: 20 }).notNull().default(MemberStatus.ACTIVE),
    dormantStartRound: integer('dormant_start_round'),
    dormantUsed: boolean('dormant_used').default(false),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    statusIdx: index('idx_members_status').on(table.status),
  })
);

// users, sessions 테이블 제거됨 — Supabase Auth가 대체

/**
 * 스터디 회차 (Rounds)
 * 2주 = 1회차, 월요일 시작 ~ 일요일 마감
 */
export const rounds = pgTable('rounds', {
  id: serial('id').primaryKey(),
  roundNumber: integer('round_number').notNull().unique(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  graceEndDate: date('grace_end_date').notNull(),
  isCurrent: boolean('is_current').default(false),
});

/**
 * 블로그 글 (Posts)
 * RSS에서 수집된 스터디원의 블로그 글
 */
export const posts = pgTable(
  'posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    roundId: integer('round_id').references(() => rounds.id),
    title: varchar('title', { length: 2000 }).notNull(),
    url: varchar('url', { length: 2000 }).notNull().unique(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    description: text('description'),
    thumbnailUrl: varchar('thumbnail_url', { length: 2000 }),
    commentCount: integer('comment_count').default(0),
    collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberIdIdx: index('idx_posts_member_id').on(table.memberId),
    roundIdIdx: index('idx_posts_round_id').on(table.roundId),
  })
);

/**
 * 출석 (Attendance)
 * 회차별 멤버의 출석 상태
 */
export const attendance = pgTable(
  'attendance',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    roundId: integer('round_id')
      .notNull()
      .references(() => rounds.id),
    status: varchar('status', { length: 20 }).notNull().default(AttendanceStatus.PENDING),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberRoundUnique: uniqueIndex('attendance_member_round_unique').on(
      table.memberId,
      table.roundId
    ),
    roundIdIdx: index('idx_attendance_round_id').on(table.roundId),
  })
);

/**
 * 벌금 (Fines)
 * 지각/결석 시 부과되는 벌금
 */
export const fines = pgTable(
  'fines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    roundId: integer('round_id')
      .notNull()
      .references(() => rounds.id),
    type: varchar('type', { length: 20 }).notNull(),
    amount: integer('amount').notNull(),
    status: varchar('status', { length: 20 }).notNull().default(FineStatus.UNPAID),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    pendingConfirmation: boolean('pending_confirmation').default(true),
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
  },
  (table) => ({
    memberRoundUnique: uniqueIndex('fines_member_round_unique').on(table.memberId, table.roundId),
    statusIdx: index('idx_fines_status').on(table.status),
    pendingConfirmationIdx: index('idx_fines_pending_confirmation').on(table.pendingConfirmation),
    lastReminderAtIdx: index('idx_fines_last_reminder_at').on(table.lastReminderAt),
  })
);

/**
 * 키워드 통계 (Keywords)
 * 스터디원 글에서 추출된 키워드 빈도
 */
export const keywords = pgTable('keywords', {
  id: uuid('id').primaryKey().defaultRandom(),
  keyword: varchar('keyword', { length: 100 }).notNull().unique(),
  frequency: integer('frequency').default(1),
  lastUpdated: timestamp('last_updated', { withTimezone: true }).defaultNow(),
});

/**
 * 큐레이션 소스 (Curation Sources)
 * 외부 컨퍼런스/아티클 수집 소스
 */
export const curationSources = pgTable('curation_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  url: varchar('url', { length: 2000 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  rssUrl: varchar('rss_url', { length: 2000 }),
  tags: text('tags').array(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

/**
 * 큐레이션 아이템 (Curation Items)
 * 수집된 외부 컨텐츠
 */
export const curationItems = pgTable(
  'curation_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: uuid('source_id').references(() => curationSources.id),
    title: varchar('title', { length: 2000 }).notNull(),
    url: varchar('url', { length: 2000 }).notNull().unique(),
    description: text('description'),
    thumbnailUrl: varchar('thumbnail_url', { length: 2000 }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    category: varchar('category', { length: 50 }).notNull(),
    tags: text('tags').array(),
    relevanceScore: real('relevance_score').default(0),
    isShared: boolean('is_shared').default(false),
    sharedAt: timestamp('shared_at', { withTimezone: true }),
    collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    isSharedIdx: index('idx_curation_items_is_shared').on(table.isShared),
    publishedAtIdx: index('idx_curation_items_published_at').on(table.publishedAt),
  })
);

/**
 * 활동 점수 (Activity Scores)
 * 블로그 포스팅, 디스코드 활동, 관리자 수동 부여 점수 기록
 */
export const activityScores = pgTable(
  'activity_scores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    type: varchar('type', { length: 30 }).notNull(),
    points: integer('points').notNull(),
    description: varchar('description', { length: 300 }),
    date: date('date').notNull(), // 일일 상한 체크용
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberIdIdx: index('idx_activity_scores_member_id').on(table.memberId),
    memberDateTypeIdx: index('idx_activity_scores_member_date_type').on(
      table.memberId,
      table.date,
      table.type
    ),
    dateIdx: index('idx_activity_scores_date').on(table.date),
  })
);

/**
 * 포스트 조회 기록 (Post Views)
 * 포스트 조회 점수 중복 방지용
 */
export const postViews = pgTable(
  'post_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberPostUnique: uniqueIndex('post_views_member_post_unique').on(table.memberId, table.postId),
    memberIdIdx: index('idx_post_views_member_id').on(table.memberId),
  })
);

/**
 * 블로그 글 댓글 (Post Comments)
 * 블로그 포스트에 달리는 댓글 (비밀댓글 없음)
 */
export const postComments = pgTable(
  'post_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => posts.id),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    parentId: uuid('parent_id'),
    content: text('content').notNull(),
    isSecret: boolean('is_secret').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    postIdIdx: index('idx_post_comments_post_id').on(table.postId),
    memberIdIdx: index('idx_post_comments_member_id').on(table.memberId),
    parentIdIdx: index('idx_post_comments_parent_id').on(table.parentId),
  })
);

/**
 * 설정 (Config)
 * 스터디 설정 키-값 저장소
 */
export const config = pgTable('config', {
  key: varchar('key', { length: 100 }).primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ── Board ─────────────────────────────────────────────────────────

export const BoardCategory = {
  NOTICE: 'notice',
  SUGGESTION: 'suggestion',
  REVIEW: 'review',
  KNOWLEDGE: 'knowledge',
  DAILY: 'daily',
  ETC: 'etc',
} as const;

export type BoardCategoryType = (typeof BoardCategory)[keyof typeof BoardCategory];

export const boardPosts = pgTable(
  'board_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    category: varchar('category', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: jsonb('content').notNull(),
    contentText: text('content_text').notNull(),
    isSecret: boolean('is_secret').default(false),
    isPinned: boolean('is_pinned').default(false),
    isNoticeBanner: boolean('is_notice_banner').default(false),
    commentCount: integer('comment_count').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    memberIdIdx: index('idx_board_posts_member_id').on(table.memberId),
    categoryIdx: index('idx_board_posts_category').on(table.category),
    isPinnedIdx: index('idx_board_posts_is_pinned').on(table.isPinned),
    createdAtIdx: index('idx_board_posts_created_at').on(table.createdAt),
  })
);

export const boardComments = pgTable(
  'board_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => boardPosts.id),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    parentId: uuid('parent_id'),
    content: text('content').notNull(),
    isSecret: boolean('is_secret').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    postIdIdx: index('idx_board_comments_post_id').on(table.postId),
    memberIdIdx: index('idx_board_comments_member_id').on(table.memberId),
    parentIdIdx: index('idx_board_comments_parent_id').on(table.parentId),
  })
);

// ── Board Polls ─────────────────────────────────────────────────────────

export const PollType = {
  SINGLE: 'single',
  MULTIPLE: 'multiple',
  DATE: 'date',
  ANONYMOUS: 'anonymous',
} as const;

export type PollTypeType = (typeof PollType)[keyof typeof PollType];

export const pollTypeEnum = pgEnum('poll_type', ['text', 'date']);

export const boardPolls = pgTable(
  'board_polls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    postId: uuid('post_id')
      .notNull()
      .references(() => boardPosts.id, { onDelete: 'cascade' }),
    question: text('question').notNull(),
    pollType: pollTypeEnum('poll_type').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    allowMultiple: boolean('allow_multiple').default(false),
    isAnonymous: boolean('is_anonymous').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    postIdIdx: index('idx_board_polls_post_id').on(table.postId),
  })
);

// Add unique constraint via raw SQL (need to push manually)
// CREATE UNIQUE INDEX IF NOT EXISTS unique_active_poll_per_post
// ON board_polls(post_id)
// WHERE deleted_at IS NULL;

export const boardPollOptions = pgTable(
  'board_poll_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => boardPolls.id, { onDelete: 'cascade' }),
    optionText: text('option_text').notNull(),
    optionOrder: integer('option_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pollIdIdx: index('idx_board_poll_options_poll_id').on(table.pollId),
  })
);

export const boardPollVotes = pgTable(
  'board_poll_votes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => boardPolls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => boardPollOptions.id, { onDelete: 'cascade' }),
    memberId: uuid('member_id').references(() => members.id, {
      onDelete: 'cascade',
    }),
    anonymousId: text('anonymous_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    pollIdIdx: index('idx_board_poll_votes_poll_id').on(table.pollId),
    optionIdIdx: index('idx_board_poll_votes_option_id').on(table.optionId),
    memberIdIdx: index('idx_board_poll_votes_member_id').on(table.memberId),
  })
);

// ── FCM Tokens ─────────────────────────────────────────────────────────────

export const fcmTokens = pgTable(
  'fcm_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    deviceInfo: text('device_info'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberIdIdx: index('idx_fcm_tokens_member_id').on(table.memberId),
    memberTokenUnique: unique('member_token_unique').on(table.memberId, table.token),
  })
);

// ── Notification Preferences ─────────────────────────────────────────────────

export const NotificationType = {
  BOARD_COMMENT: 'board_comment',
  BOARD_REPLY: 'board_reply',
  POST_COMMENT: 'post_comment',
  POST_REPLY: 'post_reply',
  BOARD_NOTICE: 'board_notice',
} as const;

export type NotificationTypeType = (typeof NotificationType)[keyof typeof NotificationType];

export const notificationPreferences = pgTable(
  'notification_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 30 }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    memberTypeUnique: unique('member_type_unique').on(table.memberId, table.type),
    memberIdIdx: index('idx_notification_preferences_member_id').on(table.memberId),
  })
);

// ============================================
// Relations
// ============================================

export const membersRelations = relations(members, ({ many }) => ({
  posts: many(posts),
  attendance: many(attendance),
  fines: many(fines),
  activityScores: many(activityScores),
  postViews: many(postViews),
  postComments: many(postComments),
  boardPosts: many(boardPosts),
  boardComments: many(boardComments),
  fcmTokens: many(fcmTokens),
  notificationPreferences: many(notificationPreferences),
}));

export const fcmTokensRelations = relations(fcmTokens, ({ one }) => ({
  member: one(members, {
    fields: [fcmTokens.memberId],
    references: [members.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  member: one(members, {
    fields: [notificationPreferences.memberId],
    references: [members.id],
  }),
}));

export const roundsRelations = relations(rounds, ({ many }) => ({
  posts: many(posts),
  attendance: many(attendance),
  fines: many(fines),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  member: one(members, {
    fields: [posts.memberId],
    references: [members.id],
  }),
  round: one(rounds, {
    fields: [posts.roundId],
    references: [rounds.id],
  }),
  views: many(postViews),
  comments: many(postComments),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  member: one(members, {
    fields: [attendance.memberId],
    references: [members.id],
  }),
  round: one(rounds, {
    fields: [attendance.roundId],
    references: [rounds.id],
  }),
}));

export const finesRelations = relations(fines, ({ one }) => ({
  member: one(members, {
    fields: [fines.memberId],
    references: [members.id],
  }),
  round: one(rounds, {
    fields: [fines.roundId],
    references: [rounds.id],
  }),
}));

export const activityScoresRelations = relations(activityScores, ({ one }) => ({
  member: one(members, {
    fields: [activityScores.memberId],
    references: [members.id],
  }),
}));

export const postViewsRelations = relations(postViews, ({ one }) => ({
  member: one(members, {
    fields: [postViews.memberId],
    references: [members.id],
  }),
  post: one(posts, {
    fields: [postViews.postId],
    references: [posts.id],
  }),
}));

export const postCommentsRelations = relations(postComments, ({ one }) => ({
  post: one(posts, {
    fields: [postComments.postId],
    references: [posts.id],
  }),
  member: one(members, {
    fields: [postComments.memberId],
    references: [members.id],
  }),
}));

export const curationSourcesRelations = relations(curationSources, ({ many }) => ({
  items: many(curationItems),
}));

export const curationItemsRelations = relations(curationItems, ({ one }) => ({
  source: one(curationSources, {
    fields: [curationItems.sourceId],
    references: [curationSources.id],
  }),
}));

export const boardPostsRelations = relations(boardPosts, ({ one, many }) => ({
  member: one(members, {
    fields: [boardPosts.memberId],
    references: [members.id],
  }),
  comments: many(boardComments),
  polls: many(boardPolls),
}));

export const boardCommentsRelations = relations(boardComments, ({ one, many }) => ({
  post: one(boardPosts, {
    fields: [boardComments.postId],
    references: [boardPosts.id],
  }),
  member: one(members, {
    fields: [boardComments.memberId],
    references: [members.id],
  }),
  parent: one(boardComments, {
    fields: [boardComments.parentId],
    references: [boardComments.id],
    relationName: 'parentChild',
  }),
  children: many(boardComments, { relationName: 'parentChild' }),
}));

export const boardPollsRelations = relations(boardPolls, ({ one, many }) => ({
  post: one(boardPosts, {
    fields: [boardPolls.postId],
    references: [boardPosts.id],
  }),
  options: many(boardPollOptions),
  votes: many(boardPollVotes),
}));

export const boardPollOptionsRelations = relations(boardPollOptions, ({ one, many }) => ({
  poll: one(boardPolls, {
    fields: [boardPollOptions.pollId],
    references: [boardPolls.id],
  }),
  votes: many(boardPollVotes),
}));

export const boardPollVotesRelations = relations(boardPollVotes, ({ one }) => ({
  poll: one(boardPolls, {
    fields: [boardPollVotes.pollId],
    references: [boardPolls.id],
  }),
  option: one(boardPollOptions, {
    fields: [boardPollVotes.optionId],
    references: [boardPollOptions.id],
  }),
  member: one(members, {
    fields: [boardPollVotes.memberId],
    references: [members.id],
  }),
}));

// ============================================
// Type Exports (for use in application code)
// ============================================

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;

export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type Attendance = typeof attendance.$inferSelect;
export type NewAttendance = typeof attendance.$inferInsert;

export type Fine = typeof fines.$inferSelect;
export type NewFine = typeof fines.$inferInsert;

export type Keyword = typeof keywords.$inferSelect;
export type NewKeyword = typeof keywords.$inferInsert;

export type CurationSource = typeof curationSources.$inferSelect;
export type NewCurationSource = typeof curationSources.$inferInsert;

export type CurationItem = typeof curationItems.$inferSelect;
export type NewCurationItem = typeof curationItems.$inferInsert;

export type ActivityScore = typeof activityScores.$inferSelect;
export type NewActivityScore = typeof activityScores.$inferInsert;

export type PostView = typeof postViews.$inferSelect;
export type NewPostView = typeof postViews.$inferInsert;

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;

export type PostComment = typeof postComments.$inferSelect;
export type NewPostComment = typeof postComments.$inferInsert;

export type BoardPost = typeof boardPosts.$inferSelect;
export type NewBoardPost = typeof boardPosts.$inferInsert;

export type BoardComment = typeof boardComments.$inferSelect;
export type NewBoardComment = typeof boardComments.$inferInsert;

export type BoardPoll = typeof boardPolls.$inferSelect;
export type NewBoardPoll = typeof boardPolls.$inferInsert;

export type BoardPollOption = typeof boardPollOptions.$inferSelect;
export type NewBoardPollOption = typeof boardPollOptions.$inferInsert;

export type BoardPollVote = typeof boardPollVotes.$inferSelect;
export type NewBoardPollVote = typeof boardPollVotes.$inferInsert;

export type FcmToken = typeof fcmTokens.$inferSelect;
export type NewFcmToken = typeof fcmTokens.$inferInsert;

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
