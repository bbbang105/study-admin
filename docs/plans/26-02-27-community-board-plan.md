# 커뮤니티 게시판 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 커뮤니티 게시판 기능 구현 — 카테고리별 게시글, Tiptap 리치 에디터, 비밀글/비밀댓글, 무한 대댓글

**Architecture:** 2테이블 구조 (board_posts + board_comments). board_comments는 parent_id 셀프참조로 무한 대댓글. Tiptap JSON + plain text 이중 저장. 비밀글/비밀댓글은 is_secret boolean + 서버사이드 접근 제어.

**Tech Stack:** Drizzle ORM (스키마), Next.js API Routes, Tiptap (리치 에디터), shadcn/ui + Tailwind CSS

---

### Task 1: DB 스키마 추가 (shared 패키지)

**Files:**
- Modify: `packages/shared/src/db/schema.ts`

**Step 1: BoardCategory enum + board_posts + board_comments 테이블 추가**

`schema.ts` 하단(config 테이블 아래, Relations 섹션 위)에 추가:

```typescript
import { jsonb } from 'drizzle-orm/pg-core';  // 기존 import에 jsonb 추가

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

/**
 * 게시판 글 (Board Posts)
 * 커뮤니티 게시판의 게시글
 */
export const boardPosts = pgTable(
  'board_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id),
    category: varchar('category', { length: 20 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    content: jsonb('content').notNull(),           // Tiptap JSON
    contentText: text('content_text').notNull(),    // 검색/미리보기용 plain text
    isSecret: boolean('is_secret').default(false),
    isPinned: boolean('is_pinned').default(false),
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

/**
 * 게시판 댓글 (Board Comments)
 * parent_id 셀프참조로 무한 대댓글 지원
 */
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
    parentId: uuid('parent_id'),  // 셀프참조 (null = 루트 댓글)
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
```

**Step 2: Relations 추가**

Relations 섹션에 추가:

```typescript
// members relations에 boardPosts, boardComments 추가
export const membersRelations = relations(members, ({ many }) => ({
  posts: many(posts),
  attendance: many(attendance),
  fines: many(fines),
  activityScores: many(activityScores),
  postViews: many(postViews),
  boardPosts: many(boardPosts),
  boardComments: many(boardComments),
}));

export const boardPostsRelations = relations(boardPosts, ({ one, many }) => ({
  member: one(members, {
    fields: [boardPosts.memberId],
    references: [members.id],
  }),
  comments: many(boardComments),
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
```

**Step 3: Type exports 추가**

```typescript
export type BoardPost = typeof boardPosts.$inferSelect;
export type NewBoardPost = typeof boardPosts.$inferInsert;

export type BoardComment = typeof boardComments.$inferSelect;
export type NewBoardComment = typeof boardComments.$inferInsert;
```

**Step 4: shared 패키지 빌드**

Run: `pnpm --filter @blog-study/shared build`
Expected: 성공

**Step 5: DB 마이그레이션 생성 + 적용**

Run: `cd packages/shared && pnpm drizzle-kit generate && pnpm drizzle-kit push`
Expected: board_posts, board_comments 테이블 생성

**Step 6: 커밋**

```bash
git add packages/shared/src/db/schema.ts
git commit -m "feat: 게시판 DB 스키마 추가 (board_posts, board_comments)"
```

---

### Task 2: Tiptap 의존성 설치

**Step 1: Tiptap 패키지 설치**

Run: `pnpm --filter @blog-study/web add @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-code-block-lowlight @tiptap/extension-placeholder @tiptap/pm lowlight`

**Step 2: 커밋**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "chore: Tiptap 에디터 의존성 추가"
```

---

### Task 3: 게시판 인증 헬퍼

**Files:**
- Create: `packages/web/src/lib/board-auth.ts`

**Step 1: 유저 인증 + 관리자 체크 헬퍼 작성**

게시판 API에서 반복되는 인증 로직을 DRY하게:

```typescript
import { eq } from 'drizzle-orm';
import { createClient } from '@/lib/supabase/server';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { isAdminDiscordId } from '@/lib/admin';

