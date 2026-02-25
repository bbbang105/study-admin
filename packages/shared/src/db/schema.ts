import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  date,
  real,
  serial,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Enums (as string literals for PostgreSQL)
// ============================================

export const MemberStatus = {
  ACTIVE: 'active',
  DORMANT: 'dormant',
  WITHDRAWN: 'withdrawn',
} as const;

export type MemberStatusType = (typeof MemberStatus)[keyof typeof MemberStatus];

export const AttendanceStatus = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  LATE: 'late',
  ABSENT: 'absent',
} as const;

export type AttendanceStatusType = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];

export const FineType = {
  LATE: 'late',
  ABSENT: 'absent',
} as const;

export type FineTypeValue = (typeof FineType)[keyof typeof FineType];

export const FineStatus = {
  UNPAID: 'unpaid',
  PAID: 'paid',
  WAIVED: 'waived',
} as const;

export type FineStatusType = (typeof FineStatus)[keyof typeof FineStatus];

export const CurationCategory = {
  CONFERENCE: 'conference',
  ARTICLE: 'article',
} as const;

export type CurationCategoryType = (typeof CurationCategory)[keyof typeof CurationCategory];


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
    blogUrl: varchar('blog_url', { length: 500 }).notNull(),
    rssUrl: varchar('rss_url', { length: 500 }),
    // 프로필 정보 (온보딩)
    profileImageUrl: varchar('profile_image_url', { length: 500 }),
    bio: varchar('bio', { length: 200 }),
    interests: text('interests').array(),
    resolution: varchar('resolution', { length: 300 }),
    onboardingCompleted: boolean('onboarding_completed').default(false),
    // 소셜 링크
    githubUrl: varchar('github_url', { length: 500 }),
    linkedinUrl: varchar('linkedin_url', { length: 500 }),
    instagramUrl: varchar('instagram_url', { length: 500 }),
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
    title: varchar('title', { length: 500 }).notNull(),
    url: varchar('url', { length: 1000 }).notNull().unique(),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    description: text('description'),
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
    memberRoundUnique: uniqueIndex('attendance_member_round_unique').on(table.memberId, table.roundId),
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
  },
  (table) => ({
    memberRoundUnique: uniqueIndex('fines_member_round_unique').on(table.memberId, table.roundId),
    statusIdx: index('idx_fines_status').on(table.status),
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
  url: varchar('url', { length: 500 }).notNull().unique(),
  name: varchar('name', { length: 200 }).notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  rssUrl: varchar('rss_url', { length: 500 }),
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
    title: varchar('title', { length: 500 }).notNull(),
    url: varchar('url', { length: 1000 }).notNull().unique(),
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

// ============================================
// Relations
// ============================================

export const membersRelations = relations(members, ({ many }) => ({
  posts: many(posts),
  attendance: many(attendance),
  fines: many(fines),
}));

export const roundsRelations = relations(rounds, ({ many }) => ({
  posts: many(posts),
  attendance: many(attendance),
  fines: many(fines),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  member: one(members, {
    fields: [posts.memberId],
    references: [members.id],
  }),
  round: one(rounds, {
    fields: [posts.roundId],
    references: [rounds.id],
  }),
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

export const curationSourcesRelations = relations(curationSources, ({ many }) => ({
  items: many(curationItems),
}));

export const curationItemsRelations = relations(curationItems, ({ one }) => ({
  source: one(curationSources, {
    fields: [curationItems.sourceId],
    references: [curationSources.id],
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

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;
