/**
 * member_blogs 마이그레이션 — Phase 1 (EXPAND, 비파괴)
 *
 * 1. member_blogs 테이블 생성 (FK / index / UNIQUE 포함, idempotent)
 * 2. 기존 members.blog_url/rss_url/rss_consent → member_blogs 1행 백필
 *
 * ❗ members 의 구컬럼은 그대로 둔다 — 구버전 코드가 계속 동작하므로
 *    이 단계는 운영 중에 안전하게 실행 가능. 컬럼 제거는 Phase 2(contract).
 *
 * 재실행 안전 (CREATE TABLE IF NOT EXISTS, NOT EXISTS 백필 가드).
 * SQL은 전부 정적(사용자 입력 없음) → .unsafe() 사용 (postgres tagged-template
 * 제네릭이 환경별로 다르게 추론되는 문제 회피).
 *
 * Usage: pnpm --filter @blog-study/shared migrate:member-blogs:expand
 */

import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

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
      await tx.unsafe(`
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
      `);

      // FK (없을 때만 추가)
      await tx.unsafe(`
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
      `);

      await tx.unsafe(`
        CREATE INDEX IF NOT EXISTS "idx_member_blogs_member_id"
          ON "member_blogs" ("member_id")
      `);

      // (member_id, blog_url) 유니크 — 동시 요청 중복 삽입 방지
      await tx.unsafe(`
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
      `);

      // members.blog_url 컬럼이 존재할 때만 백필 (구컬럼 유지 — 비파괴)
      const colCheck = (await tx.unsafe(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'members' AND column_name = 'blog_url'
        ) AS exists
      `)) as unknown as Array<{ exists: boolean }>;
      const hasBlogUrl = colCheck[0]?.exists ?? false;

      if (hasBlogUrl) {
        const inserted = (await tx.unsafe(`
          INSERT INTO "member_blogs" ("member_id", "blog_url", "rss_url", "rss_consent", "sort_order")
          SELECT m."id", m."blog_url", m."rss_url", COALESCE(m."rss_consent", true), 0
          FROM "members" m
          WHERE m."blog_url" IS NOT NULL
            AND m."blog_url" <> ''
            AND NOT EXISTS (
              SELECT 1 FROM "member_blogs" mb WHERE mb."member_id" = m."id"
            )
        `)) as unknown as { count: number };
        console.log(`✅ 백필 완료: ${inserted.count}개 멤버 블로그 행 생성 (구컬럼 유지)`);
      } else {
        console.log('ℹ️  members.blog_url 컬럼 없음 — 이미 contract 완료된 상태로 보임. 백필 스킵');
      }
    });

    const countRows = (await sql.unsafe(
      `SELECT COUNT(*) AS count FROM "member_blogs"`
    )) as unknown as Array<{ count: string }>;
    console.log(
      `🎉 EXPAND 완료 — member_blogs 총 ${countRows[0]?.count ?? '0'}행. ` +
        `구컬럼은 유지됨 (운영 안전). 신코드 배포 검증 후 contract 실행.`
    );
    process.exit(0);
  } catch (error) {
    console.error('❌ EXPAND 실패 (롤백됨):', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
