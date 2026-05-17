/**
 * member_blogs 마이그레이션 + 백필 스크립트 (1회성)
 *
 * 1. member_blogs 테이블 생성 (idempotent, drizzle 스키마와 동일 DDL)
 * 2. 기존 members.blog_url/rss_url/rss_consent → member_blogs 1행 백필
 * 3. members 테이블의 blog_url/rss_url/rss_consent 컬럼 제거
 *
 * 모든 작업을 단일 트랜잭션으로 처리 — 도중 실패 시 전체 롤백.
 * 재실행해도 안전 (CREATE TABLE IF NOT EXISTS, NOT EXISTS 가드, DROP COLUMN IF EXISTS).
 *
 * Usage: pnpm --filter @blog-study/shared migrate:member-blogs
 */

import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

// 루트 .env.local (shared/bot용) 우선 로드
config({ path: resolve(__dirname, '../../../../.env.local') });
config({ path: resolve(__dirname, '../../../../.env') });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ DATABASE_URL 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  try {
    await sql.begin(async (tx) => {
      // 1. member_blogs 테이블 생성
      await tx`
        CREATE TABLE IF NOT EXISTS "member_blogs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "member_id" uuid NOT NULL,
          "label" varchar(100),
          "blog_url" varchar(2000) NOT NULL,
          "rss_url" varchar(2000),
          "rss_consent" boolean DEFAULT true NOT NULL,
          "sort_order" integer DEFAULT 0 NOT NULL,
          "created_at" timestamp with time zone DEFAULT now(),
          "updated_at" timestamp with time zone DEFAULT now()
        )
      `;

      // FK (없을 때만 추가)
      await tx`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'member_blogs_member_id_members_id_fk'
          ) THEN
            ALTER TABLE "member_blogs"
              ADD CONSTRAINT "member_blogs_member_id_members_id_fk"
              FOREIGN KEY ("member_id") REFERENCES "public"."members"("id")
              ON DELETE cascade ON UPDATE no action;
          END IF;
        END $$
      `;

      await tx`
        CREATE INDEX IF NOT EXISTS "idx_member_blogs_member_id"
          ON "member_blogs" ("member_id")
      `;

      // (member_id, blog_url) 유니크 — 동시 요청 중복 삽입 방지
      await tx`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'uq_member_blogs_member_id_blog_url'
          ) THEN
            ALTER TABLE "member_blogs"
              ADD CONSTRAINT "uq_member_blogs_member_id_blog_url"
              UNIQUE ("member_id", "blog_url");
          END IF;
        END $$
      `;

      // members.blog_url 컬럼이 아직 존재할 때만 백필 (재실행 안전)
      const colCheck = await tx<{ exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'members' AND column_name = 'blog_url'
        ) AS exists
      `;
      const hasBlogUrl = colCheck[0]?.exists ?? false;

      if (hasBlogUrl) {
        // 2. 백필: 멤버당 blog_url 1행 (이미 블로그가 있는 멤버는 스킵)
        const inserted = await tx`
          INSERT INTO "member_blogs" ("member_id", "blog_url", "rss_url", "rss_consent", "sort_order")
          SELECT m."id", m."blog_url", m."rss_url", COALESCE(m."rss_consent", true), 0
          FROM "members" m
          WHERE m."blog_url" IS NOT NULL
            AND m."blog_url" <> ''
            AND NOT EXISTS (
              SELECT 1 FROM "member_blogs" mb WHERE mb."member_id" = m."id"
            )
        `;
        console.log(`✅ 백필 완료: ${inserted.count}개 멤버 블로그 행 생성`);

        // 3. members 컬럼 제거
        await tx`ALTER TABLE "members" DROP COLUMN IF EXISTS "blog_url"`;
        await tx`ALTER TABLE "members" DROP COLUMN IF EXISTS "rss_url"`;
        await tx`ALTER TABLE "members" DROP COLUMN IF EXISTS "rss_consent"`;
        console.log('✅ members 테이블 blog_url/rss_url/rss_consent 컬럼 제거 완료');
      } else {
        console.log('ℹ️  members.blog_url 컬럼 없음 — 백필/컬럼제거 스킵 (이미 마이그레이션됨)');
      }
    });

    const countRows = await sql<{ count: string }[]>`SELECT COUNT(*) AS count FROM "member_blogs"`;
    console.log(`🎉 마이그레이션 완료 — member_blogs 총 ${countRows[0]?.count ?? '0'}행`);
    process.exit(0);
  } catch (error) {
    console.error('❌ 마이그레이션 실패 (롤백됨):', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