const { members } = sharedDb;

export interface BoardAuthResult {
  memberId: string;
  discordId: string;
  isAdmin: boolean;
}

/**
 * 게시판용 인증: Supabase Auth → Discord ID → member 조회 → admin 체크
 * 인증 실패 시 null 반환
 */
export async function getBoardAuth(): Promise<BoardAuthResult | null> {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const discordIdentity = user.identities?.find(i => i.provider === 'discord');
  const discordId = discordIdentity?.id;
  if (!discordId) return null;

  const database = getDb();
  const [member] = await database
    .select({ id: members.id })
    .from(members)
    .where(eq(members.discordId, discordId))
    .limit(1);
  if (!member) return null;

  const isAdmin = await isAdminDiscordId(discordId);

  return { memberId: member.id, discordId, isAdmin };
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/lib/board-auth.ts
git commit -m "feat: 게시판 인증 헬퍼 (getBoardAuth)"
```

---

### Task 4: 게시글 목록 API (GET /api/board)

**Files:**
- Create: `packages/web/src/app/api/board/route.ts`

**Step 1: GET 핸들러 작성**

```typescript
import { NextRequest } from 'next/server';
import { eq, desc, and, isNull, count, sql, asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import {
  successResponse,
  errorResponse,
  Errors,
  parsePagination,
  createPaginationMeta,
} from '@/lib/api-error';

const { boardPosts, members } = sharedDb;

export async function GET(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');
    const { page, pageSize, offset } = parsePagination(searchParams);

    const database = getDb();

    // 필터 조건: soft delete 제외
    const conditions = [isNull(boardPosts.deletedAt)];
    if (category) {
      conditions.push(eq(boardPosts.category, category));
    }

    // 비밀글: 본인 또는 관리자만 볼 수 있음
    // 목록에서는 비밀글도 표시하되, 제목/작성자를 마스킹하여 반환

    // 고정 공지 (카테고리 필터가 없거나 notice일 때)
    const pinnedPosts = !category || category === 'notice'
      ? await database
          .select({
            id: boardPosts.id,
            memberId: boardPosts.memberId,
            memberName: members.nickname,
            memberProfileImage: members.profileImageUrl,
            memberDiscordId: members.discordId,
            category: boardPosts.category,
            title: boardPosts.title,
            contentText: boardPosts.contentText,
            isSecret: boardPosts.isSecret,
            isPinned: boardPosts.isPinned,
            commentCount: boardPosts.commentCount,
            createdAt: boardPosts.createdAt,
          })
          .from(boardPosts)
          .innerJoin(members, eq(boardPosts.memberId, members.id))
          .where(and(
            isNull(boardPosts.deletedAt),
            eq(boardPosts.isPinned, true),
          ))
          .orderBy(desc(boardPosts.createdAt))
      : [];

    // 일반 글 (고정 제외)
    const normalConditions = [...conditions, eq(boardPosts.isPinned, false)];

    const [countResult] = await database
      .select({ total: count() })
      .from(boardPosts)
      .where(and(...normalConditions));

    const normalPosts = await database
      .select({
        id: boardPosts.id,
        memberId: boardPosts.memberId,
        memberName: members.nickname,
        memberProfileImage: members.profileImageUrl,
        memberDiscordId: members.discordId,
        category: boardPosts.category,
        title: boardPosts.title,
        contentText: boardPosts.contentText,
        isSecret: boardPosts.isSecret,
        isPinned: boardPosts.isPinned,
        commentCount: boardPosts.commentCount,
        createdAt: boardPosts.createdAt,
      })
      .from(boardPosts)
      .innerJoin(members, eq(boardPosts.memberId, members.id))
      .where(and(...normalConditions))
      .orderBy(desc(boardPosts.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 비밀글 마스킹
    const maskSecret = (post: typeof normalPosts[0]) => {
      if (post.isSecret && post.memberId !== auth.memberId && !auth.isAdmin) {
        return {
          ...post,
          title: '비밀글입니다',
          contentText: '',
          memberName: '익명',
          memberProfileImage: null,
          memberDiscordId: '',
          isMasked: true,
        };
      }
      return { ...post, isMasked: false };
    };

    return successResponse({
      pinnedPosts: pinnedPosts.map(maskSecret),
      posts: normalPosts.map(maskSecret),
      pagination: createPaginationMeta(page, pageSize, countResult.total),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/api/board/route.ts
git commit -m "feat: 게시글 목록 API (GET /api/board)"
```

---

### Task 5: 게시글 작성 API (POST /api/board)

**Files:**
- Modify: `packages/web/src/app/api/board/route.ts`

**Step 1: POST 핸들러 추가**

같은 route.ts 파일에 POST export 추가:

```typescript
export async function POST(request: NextRequest) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const body = await request.json();
    const { category, title, content, contentText, isSecret } = body;

    // 유효성 검사
    if (!category || !title?.trim() || !content || !contentText?.trim()) {
      return Errors.badRequest('필수 항목을 입력해주세요.').toResponse();
    }

    // 공지는 관리자만
    if (category === 'notice' && !auth.isAdmin) {
      return Errors.forbidden('공지는 관리자만 작성할 수 있습니다.').toResponse();
    }

    const database = getDb();

    const [newPost] = await database
      .insert(boardPosts)
      .values({
        memberId: auth.memberId,
        category,
        title: title.trim(),
        content,
        contentText: contentText.trim(),
        isSecret: isSecret || false,
        isPinned: category === 'notice',
      })
      .returning();

    return successResponse(newPost, '게시글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
```

**Step 2: 커밋**

```bash
git add packages/web/src/app/api/board/route.ts
git commit -m "feat: 게시글 작성 API (POST /api/board)"
```

---

### Task 6: 게시글 상세 API (GET /api/board/[id])

**Files:**
- Create: `packages/web/src/app/api/board/[id]/route.ts`

**Step 1: GET 핸들러 (게시글 상세 + 댓글)**

```typescript
import { NextRequest } from 'next/server';
import { eq, and, isNull, asc } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';

const { boardPosts, boardComments, members } = sharedDb;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id } = await params;
    const database = getDb();

    // 게시글 조회
    const [post] = await database
      .select({
        id: boardPosts.id,
        memberId: boardPosts.memberId,
        memberName: members.nickname,
        memberProfileImage: members.profileImageUrl,
        memberDiscordId: members.discordId,
        category: boardPosts.category,
        title: boardPosts.title,
        content: boardPosts.content,
        contentText: boardPosts.contentText,
        isSecret: boardPosts.isSecret,
        isPinned: boardPosts.isPinned,
        commentCount: boardPosts.commentCount,
        createdAt: boardPosts.createdAt,
        updatedAt: boardPosts.updatedAt,
      })
      .from(boardPosts)
      .innerJoin(members, eq(boardPosts.memberId, members.id))
      .where(and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();

    // 비밀글 접근 체크
    if (post.isSecret && post.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('비밀글은 작성자와 관리자만 볼 수 있습니다.').toResponse();
    }

    // 댓글 목록 (flat, 클라이언트에서 트리 변환)
    const comments = await database
      .select({
        id: boardComments.id,
        postId: boardComments.postId,
        memberId: boardComments.memberId,
        memberName: members.nickname,
        memberProfileImage: members.profileImageUrl,
        memberDiscordId: members.discordId,
        parentId: boardComments.parentId,
        content: boardComments.content,
        isSecret: boardComments.isSecret,
        createdAt: boardComments.createdAt,
        updatedAt: boardComments.updatedAt,
        deletedAt: boardComments.deletedAt,
      })
      .from(boardComments)
      .innerJoin(members, eq(boardComments.memberId, members.id))
      .where(eq(boardComments.postId, id))
      .orderBy(asc(boardComments.createdAt));

    // 비밀 댓글 마스킹: 댓글 작성자 + 글 작성자 + 관리자만 열람
    const maskedComments = comments.map((comment) => {
      // 삭제된 댓글
      if (comment.deletedAt) {
        return {
          ...comment,
          content: '삭제된 댓글입니다.',
          memberName: '',
          memberProfileImage: null,
          memberDiscordId: '',
          isDeleted: true,
          isMasked: false,
        };
      }
      // 비밀 댓글
      if (
        comment.isSecret &&
        comment.memberId !== auth.memberId &&
        post.memberId !== auth.memberId &&
        !auth.isAdmin
      ) {
        return {
          ...comment,
          content: '비밀 댓글입니다.',
          memberName: '익명',
          memberProfileImage: null,
          memberDiscordId: '',
          isDeleted: false,
          isMasked: true,
        };
      }
      return { ...comment, isDeleted: false, isMasked: false };
    });

    return successResponse({ post, comments: maskedComments });
  } catch (error) {
    return errorResponse(error);
  }
}
```

**Step 2: PATCH 핸들러 (수정 — 본인만)**

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id } = await params;
    const database = getDb();

    // 기존 글 조회
    const [existing] = await database
      .select({ memberId: boardPosts.memberId, category: boardPosts.category })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId) {
      return Errors.forbidden('본인의 글만 수정할 수 있습니다.').toResponse();
    }

    const body = await request.json();
    const { category, title, content, contentText, isSecret } = body;

    // 공지 카테고리 변경은 관리자만
    if (category === 'notice' && !auth.isAdmin) {
      return Errors.forbidden('공지는 관리자만 작성할 수 있습니다.').toResponse();
    }

    const [updated] = await database
      .update(boardPosts)
      .set({
        ...(category && { category }),
        ...(title && { title: title.trim() }),
        ...(content && { content }),
        ...(contentText && { contentText: contentText.trim() }),
        ...(isSecret !== undefined && { isSecret }),
        isPinned: (category || existing.category) === 'notice',
        updatedAt: new Date(),
      })
      .where(eq(boardPosts.id, id))
      .returning();

    return successResponse(updated, '게시글이 수정되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
```

**Step 3: DELETE 핸들러 (본인 + 관리자)**

```typescript
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: boardPosts.memberId })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, id), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('삭제 권한이 없습니다.').toResponse();
    }

    // soft delete
    await database
      .update(boardPosts)
      .set({ deletedAt: new Date() })
      .where(eq(boardPosts.id, id));

    return successResponse(null, '게시글이 삭제되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
```

**Step 4: 커밋**

```bash
git add packages/web/src/app/api/board/[id]/route.ts
git commit -m "feat: 게시글 상세/수정/삭제 API (GET/PATCH/DELETE /api/board/[id])"
```

---

### Task 7: 댓글 API

**Files:**
- Create: `packages/web/src/app/api/board/[id]/comments/route.ts`
- Create: `packages/web/src/app/api/board/[id]/comments/[commentId]/route.ts`

**Step 1: 댓글 작성 API (POST)**

`packages/web/src/app/api/board/[id]/comments/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';

const { boardPosts, boardComments } = sharedDb;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId } = await params;
    const database = getDb();

    // 게시글 존재 확인
    const [post] = await database
      .select({ id: boardPosts.id })
      .from(boardPosts)
      .where(and(eq(boardPosts.id, postId), isNull(boardPosts.deletedAt)))
      .limit(1);

    if (!post) return Errors.notFound('게시글을 찾을 수 없습니다.').toResponse();

    const body = await request.json();
    const { content, parentId, isSecret } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    // parentId 유효성 검사
    if (parentId) {
      const [parent] = await database
        .select({ id: boardComments.id })
        .from(boardComments)
        .where(and(
          eq(boardComments.id, parentId),
          eq(boardComments.postId, postId),
        ))
        .limit(1);

      if (!parent) return Errors.badRequest('상위 댓글을 찾을 수 없습니다.').toResponse();
    }

    const [newComment] = await database
      .insert(boardComments)
      .values({
        postId,
        memberId: auth.memberId,
        parentId: parentId || null,
        content: content.trim(),
        isSecret: isSecret || false,
      })
      .returning();

    // comment_count 증가
    await database
      .update(boardPosts)
      .set({ commentCount: sql`${boardPosts.commentCount} + 1` })
      .where(eq(boardPosts.id, postId));

    return successResponse(newComment, '댓글이 작성되었습니다.', 201);
  } catch (error) {
    return errorResponse(error);
  }
}
```

**Step 2: 댓글 수정/삭제 API**

`packages/web/src/app/api/board/[id]/comments/[commentId]/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { db as sharedDb } from '@blog-study/shared';
import { getBoardAuth } from '@/lib/board-auth';
import { successResponse, errorResponse, Errors } from '@/lib/api-error';

const { boardPosts, boardComments } = sharedDb;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { commentId } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: boardComments.memberId })
      .from(boardComments)
      .where(and(eq(boardComments.id, commentId), isNull(boardComments.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('댓글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId) {
      return Errors.forbidden('본인의 댓글만 수정할 수 있습니다.').toResponse();
    }

    const body = await request.json();
    const { content, isSecret } = body;

    if (!content?.trim()) {
      return Errors.badRequest('댓글 내용을 입력해주세요.').toResponse();
    }

    const [updated] = await database
      .update(boardComments)
      .set({
        content: content.trim(),
        ...(isSecret !== undefined && { isSecret }),
        updatedAt: new Date(),
      })
      .where(eq(boardComments.id, commentId))
      .returning();

    return successResponse(updated, '댓글이 수정되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const auth = await getBoardAuth();
    if (!auth) return Errors.unauthorized().toResponse();

    const { id: postId, commentId } = await params;
    const database = getDb();

    const [existing] = await database
      .select({ memberId: boardComments.memberId })
      .from(boardComments)
      .where(and(eq(boardComments.id, commentId), isNull(boardComments.deletedAt)))
      .limit(1);

    if (!existing) return Errors.notFound('댓글을 찾을 수 없습니다.').toResponse();
    if (existing.memberId !== auth.memberId && !auth.isAdmin) {
      return Errors.forbidden('삭제 권한이 없습니다.').toResponse();
    }

    // soft delete
    await database
      .update(boardComments)
      .set({ deletedAt: new Date() })
      .where(eq(boardComments.id, commentId));

    // comment_count 감소
    await database
      .update(boardPosts)
      .set({ commentCount: sql`GREATEST(${boardPosts.commentCount} - 1, 0)` })
      .where(eq(boardPosts.id, postId));

    return successResponse(null, '댓글이 삭제되었습니다.');
  } catch (error) {
    return errorResponse(error);
  }
}
```

**Step 3: 커밋**

```bash
git add packages/web/src/app/api/board/[id]/comments/
git commit -m "feat: 댓글 CRUD API (작성/수정/삭제)"
```

---

### Task 8: Tiptap 에디터 컴포넌트

**Files:**
- Create: `packages/web/src/components/board/tiptap-editor.tsx`

**Step 1: Tiptap 에디터 컴포넌트 작성**

Tiptap 에디터 (굵은글씨, 이탤릭, 취소선, 리스트, 코드블록, 링크, placeholder) + 툴바:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Code,
  Link as LinkIcon,
  Undo,
  Redo,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const lowlight = createLowlight(common);

interface TiptapEditorProps {
  content?: object;
  onChange: (json: object, text: string) => void;
  placeholder?: string;
  editable?: boolean;
}

export function TiptapEditor({
  content,
  onChange,
  placeholder = '내용을 입력해주세요...',
  editable = true,
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-sky-500 underline' } }),
      Placeholder.configure({ placeholder }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: content || '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON(), editor.getText());
    },
  });

  if (!editor) return null;

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800">
      {/* Toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-zinc-200 dark:border-zinc-800 p-1.5">
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive('bold')}
            title="굵게"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive('italic')}
            title="기울임"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            active={editor.isActive('strike')}
            title="취소선"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive('bulletList')}
            title="글머리 기호"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive('orderedList')}
            title="번호 목록"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            active={editor.isActive('blockquote')}
            title="인용"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            active={editor.isActive('codeBlock')}
            title="코드 블록"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />
          <ToolbarButton
            onClick={() => {
              const url = window.prompt('링크 URL을 입력하세요:');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }}
            active={editor.isActive('link')}
            title="링크"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <div className="ml-auto flex items-center gap-0.5">
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="되돌리기">
              <Undo className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="다시 실행">
              <Redo className="h-4 w-4" />
            </ToolbarButton>
          </div>
        </div>
      )}
      {/* Editor content */}
      <EditorContent
        editor={editor}
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none p-4',
          'min-h-[200px]',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:text-zinc-400',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
          '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
        )}
      />
    </div>
  );
}

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-md p-1.5 transition-colors',
        active
          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
          : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100'
      )}
    >
      {children}
    </button>
  );
}
```

**Step 2: Tiptap 읽기 전용 렌더러 컴포넌트**

`packages/web/src/components/board/tiptap-renderer.tsx`:

```typescript
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

const lowlight = createLowlight(common);

interface TiptapRendererProps {
  content: object;
}

export function TiptapRenderer({ content }: TiptapRendererProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Link.configure({ openOnClick: true }),
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content,
    editable: false,
  });

  return (
    <EditorContent
      editor={editor}
      className="prose prose-sm dark:prose-invert max-w-none"
    />
  );
}
```

**Step 3: 커밋**

```bash
git add packages/web/src/components/board/
git commit -m "feat: Tiptap 에디터 + 렌더러 컴포넌트"
```

---

### Task 9: 게시판 목록 페이지 (/board)

**Files:**
- Create: `packages/web/src/app/(user)/board/page.tsx`

**Step 1: 게시판 목록 페이지 작성**

카테고리 탭 필터 + 테이블 형태 목록 + 공지 고정 영역 + 페이지네이션.
기존 posts 페이지 패턴 참조: `'use client'`, useEffect fetch, useSearchParams 페이지네이션.

주요 구성:
- 카테고리 탭: 전체 / 공지 / 건의 / 후기 / 지식공유 / 일상 / 기타
- 고정 공지 영역 (배경색 구분, 📌 아이콘)
- 일반 글 테이블: [카테고리 뱃지] [제목] [작성자(아바타+닉네임)] [날짜] [댓글수]
- 비밀글은 🔒 아이콘 + 마스킹 표시
- 모바일: 카드 리스트, 데스크톱: 테이블
- 글쓰기 버튼 (우측 상단)

카테고리 뱃지 색상 맵:

```typescript
const categoryConfig: Record<string, { label: string; color: string }> = {
  notice: { label: '공지', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  suggestion: { label: '건의', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  review: { label: '후기', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  knowledge: { label: '지식공유', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  daily: { label: '일상', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  etc: { label: '기타', color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
};
```

이 설정은 여러 페이지에서 재사용되므로 `packages/web/src/lib/board-config.ts`로 추출.

**참고**: 기존 `packages/web/src/lib/member-config.ts` 패턴과 동일하게 config 파일 분리.

**Step 2: board-config.ts 생성**

```typescript
// packages/web/src/lib/board-config.ts
export const BOARD_CATEGORIES = [
  { value: 'notice', label: '공지' },
  { value: 'suggestion', label: '건의' },
  { value: 'review', label: '후기' },
  { value: 'knowledge', label: '지식공유' },
  { value: 'daily', label: '일상' },
  { value: 'etc', label: '기타' },
] as const;

export const categoryBadgeConfig: Record<string, { label: string; className: string }> = {
  notice: { label: '공지', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  suggestion: { label: '건의', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  review: { label: '후기', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  knowledge: { label: '지식공유', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  daily: { label: '일상', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  etc: { label: '기타', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400' },
};

export function getCategoryLabel(value: string): string {
  return categoryBadgeConfig[value]?.label || value;
}
```

**Step 3: 커밋**

```bash
git add packages/web/src/lib/board-config.ts packages/web/src/app/(user)/board/page.tsx
git commit -m "feat: 게시판 목록 페이지 + board-config"
```

---

### Task 10: 글 작성 페이지 (/board/write)

**Files:**
- Create: `packages/web/src/app/(user)/board/write/page.tsx`

**Step 1: 글 작성 페이지 작성**

주요 구성:
- 카테고리 드롭다운 (Select 컴포넌트, 관리자만 '공지' 선택 가능)
- 제목 입력 (Input)
- Tiptap 에디터
- 비밀글 체크박스 (Switch)
- 작성 / 취소 버튼
- 작성 성공 시 `/board/[newPostId]`로 리다이렉트

`/api/auth/me` 호출로 isAdmin 판별 (기존 페이지 패턴).

**Step 2: 커밋**

```bash
git add packages/web/src/app/(user)/board/write/page.tsx
git commit -m "feat: 게시글 작성 페이지 (Tiptap 에디터)"
```

---

### Task 11: 글 상세 페이지 (/board/[id])

**Files:**
- Create: `packages/web/src/app/(user)/board/[id]/page.tsx`
- Create: `packages/web/src/components/board/comment-tree.tsx`
- Create: `packages/web/src/components/board/comment-form.tsx`
- Create: `packages/web/src/components/board/delete-post-dialog.tsx`

**Step 1: 댓글 트리 컴포넌트 (comment-tree.tsx)**

flat 댓글 배열을 트리로 변환 + 렌더링:
- `buildCommentTree(comments)`: flat → nested tree 변환
- 재귀 렌더링, depth 2~3까지 들여쓰기 (그 이후 flat)
- 각 댓글: 아바타 + 닉네임 + 시간 + 내용 + 답글/수정/삭제 버튼
- 비밀 댓글 마스킹 표시 (🔒)
- 삭제된 댓글 회색 표시

**Step 2: 댓글 작성 폼 (comment-form.tsx)**

- textarea + 비밀 댓글 체크박스 + 등록 버튼
- parentId prop으로 대댓글 작성 지원

**Step 3: 삭제 확인 다이얼로그 (delete-post-dialog.tsx)**

기존 `DeleteMemberDialog` 패턴 참조 — AlertDialog 사용:

```typescript
// shadcn AlertDialog 패턴
<AlertDialog>
  <AlertDialogTrigger asChild>...</AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>게시글을 삭제하시겠습니까?</AlertDialogTitle>
      <AlertDialogDescription>삭제된 글은 복구할 수 없습니다.</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>취소</AlertDialogCancel>
      <AlertDialogAction onClick={onDelete}>삭제</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

**Step 4: 글 상세 페이지 (page.tsx)**

주요 구성:
- 상단: 카테고리 뱃지 + 제목 + 비밀글 아이콘
- 작성자 정보: 아바타(DiceBear) + 닉네임 + 작성일
- 본문: TiptapRenderer로 렌더링
- 하단: 수정/삭제 버튼 (본인일 때), 삭제 버튼 (관리자일 때)
- 목록으로 돌아가기 버튼
- 댓글 영역: 댓글 수 표시 + CommentTree + CommentForm

**Step 5: 커밋**

```bash
git add packages/web/src/app/(user)/board/[id]/ packages/web/src/components/board/
git commit -m "feat: 게시글 상세 페이지 + 댓글 트리 컴포넌트"
```

---

### Task 12: 글 수정 페이지 (/board/[id]/edit)

**Files:**
- Create: `packages/web/src/app/(user)/board/[id]/edit/page.tsx`

**Step 1: 글 수정 페이지 작성**

- GET /api/board/[id]로 기존 데이터 로드
- 본인이 아니면 /board로 리다이렉트
- 카테고리/제목/내용/비밀글 수정 가능
- Tiptap 에디터에 기존 content JSON 초기값 전달
- PATCH /api/board/[id]로 저장
- 수정 성공 시 /board/[id]로 리다이렉트

**Step 2: 커밋**

```bash
git add packages/web/src/app/(user)/board/[id]/edit/page.tsx
git commit -m "feat: 게시글 수정 페이지"
```

---

### Task 13: 사이드바 네비게이션 추가

**Files:**
- Modify: `packages/web/src/components/layout/sidebar.tsx`

**Step 1: userNavItems에 게시판 추가**

`sidebar.tsx`의 userNavItems 배열에 추가 (큐레이션 아래):

```typescript
import { MessageSquare } from 'lucide-react';  // import 추가

const userNavItems: NavItem[] = [
  { title: '대시보드', href: '/dashboard', icon: LayoutDashboard },
  { title: '글 목록', href: '/posts', icon: FileText },
  { title: '랭킹', href: '/ranking', icon: Trophy },
  { title: '큐레이션', href: '/curation', icon: Newspaper },
  { title: '게시판', href: '/board', icon: MessageSquare },  // 추가
  { title: '스터디원 목록', href: '/members', icon: UsersRound },
];
```

**Step 2: 커밋**

```bash
git add packages/web/src/components/layout/sidebar.tsx
git commit -m "feat: 사이드바에 게시판 메뉴 추가"
```

---

### Task 14: AlertDialog 컴포넌트 확인 및 추가

**Files:**
- Possibly create: `packages/web/src/components/ui/alert-dialog.tsx`

**Step 1: shadcn AlertDialog 존재 확인**

기존 `DeleteMemberDialog`가 사용하는 AlertDialog가 이미 있는지 확인. 없으면 shadcn CLI로 추가:

Run: `ls packages/web/src/components/ui/alert-dialog.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"`

만약 MISSING이면:
Run: `cd packages/web && npx shadcn@latest add alert-dialog`

**Step 2: Select 컴포넌트 확인**

글 작성 페이지에서 카테고리 드롭다운 필요. 이미 `@radix-ui/react-select`가 package.json에 있으므로 shadcn Select 파일 확인:

Run: `ls packages/web/src/components/ui/select.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"`

만약 MISSING이면:
Run: `cd packages/web && npx shadcn@latest add select`

**Step 3: Checkbox/Switch 컴포넌트 확인**

비밀글 토글용. Switch는 이미 있음 (`@radix-ui/react-switch`). 파일 확인:

Run: `ls packages/web/src/components/ui/switch.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"`

**Step 4: Tabs 컴포넌트 확인**

카테고리 탭 필터용. `@radix-ui/react-tabs`가 package.json에 있으므로:

Run: `ls packages/web/src/components/ui/tabs.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"`

만약 MISSING이면 추가.

**Step 5: Textarea 컴포넌트 확인**

댓글 입력용:

Run: `ls packages/web/src/components/ui/textarea.tsx 2>/dev/null && echo "EXISTS" || echo "MISSING"`

**Step 6: 커밋 (새로 추가한 UI 컴포넌트가 있으면)**

```bash
git add packages/web/src/components/ui/
git commit -m "chore: shadcn UI 컴포넌트 추가 (alert-dialog, select, textarea, tabs)"
```

---

### Task 15: 타입 체크 + 빌드 검증

**Step 1: 타입 체크**

Run: `pnpm typecheck`
Expected: 에러 없음

**Step 2: 빌드**

Run: `pnpm build`
Expected: 성공

**Step 3: 수정 필요한 에러 수정 후 커밋**

---

### Task 16: 전체 동작 확인

**Step 1: 로컬 실행**

Run: `pnpm dev:web`

**Step 2: 기능 테스트 체크리스트**

- [ ] /board 페이지 접근 확인
- [ ] 카테고리 탭 필터 동작
- [ ] 글 작성 (일반 글)
- [ ] 글 작성 (공지 — 관리자)
- [ ] 글 작성 (비밀글)
- [ ] 글 상세 보기
- [ ] 비밀글 접근 제한 확인
- [ ] 글 수정
- [ ] 글 삭제
- [ ] 댓글 작성
- [ ] 대댓글 작성
- [ ] 비밀 댓글 작성 + 마스킹 확인
- [ ] 댓글 수정/삭제
- [ ] 모바일 반응형 확인
- [ ] 사이드바 게시판 메뉴 활성화 확인

**Step 3: 최종 커밋**

```bash
git commit -m "feat: 커뮤니티 게시판 기능 완성"
```
